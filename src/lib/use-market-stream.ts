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

function parseEventData<T>(event: MessageEvent, fallback: T | null = null) {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return fallback;
  }
}

export function useMarketStream(symbols: string[], enabled = true, preferredIntervalMs: RefreshInterval = defaultRefreshIntervalMs) {
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
    let pollingStarted = false;
    let pendingQuotes: Record<string, NormalizedQuote> = {};
    const encodedSymbols = encodeURIComponent(symbolKey);
    const activeIntervalMs = preferredIntervalMs;

    function nextPollDelay() {
      const backgroundMultiplier = document.visibilityState === "hidden" ? BACKGROUND_POLL_MULTIPLIER : 1;
      return activeIntervalMs * backgroundMultiplier;
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
          intervalMs: activeIntervalMs
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

    function switchToPolling(message = "Stream unterbrochen, REST-Polling aktiv.") {
      if (closed) return;
      events.close();
      if (pollingStarted) return;
      pollingStarted = true;
      setState((current) => ({
        ...current,
        status: "polling",
        connectionStatus: "reconnecting",
        refreshMode: "polling",
        error: message
      }));
      pollQuotes();
    }

    setState((current) => ({
      ...current,
      status: "streaming",
      connectionStatus: "connected",
      refreshMode: "sse",
      intervalMs: activeIntervalMs,
      error: null
    }));

    events.addEventListener("status", (event) => {
      const payload = parseEventData<{ provider?: string }>(event);
      if (!payload) {
        switchToPolling("Streamstatus unlesbar, REST-Polling aktiv.");
        return;
      }

      setState((current) => ({
        ...current,
        provider: payload.provider ?? current.provider,
        status: "streaming",
        connectionStatus: "connected"
      }));
    });

    events.addEventListener("quotes", (event) => {
      const payload = parseEventData<{ quotes?: NormalizedQuote[]; provider?: string }>(event);
      if (!payload) {
        switchToPolling("Streamdaten unlesbar, REST-Polling aktiv.");
        return;
      }

      if (payload.quotes?.length) commitQuotes(payload.quotes);
      setState((current) => ({
        ...current,
        provider: payload.provider ?? current.provider,
        status: "streaming",
        connectionStatus: "connected"
      }));
    });

    events.addEventListener("heartbeat", (event) => {
      const payload = parseEventData<{ timestamp?: string }>(event, {}) ?? {};
      setState((current) => ({ ...current, lastHeartbeat: payload.timestamp ?? new Date().toISOString() }));
    });

    events.addEventListener("error", () => {
      switchToPolling();
    });

    return () => {
      closed = true;
      events.close();
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      if (commitTimer !== null) window.clearTimeout(commitTimer);
    };
  }, [enabled, preferredIntervalMs, symbolKey]);

  return state;
}
