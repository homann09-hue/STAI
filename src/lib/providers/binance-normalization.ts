import { z } from "zod";

import { buildNormalizedBar } from "@/lib/canonical-bar";
import { buildNormalizedQuote, quoteFeedTypeForQuality } from "@/lib/canonical-quote";
import type {
  BarInterval,
  MarketDataQuality,
  NormalizedBar,
  NormalizedQuote,
  NormalizedTrade,
} from "@/lib/types";

const numberText = z.string().trim().min(1).max(80);
const tickerSchema = z.object({
  e: z.literal("24hrTicker"),
  E: z.number().int().positive(),
  s: z.string().trim().min(5).max(32),
  p: numberText,
  P: numberText,
  w: numberText,
  c: numberText,
  Q: numberText,
  b: numberText,
  B: numberText,
  a: numberText,
  A: numberText,
  o: numberText,
  h: numberText,
  l: numberText,
  v: numberText,
  q: numberText,
  L: z.number().int().nonnegative(),
}).passthrough();

const bookTickerSchema = z.object({
  u: z.number().int().nonnegative(),
  s: z.string().trim().min(5).max(32),
  b: numberText,
  B: numberText,
  a: numberText,
  A: numberText,
}).passthrough();

const tradeSchema = z.object({
  e: z.literal("trade"),
  E: z.number().int().positive(),
  s: z.string().trim().min(5).max(32),
  t: z.number().int().nonnegative(),
  p: numberText,
  q: numberText,
  T: z.number().int().positive(),
  m: z.boolean(),
}).passthrough();

const klineSchema = z.object({
  e: z.literal("kline"),
  E: z.number().int().positive(),
  s: z.string().trim().min(5).max(32),
  k: z.object({
    t: z.number().int().positive(),
    T: z.number().int().positive(),
    s: z.string().trim().min(5).max(32),
    i: z.string().trim().min(2).max(4),
    f: z.number().int().nonnegative(),
    L: z.number().int().nonnegative(),
    o: numberText,
    c: numberText,
    h: numberText,
    l: numberText,
    v: numberText,
    n: z.number().int().nonnegative(),
    x: z.boolean(),
    q: numberText,
  }).passthrough(),
}).passthrough();

export type BinanceTickerPayload = z.infer<typeof tickerSchema>;
export type BinanceBookTickerPayload = z.infer<typeof bookTickerSchema>;

export interface BinanceNormalizationOptions {
  quality?: MarketDataQuality;
  receivedAt?: Date;
  resolveSymbol?: (providerSymbol: string) => string;
}

const quoteCurrencies = [
  "FDUSD", "USDT", "USDC", "BUSD", "EUR", "GBP", "AUD", "BRL", "TRY", "BTC", "ETH", "BNB",
] as const;

