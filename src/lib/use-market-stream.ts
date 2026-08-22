"use client";

import { useEffect, useState } from "react";
import { defaultRefreshIntervalMs } from "@/lib/refresh-config";
import {
  indexQuotesForStreamSubscription,
  normalizeMarketStreamSubscription,
  type MarketStreamIdentityMode,
  type MarketStreamSubscription,
} from "@/lib/market-stream-subscription";
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
const MAX_STREAM_EVENT_CHARS = 200000;

function parseEventData<T>(event: MessageEvent, fallback: T | null = null) {
  if (typeof event.data !== "string" || event.data.length > MAX_STREAM_EVENT_CHARS) return fallback;
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return fallback;
  }
}

export function useMarketStream(
  subscription: MarketStreamSubscription,
  enabled = true,
  preferredIntervalMs: RefreshInterval = defaultRefreshIntervalMs,
) {
  const normalizedSubscription = normalizeMarketStreamSubscription(subscription);
  const subscriptionKey = normalizedSubscription.key;
  const [state, setState] = useState<MarketStreamState>({
    quotes: {},
    status: "idle",
    connectionStatus: "offline",
    refreshMode: "polling",
    intervalMs: defaultRefreshIntervalMs,
    provider: null,
    error: null,
    lastHeartbeat: null,
  });

  useEffect(() => {
    const activeSubscription = normalizeMarketStreamSubscription(subscription);
    if (!enabled || !activeSubscription.values.length) {
      setState((current) => ({
        ...current,
        quotes: {},
        status: "idle",
        connectionStatus: "offline",
        refreshMode: "polling",
        provider: null,
        error: null,
        lastHeartbeat: null,
      }));
      return;
    }

    let closed = false;
    let pollTimer: number | null = null;
    let commitTimer: number | null = null;
    let pollingStarted = false;
    let pendingQuotes: Record<string, NormalizedQuote> = {};
    const allowedKeys = new Set(activeSubscription.values);
    const activeIntervalMs = preferredIntervalMs;
    const abortController = new AbortController();

    setState((current) => ({
      ...current,
      quotes: Object.fromEntries(
        Object.entries(current.quotes).filter(([key]) => allowedKeys.has(key)),
      ),
      error: null,
    }));

    function nextPollDelay() {
      return activeIntervalMs * (document.visibilityState === "hidden" ? BACKGROUND_POLL_MULTIPLIER : 1);
    }

    function commitQuotes(rawQuotes: readonly unknown[]) {
      const indexed = indexQuotesForStreamSubscription(rawQuotes, activeSubscription);
      if (!Object.keys(indexed).length) return;
      pendingQuotes = { ...pendingQuotes, ...indexed };
      if (commitTimer !== null) return;
      commitTimer = window.setTimeout(() => {
        const quotesToCommit = pendingQuotes;
        pendingQuotes = {};
        commitTimer = null;
        setState((current) => ({
          ...current,
          quotes: { ...current.quotes, ...quotesToCommit },
          error: null,
        }));
      }, UI_THROTTLE_MS);
    }

    function identityMatches(mode: MarketStreamIdentityMode | undefined) {
      return mode === activeSubscription.mode;
    }

    async function pollQuotes() {
      if (closed) return;
      try {
        setState((current) => ({
          ...current,
          status: "polling",
          connectionStatus: "polling",
          refreshMode: "polling",
          intervalMs: activeIntervalMs,
        }));
        const response = await fetch(`/api/market/quotes?${activeSubscription.query}`, {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (closed) return;
        if (response.status === 429) {
          setState((current) => ({ ...current, connectionStatus: "rate_limited" }));
          throw new Error("Rate-Limit aktiv");
        }
        if (!response.ok) throw new Error("Polling fehlgeschlagen");
        const payload = (await response.json()) as {
          quotes?: NormalizedQuote[];
          provider?: string;
          identityMode?: MarketStreamIdentityMode;
        };
        if (closed) return;
        if (!identityMatches(payload.identityMode)) throw new Error("Identitätsmodus stimmt nicht überein");
        if (payload.quotes?.length) commitQuotes(payload.quotes);
        setState((current) => ({
          ...current,
          provider: payload.provider ?? current.provider,
          connectionStatus: "polling",
          error: null,
        }));
      } catch {
        if (closed) return;
        setState((current) => ({
          ...current,
          status: "error",
          connectionStatus: current.connectionStatus === "rate_limited" ? "rate_limited" : "error",
          error: current.connectionStatus === "rate_limited"
            ? "Rate-Limit aktiv, Polling wird verlangsamt."
            : "Marktdaten momentan nicht erreichbar.",
        }));
      } finally {
        if (!closed) pollTimer = window.setTimeout(pollQuotes, nextPollDelay());
      }
    }

    const events = new EventSource(`/api/market/stream?${activeSubscription.query}`);

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
        error: message,
      }));
      pollQuotes();
    }

    setState((current) => ({
      ...current,
      status: "streaming",
      connectionStatus: "connected",
      refreshMode: "sse",
      intervalMs: activeIntervalMs,
      error: null,
    }));

    events.addEventListener("status", (event) => {
      const payload = parseEventData<{ provider?: string; identityMode?: MarketStreamIdentityMode }>(event);
      if (!payload || !identityMatches(payload.identityMode)) {
        switchToPolling("Streamstatus ohne passende Listing-Identität, REST-Polling aktiv.");
        return;
      }
      setState((current) => ({
        ...current,
        provider: payload.provider ?? current.provider,
        status: "streaming",
        connectionStatus: "connected",
      }));
    });

    events.addEventListener("quotes", (event) => {
      const payload = parseEventData<{
        quotes?: NormalizedQuote[];
        provider?: string;
        identityMode?: MarketStreamIdentityMode;
      }>(event);
      if (!payload || !identityMatches(payload.identityMode)) {
        switchToPolling("Streamdaten ohne passende Listing-Identität, REST-Polling aktiv.");
        return;
      }
      if (payload.quotes?.length) commitQuotes(payload.quotes);
      setState((current) => ({
        ...current,
        provider: payload.provider ?? current.provider,
        status: "streaming",
        connectionStatus: "connected",
      }));
    });

    events.addEventListener("heartbeat", (event) => {
      const payload = parseEventData<{ timestamp?: string }>(event, {}) ?? {};
      setState((current) => ({
        ...current,
        lastHeartbeat: payload.timestamp ?? new Date().toISOString(),
      }));
    });

    events.addEventListener("error", () => switchToPolling());

    return () => {
      closed = true;
      abortController.abort();
      events.close();
      if (pollTimer !== null) window.clearTimeout(pollTimer);
      if (commitTimer !== null) window.clearTimeout(commitTimer);
    };
  }, [enabled, preferredIntervalMs, subscriptionKey]);

  return state;
}
