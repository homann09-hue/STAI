import { z } from "zod";

import { normalizeBarSeries, type NormalizedBarSeries } from "@/lib/canonical-bar";
import { buildNormalizedQuote } from "@/lib/canonical-quote";
import type {
  BarInterval,
  MarketDataQuality,
  MarketStatus,
  NormalizedQuote,
  NormalizedTrade,
  QuoteFeedType,
  QuoteMarketSession,
} from "@/lib/types";

const finite = z.number().finite();
const optionalFinite = finite.nullish();

export const alpacaQuoteSchema = z.object({
  t: z.string(),
  ax: z.string().nullish(),
  ap: optionalFinite,
  as: optionalFinite,
  bx: z.string().nullish(),
  bp: optionalFinite,
  bs: optionalFinite,
  c: z.array(z.string()).optional(),
  z: z.string().nullish(),
}).passthrough();

export const alpacaTradeSchema = z.object({
  t: z.string(),
  x: z.string().nullish(),
  p: finite,
  s: finite,
  i: z.union([z.string(), z.number()]).nullish(),
  c: z.array(z.string()).optional(),
  z: z.string().nullish(),
}).passthrough();

export const alpacaBarSchema = z.object({
  t: z.string(),
  o: finite,
  h: finite,
  l: finite,
  c: finite,
  v: finite,
  n: optionalFinite,
  vw: optionalFinite,
}).passthrough();

export const alpacaSnapshotSchema = z.object({
  latestTrade: alpacaTradeSchema.nullish(),
  latestQuote: alpacaQuoteSchema.nullish(),
  minuteBar: alpacaBarSchema.nullish(),
  dailyBar: alpacaBarSchema.nullish(),
  prevDailyBar: alpacaBarSchema.nullish(),
}).passthrough();

export const alpacaBarsResponseSchema = z.object({
  bars: z.array(alpacaBarSchema).default([]),
  symbol: z.string().optional(),
  next_page_token: z.string().nullable().optional(),
}).passthrough();

export const alpacaClockSchema = z.object({
  timestamp: z.string(),
  is_open: z.boolean(),
  next_open: z.string(),
  next_close: z.string(),
}).passthrough();

export type AlpacaFeed = "iex" | "sip" | "delayed_sip";
export type AlpacaClock = z.infer<typeof alpacaClockSchema>;
export type AlpacaSnapshot = z.infer<typeof alpacaSnapshotSchema>;
export type AlpacaTrade = z.infer<typeof alpacaTradeSchema>;
export type AlpacaQuote = z.infer<typeof alpacaQuoteSchema>;
export type AlpacaBar = z.infer<typeof alpacaBarSchema>;

export type AlpacaFeedMetadata = {
  feed: AlpacaFeed;
  providerLabel: string;
  quality: MarketDataQuality;
  feedType: QuoteFeedType;
  reportedDelaySeconds: number;
  qualityIssues: string[];
};

export function alpacaFeedMetadata(feed: AlpacaFeed): AlpacaFeedMetadata {
  if (feed === "delayed_sip") {
    return {
      feed,
      providerLabel: "Alpaca Delayed SIP (15 Min.)",
      quality: "delayed",
      feedType: "DELAYED",
      reportedDelaySeconds: 900,
      qualityIssues: ["delayed_sip_feed"],
    };
  }
  if (feed === "sip") {
    return {
      feed,
      providerLabel: "Alpaca SIP",
      quality: "realtime",
      feedType: "REALTIME",
      reportedDelaySeconds: 0,
      qualityIssues: [],
    };
  }
  return {
    feed,
    providerLabel: "Alpaca IEX (einzelner Handelsplatz)",
    quality: "realtime",
    feedType: "REALTIME",
    reportedDelaySeconds: 0,
    qualityIssues: ["single_venue_feed"],
  };
}

export function alpacaMarketState(clock: AlpacaClock | null): {
  marketStatus: MarketStatus;
  marketSession: QuoteMarketSession;
} {
  if (!clock) return { marketStatus: "unknown", marketSession: "UNKNOWN" };
  return clock.is_open
    ? { marketStatus: "open", marketSession: "REGULAR" }
    : { marketStatus: "closed", marketSession: "CLOSED" };
}