function finite(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: string): number | null {
  const parsed = finite(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegative(value: string): number | null {
  const parsed = finite(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function isoFromMs(value: number): string | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeBinanceProviderSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isBinanceStreamSymbol(value: string): boolean {
  return /^[A-Z0-9]{5,32}$/.test(normalizeBinanceProviderSymbol(value));
}

function quoteCurrency(providerSymbol: string): string {
  return quoteCurrencies.find((currency) => providerSymbol.endsWith(currency)) ?? "XXX";
}

function resolvedSymbol(
  providerSymbol: string,
  options: BinanceNormalizationOptions,
): string {
  return (options.resolveSymbol?.(providerSymbol) ?? providerSymbol).trim().toUpperCase();
}

export function parseBinanceTicker(input: unknown): BinanceTickerPayload | null {
  const parsed = tickerSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function parseBinanceBookTicker(input: unknown): BinanceBookTickerPayload | null {
  const parsed = bookTickerSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function normalizeBinanceQuote(
  tickerInput: unknown,
  bookInput: unknown | null,
  options: BinanceNormalizationOptions = {},
): NormalizedQuote | null {
  const ticker = tickerSchema.safeParse(tickerInput);
  if (!ticker.success) return null;
  const book = bookInput === null ? null : bookTickerSchema.safeParse(bookInput);
  const providerSymbol = normalizeBinanceProviderSymbol(ticker.data.s);
  const symbol = resolvedSymbol(providerSymbol, options);
  const price = positive(ticker.data.c);
  const providerTimestamp = isoFromMs(ticker.data.E);
  if (!symbol || price === null || !providerTimestamp) return null;
  const receivedAt = options.receivedAt ?? new Date();
  const currency = quoteCurrency(providerSymbol);
  const quality = options.quality ?? "near_realtime";
  const activeBook = book?.success && normalizeBinanceProviderSymbol(book.data.s) === providerSymbol
    ? book.data
    : null;
  const sourceQualityIssues = [
    "rolling_24h_window",
    ...(activeBook ? ["book_timestamp_unavailable"] : []),
    ...(symbol.endsWith("-USD") && currency === "USDT" ? ["requested_usd_mapped_to_usdt"] : []),
  ];

  try {
    return buildNormalizedQuote(
      {
        instrumentId: `crypto:BINANCE:${symbol}:${currency}`,
        symbol,
        assetType: "crypto",
        providerId: "binance",
        providerSymbol,
        venue: "BINANCE",
        currency,
        last: price,
        lastSize: nonNegative(ticker.data.Q),
        change: finite(ticker.data.p),
        changePercent: finite(ticker.data.P),
        bid: positive(activeBook?.b ?? ticker.data.b),
        bidSize: nonNegative(activeBook?.B ?? ticker.data.B),
        ask: positive(activeBook?.a ?? ticker.data.a),
        askSize: nonNegative(activeBook?.A ?? ticker.data.A),
        open: positive(ticker.data.o),
        high: positive(ticker.data.h),
        low: positive(ticker.data.l),
        volume: nonNegative(ticker.data.q),
        vwap: positive(ticker.data.w),
        marketStatus: "open",
        marketSession: "REGULAR",
        eventTimestamp: providerTimestamp,
        providerTimestamp,
        receivedTimestamp: receivedAt.toISOString(),
        provider: "Binance Spot",
        quality,
        latencyMs: Math.max(0, receivedAt.getTime() - ticker.data.E),
        sourceQualityIssues,
      },
      { now: receivedAt },
    );
  } catch {
    return null;
  }
}

export function normalizeBinanceTrade(
  input: unknown,
  options: BinanceNormalizationOptions = {},
): NormalizedTrade | null {
  const parsed = tradeSchema.safeParse(input);
  if (!parsed.success) return null;
  const providerSymbol = normalizeBinanceProviderSymbol(parsed.data.s);
  const symbol = resolvedSymbol(providerSymbol, options);
  const price = positive(parsed.data.p);
  const size = positive(parsed.data.q);
  const eventTimestamp = isoFromMs(parsed.data.T);
  const providerTimestamp = isoFromMs(parsed.data.E);
  if (!symbol || price === null || size === null || !eventTimestamp || !providerTimestamp) return null;
  const quality = options.quality ?? "near_realtime";
  return {
    instrumentId: `crypto:BINANCE:${symbol}:${quoteCurrency(providerSymbol)}`,
    symbol,
    providerId: "binance",
    providerSymbol,
    venue: "BINANCE",
    price,
    size,
    tradeId: String(parsed.data.t),
    conditions: [parsed.data.m ? "BUYER_MAKER" : "SELLER_MAKER"],
    tape: null,
    eventTimestamp,
    providerTimestamp,
    receivedTimestamp: (options.receivedAt ?? new Date()).toISOString(),
    provider: "Binance Spot",
    quality,
    feedType: quoteFeedTypeForQuality(quality),
    isRealtime: quality === "realtime",
    reportedDelaySeconds: null,
    qualityIssues: ["venue_trade", "display_rights_plan_dependent"],
  };
}

const intervalMap: Record<string, BarInterval | undefined> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w", "1M": "1mo",
};

export function normalizeBinanceKline(
  input: unknown,
  options: BinanceNormalizationOptions = {},
): NormalizedBar | null {
  const parsed = klineSchema.safeParse(input);
  if (!parsed.success) return null;
  const interval = intervalMap[parsed.data.k.i];
  const providerSymbol = normalizeBinanceProviderSymbol(parsed.data.s);
  const symbol = resolvedSymbol(providerSymbol, options);
  const openTime = isoFromMs(parsed.data.k.t);
  const closeTime = isoFromMs(parsed.data.k.T + 1);
  const providerTimestamp = isoFromMs(parsed.data.E);
  const open = positive(parsed.data.k.o);
  const high = positive(parsed.data.k.h);
  const low = positive(parsed.data.k.l);
  const close = positive(parsed.data.k.c);
  const volume = nonNegative(parsed.data.k.v);
  const baseVolume = positive(parsed.data.k.v);
  const quoteVolume = nonNegative(parsed.data.k.q);
  const vwap = baseVolume !== null && quoteVolume !== null ? quoteVolume / baseVolume : null;
  if (!interval || !symbol || !openTime || !closeTime || !providerTimestamp || open === null || high === null || low === null || close === null || volume === null) return null;
  const receivedAt = options.receivedAt ?? new Date();

  try {
    return buildNormalizedBar(
      {
        instrumentId: `crypto:BINANCE:${symbol}:${quoteCurrency(providerSymbol)}`,
        providerId: "binance",
        providerSymbol,
        venue: "BINANCE",
        symbol,
        range: "1D",
        interval,
        openTime,
        closeTime,
        open,
        high,
        low,
        close,
        volume,
        tradeCount: parsed.data.k.n,
        vwap,
        currency: quoteCurrency(providerSymbol),
        isAdjusted: false,
        adjustmentType: "RAW",
        provider: "Binance Spot",
        providerTimestamp,
        receivedTimestamp: receivedAt.toISOString(),
        sessionTimeZone: "UTC",
        quality: options.quality ?? "near_realtime",
        sourceQualityIssues: parsed.data.k.x ? [] : ["open_candle"],
      },
      { now: receivedAt },
    );
  } catch {
    return null;
  }
}
