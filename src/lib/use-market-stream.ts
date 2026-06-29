"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultRefreshIntervalMs } from "@/lib/refresh-config";
import type { MarketConnectionStatus, NormalizedQuote, RefreshInterval, RefreshMode } from "@/lib/types";

type StreamStatus = "idle" | "streaming" | "polling" | "error";

type MarketStreamState = {
  quotes: Record<string, NormalizedQuote>;
  status: StreamStatus;
  connectionStatus: MarketConnectionStatus;
  refreshMode: RefreshMode;
  intervalMs: RefreshInterval;
  provider: string | null;
  error: string | null;
  lastHeartbeat: string | null;
};

const UI_THROTTLE_MS = 700;
const BACKGROUND_POLL_MULTIPLIER = 6;

function normalizeSymbols(symbols: string[]) {
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].slice(0, 30);
}

export function useMarketStream(symbols: string[], enabled = true) {
  const symbolKey = useMemo(() => normalizeSymbols(symbols).join(","), [symbols]);
  const [state, setState] = useState<MarketStreamState>({
    quotes: {},
    status: "idle",
    connectionStatus: "offline",
    refreshMode: "polling",
    intervalMs: defaultRefreshIntervalMs,
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

    function nextPollDelay() {
      const backgroundMultiplier = document.visibilityState === "hidden" ? BACKGROUND_POLL_MULTIPLIER : 1;
      return defaultRefreshIntervalMs * backgroundMultiplier;
    }

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
        setState((current) => ({
          ...current,
          status: "polling",
          connectionStatus: "polling",
          refreshMode: "polling",
          intervalMs: defaultRefreshIntervalMs
        }));
        const response = await fetch(`/api/market/quotes?symbols=${encodedSymbols}`, { cache: "no-store" });
        if (response.status === 429) {
          setState((current) => ({ ...current, connectionStatus: "rate_limited" }));
          throw new Error("Rate-Limit aktiv");
        }
        if (!response.ok) throw new Error("Polling fehlgeschlagen");
        const payload = (await response.json()) as { quotes?: NormalizedQuote[]; provider?: string };
        if (payload.quotes?.length) commitQuotes(payload.quotes);
        setState((current) => ({
          ...current,
          provider: payload.provider ?? current.provider,
          connectionStatus: "polling",
          error: null
        }));
      } catch {
        setState((current) => ({
          ...current,
          status: "error",
          connectionStatus: current.connectionStatus === "rate_limited" ? "rate_limited" : "error",
          error: current.connectionStatus === "rate_limited" ? "Rate-Limit aktiv, Polling wird verlangsamt." : "Marktdaten momentan nicht erreichbar."
        }));
      } finally {
        if (!closed) pollTimer = window.setTimeout(pollQuotes, nextPollDelay());
      }
    }

    const events = new EventSource(`/api/market/stream?symbols=${encodedSymbols}`);
    setState((current) => ({
      ...current,
      status: "streaming",
      connectionStatus: "connected",
      refreshMode: "websocket",
      intervalMs: defaultRefreshIntervalMs,
      error: null
    }));

    events.addEventListener("status", (event) => {
      const payload = JSON.parse(event.data) as { provider?: string };
      setState((current) => ({
        ...current,
        provider: payload.provider ?? current.provider,
        status: "streaming",
        connectionStatus: "connected"
      }));
    });

    events.addEventListener("quotes", (event) => {
      const payload = JSON.parse(event.data) as { quotes?: NormalizedQuote[]; provider?: string };
      if (payload.quotes?.length) commitQuotes(payload.quotes);
      setState((current) => ({
        ...current,
        provider: payload.provider ?? current.provider,
        status: "streaming",
        connectionStatus: "connected"
      }));
    });

    events.addEventListener("heartbeat", (event) => {
      const payload = JSON.parse(event.data) as { timestamp?: string };
      setState((current) => ({ ...current, lastHeartbeat: payload.timestamp ?? new Date().toISOString() }));
    });

    events.addEventListener("error", () => {
      if (closed) return;
      events.close();
      setState((current) => ({
        ...current,
        status: "polling",
        connectionStatus: "reconnecting",
        refreshMode: "polling",
        error: "Stream unterbrochen, REST-Polling aktiv."
      }));
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
