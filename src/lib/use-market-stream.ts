"use client";

import { useEffect, useMemo, useState } from "react";
import type { NormalizedQuote } from "@/lib/types";

type StreamStatus = "idle" | "streaming" | "polling" | "error";

type MarketStreamState = {
  quotes: Record<string, NormalizedQuote>;
  status: StreamStatus;
  provider: string | null;
  error: string | null;
  lastHeartbeat: string | null;
};

const UI_THROTTLE_MS = 700;
const POLL_INTERVAL_MS = 10000;

function normalizeSymbols(symbols: string[]) {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].slice(0, 30);
}

export function useMarketStream(symbols: string[], enabled = true) {
  const symbolKey = useMemo(() => normalizeSymbols(symbols).join(","), [symbols]);
  const [state, setState] = useState<MarketStreamState>({
    quotes: {},
    status: "idle",
    provider: null,
    error: null,
    lastHeartbeat: null
  });

  useEffect(() => {
    if (!enabled || !symbolKey) return;

    let closed = false;
    let pollTimer: number | null = null;
    let commitTimer: number | null = null;
    let pendingQuotes: Record<string, NormalizedQuote> = {};
    const encodedSymbols = encodeURIComponent(symbolKey);

    function commitQuotes(quotes: NormalizedQuote[]) {
      pendingQuotes = {
        ...pendingQuotes,
        ...Object.fromEntries(quotes.map((quote) => [quote.symbol, quote]))
      };

      if (commitTimer !== null) return;

      commitTimer = window.setTimeout(() => {
        setState((current) => ({
          ...current,
          quotes: {
            ...current.quotes,
            ...pendingQuotes
          },
          error: null
        }));
        pendingQuotes = {};
        commitTimer = null;
      }, UI_THROTTLE_MS);
    }

    async function pollQuotes() {
      if (closed) return;

      try {
        setState((current) => ({ ...current, status: "polling" }));
        const response = await fetch(`/api/market/quotes?symbols=${encodedSymbols}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Polling fehlgeschlagen");
        const payload = (await response.json()) as { quotes?: NormalizedQuote[]; provider?: string };
        if (payload.quotes?.length) commitQuotes(payload.quotes);
        setState((current) => ({ ...current, provider: payload.provider ?? current.provider, error: null }));
      } catch {
        setState((current) => ({ ...current, status: "error", error: "Marktdaten momentan nicht erreichbar." }));
      } finally {
        if (!closed) pollTimer = window.setTimeout(pollQuotes, POLL_INTERVAL_MS);
      }
    }

    const events = new EventSource(`/api/market/stream?symbols=${encodedSymbols}`);
    setState((current) => ({ ...current, status: "streaming", error: null }));

    events.addEventListener("status", (event) => {
      const payload = JSON.parse(event.data) as { provider?: string };
      setState((current) => ({ ...current, provider: payload.provider ?? current.provider, status: "streaming" }));
    });

    events.addEventListener("quotes", (event) => {
      const payload = JSON.parse(event.data) as { quotes?: NormalizedQuote[]; provider?: string };
      if (payload.quotes?.length) commitQuotes(payload.quotes);
      setState((current) => ({ ...current, provider: payload.provider ?? current.provider, status: "streaming" }));
    });

    events.addEventListener("heartbeat", (event) => {
      const payload = JSON.parse(event.data) as { timestamp?: string };
      setState((current) => ({ ...current, lastHeartbeat: payload.timestamp ?? new Date().toISOString() }));
    });

    events.addEventListener("error", () => {
      if (closed) return;
      events.close();
      setState((current) => ({ ...current, status: "polling", error: "Stream unterbrochen, REST-Polling aktiv." }));
      pollQuotes();
    });

    return () => {
      closed = true;
      events.close();
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      if (commitTimer !== null) window.clearTimeout(commitTimer);
    };
  }, [enabled, symbolKey]);

  return state;
}