export function normalizeAlpacaSnapshot(
  symbol: string,
  snapshot: AlpacaSnapshot,
  options: {
    feed: AlpacaFeed;
    latencyMs: number;
    clock?: AlpacaClock | null;
    now?: Date;
  },
): NormalizedQuote | null {
  const trade = snapshot.latestTrade;
  if (!trade || trade.p <= 0 || trade.s < 0) return null;
  const quote = snapshot.latestQuote;
  const daily = snapshot.dailyBar;
  const previous = snapshot.prevDailyBar;
  const metadata = alpacaFeedMetadata(options.feed);
  const state = alpacaMarketState(options.clock ?? null);
  const venue = options.feed === "iex" ? "IEX" : trade.x ?? null;

  return buildNormalizedQuote(
    {
      instrumentId: null,
      symbol,
      assetType: "stock",
      providerId: "alpaca",
      providerSymbol: symbol,
      venue,
      currency: "USD",
      last: trade.p,
      lastSize: trade.s,
      bid: quote?.bp,
      bidSize: quote?.bs,
      ask: quote?.ap,
      askSize: quote?.as,
      open: daily?.o,
      high: daily?.h,
      low: daily?.l,
      previousClose: previous?.c,
      volume: daily?.v,
      vwap: daily?.vw,
      marketStatus: state.marketStatus,
      marketSession: state.marketSession,
      eventTimestamp: trade.t,
      providerTimestamp: trade.t,
      receivedTimestamp: (options.now ?? new Date()).toISOString(),
      provider: metadata.providerLabel,
      quality: metadata.quality,
      feedType: metadata.feedType,
      reportedDelaySeconds: metadata.reportedDelaySeconds,
      latencyMs: options.latencyMs,
      sourceQualityIssues: metadata.qualityIssues,
    },
    { now: options.now },
  );
}

export function normalizeAlpacaTrade(
  symbol: string,
  trade: AlpacaTrade,
  feed: AlpacaFeed,
  now = new Date(),
): NormalizedTrade | null {
  if (trade.p <= 0 || trade.s < 0 || !Number.isFinite(Date.parse(trade.t))) {
    return null;
  }
  const metadata = alpacaFeedMetadata(feed);
  const timestamp = new Date(trade.t).toISOString();
  return {
    instrumentId: null,
    symbol: symbol.trim().toUpperCase(),
    providerId: "alpaca",
    providerSymbol: symbol.trim().toUpperCase(),
    venue: feed === "iex" ? "IEX" : trade.x ?? null,
    price: trade.p,
    size: trade.s,
    tradeId: trade.i === null || trade.i === undefined ? null : String(trade.i),
    conditions: [...new Set(trade.c ?? [])].slice(0, 16),
    tape: trade.z ?? null,
    eventTimestamp: timestamp,
    providerTimestamp: timestamp,
    receivedTimestamp: now.toISOString(),
    provider: metadata.providerLabel,
    quality: metadata.quality,
    feedType: metadata.feedType,
    isRealtime:
      metadata.feedType === "REALTIME" && metadata.reportedDelaySeconds === 0,
    reportedDelaySeconds: metadata.reportedDelaySeconds,
    qualityIssues: [...metadata.qualityIssues],
  };
}

const intervalMs: Record<Exclude<BarInterval, "1mo">, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};

function closeTime(openTime: string, interval: BarInterval) {
  const open = new Date(openTime);
  if (interval === "1mo") {
    return new Date(Date.UTC(open.getUTCFullYear(), open.getUTCMonth() + 1, 1)).toISOString();
  }
  return new Date(open.getTime() + intervalMs[interval]).toISOString();
}

export function normalizeAlpacaBars(
  symbol: string,
  bars: readonly AlpacaBar[],
  options: {
    feed: AlpacaFeed;
    interval: BarInterval;
    instrumentId?: string | null;
    currency?: string | null;
    now?: Date;
  },
): NormalizedBarSeries {
  const metadata = alpacaFeedMetadata(options.feed);
  return normalizeBarSeries(
    bars.map((bar) => ({
      instrumentId: options.instrumentId ?? null,
      providerId: "alpaca",
      providerSymbol: symbol,
      venue: options.feed === "iex" ? "IEX" : null,
      symbol,
      range: "MAX",
      interval: options.interval,
      openTime: bar.t,
      closeTime: closeTime(bar.t, options.interval),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      tradeCount: bar.n,
      vwap: bar.vw,
      currency: options.currency ?? "USD",
      isAdjusted: false,
      adjustmentType: "RAW",
      provider: metadata.providerLabel,
      providerTimestamp: bar.t,
      receivedTimestamp: (options.now ?? new Date()).toISOString(),
      sessionTimeZone: "America/New_York",
      quality: "historical",
      sourceQualityIssues: metadata.qualityIssues,
      time: bar.t,
    })),
    { now: options.now },
  );
}
