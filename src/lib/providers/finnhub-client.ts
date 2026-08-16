import "server-only";

import { z } from "zod";

import { normalizeBarSeries, type CanonicalBarInput } from "@/lib/canonical-bar";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import {
  normalizeFinnhubQuote,
  normalizeFinnhubTrade,
  type FinnhubQuoteSnapshot,
  type FinnhubTradePayload,
} from "@/lib/providers/finnhub-normalization";
import type {
  BarInterval,
  ChartRange,
  MarketDataQuality,
  NormalizedBar,
  NormalizedTrade,
} from "@/lib/types";

const quoteSchema = z.object({
  c: z.number().optional(),
  d: z.number().nullable().optional(),
  dp: z.number().nullable().optional(),
  h: z.number().nullable().optional(),
  l: z.number().nullable().optional(),
  o: z.number().nullable().optional(),
  pc: z.number().nullable().optional(),
  t: z.number().nullable().optional(),
}).passthrough();

const searchItemSchema = z.object({
  description: z.string().optional(),
  displaySymbol: z.string().optional(),
  symbol: z.string().optional(),
  type: z.string().optional(),
}).passthrough();
const searchSchema = z.object({ count: z.number().optional(), result: z.array(searchItemSchema).optional() }).passthrough();

const profileSchema = z.object({
  country: z.string().optional(),
  currency: z.string().optional(),
  exchange: z.string().optional(),
  finnhubIndustry: z.string().optional(),
  ipo: z.string().optional(),
  logo: z.string().optional(),
  marketCapitalization: z.number().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  shareOutstanding: z.number().optional(),
  ticker: z.string().optional(),
  weburl: z.string().optional(),
}).passthrough();

const companyNewsItemSchema = z.object({
  category: z.string().optional(),
  datetime: z.number().optional(),
  headline: z.string().optional(),
  id: z.number().optional(),
  image: z.string().optional(),
  related: z.string().optional(),
  source: z.string().optional(),
  summary: z.string().optional(),
  url: z.string().optional(),
}).passthrough();

const earningsItemSchema = z.object({
  date: z.string().optional(),
  epsActual: z.number().nullable().optional(),
  epsEstimate: z.number().nullable().optional(),
  hour: z.string().optional(),
  quarter: z.number().optional(),
  revenueActual: z.number().nullable().optional(),
  revenueEstimate: z.number().nullable().optional(),
  symbol: z.string().optional(),
  year: z.number().optional(),
}).passthrough();
const earningsSchema = z.object({ earningsCalendar: z.array(earningsItemSchema).optional() }).passthrough();

const recommendationSchema = z.array(z.object({
  buy: z.number().optional(),
  hold: z.number().optional(),
  period: z.string().optional(),
  sell: z.number().optional(),
  strongBuy: z.number().optional(),
  strongSell: z.number().optional(),
  symbol: z.string().optional(),
}).passthrough());

const priceTargetSchema = z.object({
  lastUpdated: z.string().optional(),
  symbol: z.string().optional(),
  targetHigh: z.number().optional(),
  targetLow: z.number().optional(),
  targetMean: z.number().optional(),
  targetMedian: z.number().optional(),
}).passthrough();

const insiderItemSchema = z.object({
  change: z.number().nullable().optional(),
  filingDate: z.string().optional(),
  name: z.string().optional(),
  share: z.number().nullable().optional(),
  symbol: z.string().optional(),
  transactionCode: z.string().optional(),
  transactionDate: z.string().optional(),
  transactionPrice: z.number().nullable().optional(),
}).passthrough();
const insiderSchema = z.object({ data: z.array(insiderItemSchema).optional(), symbol: z.string().optional() }).passthrough();

const economicEventSchema = z.object({
  actual: z.union([z.number(), z.string()]).nullable().optional(),
  country: z.string().optional(),
  estimate: z.union([z.number(), z.string()]).nullable().optional(),
  event: z.string().optional(),
  impact: z.string().optional(),
  prev: z.union([z.number(), z.string()]).nullable().optional(),
  time: z.string().optional(),
  unit: z.string().optional(),
}).passthrough();
const economicSchema = z.object({ economicCalendar: z.array(economicEventSchema).optional() }).passthrough();

const candleSchema = z.object({
  c: z.array(z.number()).optional(),
  h: z.array(z.number()).optional(),
  l: z.array(z.number()).optional(),
  o: z.array(z.number()).optional(),
  s: z.string().optional(),
  t: z.array(z.number()).optional(),
  v: z.array(z.number()).optional(),
}).passthrough();

const socketMessageSchema = z.object({
  type: z.string().optional(),
  data: z.array(z.object({
    s: z.string().optional(), p: z.number().optional(), v: z.number().optional(),
    t: z.number().optional(), c: z.array(z.string()).nullable().optional(),
  }).passthrough()).optional(),
}).passthrough();

export type FinnhubClientErrorCode =
  | "configuration"
  | "invalid_request"
  | "authentication"
  | "not_entitled"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_response"
  | "connection_limit"
  | "symbol_limit"
  | "slow_consumer";

export class FinnhubClientError extends Error {
  constructor(
    readonly code: FinnhubClientErrorCode,
    message: string,
    readonly status: number | null = null,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "FinnhubClientError";
  }
}

export type FinnhubSearchResult = z.infer<typeof searchItemSchema>;
export type FinnhubCompanyProfile = z.infer<typeof profileSchema>;
export type FinnhubCompanyNewsItem = z.infer<typeof companyNewsItemSchema>;
export type FinnhubEarningsItem = z.infer<typeof earningsItemSchema>;
export type FinnhubRecommendation = z.infer<typeof recommendationSchema>[number];
export type FinnhubPriceTarget = z.infer<typeof priceTargetSchema>;
export type FinnhubInsiderTransaction = z.infer<typeof insiderItemSchema>;
export type FinnhubEconomicEvent = z.infer<typeof economicEventSchema>;

type FinnhubRequestOptions = { timeoutMs?: number; maxBytes?: number };

function safeToken(value: string | null | undefined): string | null {
  const token = value?.trim();
  return token ? token : null;
}

export function getFinnhubApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return safeToken(env.FINNHUB_API_KEY);
}

function normalizedSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._:/-]{0,47}$/.test(symbol)) {
    throw new FinnhubClientError("invalid_request", "Ungueltiges Finnhub-Symbol.");
  }
  return symbol;
}

function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new FinnhubClientError("invalid_request", "Datum muss YYYY-MM-DD entsprechen.");
  }
  return value;
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) ? status : null;
}

function errorRetryAfter(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("retryAfterMs" in error)) return null;
  const value = Number((error as { retryAfterMs?: unknown }).retryAfterMs);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function mapRequestError(error: unknown): FinnhubClientError {
  if (error instanceof FinnhubClientError) return error;
  const status = errorStatus(error);
  const retryAfterMs = errorRetryAfter(error);
  if (status === 401) return new FinnhubClientError("authentication", "Finnhub hat den API-Key abgelehnt.", status);
  if (status === 402 || status === 403) return new FinnhubClientError("not_entitled", "Dieser Finnhub-Endpunkt ist im aktiven Tarif nicht freigeschaltet.", status);
  if (status === 404) return new FinnhubClientError("not_found", "Finnhub hat keine Daten fuer diese Anfrage.", status);
  if (status === 429) return new FinnhubClientError("rate_limited", "Finnhub-Rate-Limit erreicht.", status, retryAfterMs);
  if (status !== null && status >= 500) return new FinnhubClientError("unavailable", "Finnhub ist voruebergehend nicht erreichbar.", status);
  return new FinnhubClientError("unavailable", "Finnhub-Anfrage fehlgeschlagen.", status, retryAfterMs);
}

function intervalResolution(interval: BarInterval): string {
  return ({ "1m": "1", "5m": "5", "15m": "15", "30m": "30", "1h": "60", "4h": "240", "1d": "D", "1w": "W", "1mo": "M" } as const)[interval];
}

function intervalDurationMs(interval: BarInterval): number {
  return ({ "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000, "1w": 604_800_000, "1mo": 2_678_400_000 } as const)[interval];
}

export class FinnhubClient {
  private readonly apiKey: string;
  private readonly quality: MarketDataQuality;

  constructor(options: { apiKey?: string | null; quality?: MarketDataQuality } = {}) {
    const apiKey = safeToken(options.apiKey ?? getFinnhubApiKey());
    if (!apiKey) throw new FinnhubClientError("configuration", "FINNHUB_API_KEY fehlt.");
    this.apiKey = apiKey;
    this.quality = options.quality ?? "near_realtime";
  }

  private async request<T>(path: string, params: Record<string, string | number | undefined>, schema: z.ZodType<T>, options: FinnhubRequestOptions = {}) {
    const url = new URL(`https://finnhub.io/api/v1/${path.replace(/^\/+/, "")}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    try {
      const { data, latencyMs } = await fetchBoundedProviderJson<unknown>(url, "Finnhub", {
        timeoutMs: options.timeoutMs ?? 6_500,
        maxBytes: options.maxBytes ?? 2_000_000,
        userAgent: "StockPilotAI/1.0 finnhub-adapter",
        requestHeaders: { "X-Finnhub-Token": this.apiKey },
      });
      if (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string") {
        throw new FinnhubClientError("invalid_request", "Finnhub hat die Anfrage abgelehnt.");
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) throw new FinnhubClientError("invalid_response", "Finnhub-Antwort entspricht nicht dem erwarteten Schema.");
      return { data: parsed.data, latencyMs };
    } catch (error) {
      throw mapRequestError(error);
    }
  }

  async getQuote(symbol: string): Promise<{ quote: FinnhubQuoteSnapshot | null; latencyMs: number }> {
    const { data, latencyMs } = await this.request("quote", { symbol: normalizedSymbol(symbol) }, quoteSchema, { maxBytes: 128_000 });
    return { quote: normalizeFinnhubQuote(data), latencyMs };
  }

  async search(query: string): Promise<FinnhubSearchResult[]> {
    const normalized = query.replace(/[\u0000-\u001F\u007F]/gu, " ").trim().slice(0, 80);
    if (normalized.length < 1) throw new FinnhubClientError("invalid_request", "Suchbegriff fehlt.");
    const { data } = await this.request("search", { q: normalized }, searchSchema);
    return data.result ?? [];
  }

  async getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile | null> {
    const { data } = await this.request("stock/profile2", { symbol: normalizedSymbol(symbol) }, profileSchema);
    return Object.keys(data).length ? data : null;
  }

  async getCompanyNews(symbol: string, from: string, to: string): Promise<FinnhubCompanyNewsItem[]> {
    const { data } = await this.request("company-news", { symbol: normalizedSymbol(symbol), from: dateOnly(from), to: dateOnly(to) }, z.array(companyNewsItemSchema));
    return data;
  }

  async getMarketNews(category: "general" | "forex" | "crypto" | "merger" = "general"): Promise<FinnhubCompanyNewsItem[]> {
    const { data } = await this.request("news", { category }, z.array(companyNewsItemSchema));
    return data;
  }

  async getEarningsCalendar(from: string, to: string, symbol?: string): Promise<FinnhubEarningsItem[]> {
    const { data } = await this.request("calendar/earnings", { from: dateOnly(from), to: dateOnly(to), symbol: symbol ? normalizedSymbol(symbol) : undefined }, earningsSchema);
    return data.earningsCalendar ?? [];
  }

  async getRecommendationTrends(symbol: string): Promise<FinnhubRecommendation[]> {
    const { data } = await this.request("stock/recommendation", { symbol: normalizedSymbol(symbol) }, recommendationSchema);
    return data;
  }

  async getPriceTarget(symbol: string): Promise<FinnhubPriceTarget | null> {
    const { data } = await this.request("stock/price-target", { symbol: normalizedSymbol(symbol) }, priceTargetSchema);
    return Object.keys(data).length ? data : null;
  }

  async getInsiderTransactions(symbol: string, from?: string, to?: string): Promise<FinnhubInsiderTransaction[]> {
    const { data } = await this.request("stock/insider-transactions", { symbol: normalizedSymbol(symbol), from: from ? dateOnly(from) : undefined, to: to ? dateOnly(to) : undefined }, insiderSchema);
    return data.data ?? [];
  }

  async getEconomicCalendar(from: string, to: string): Promise<FinnhubEconomicEvent[]> {
    const { data } = await this.request("calendar/economic", { from: dateOnly(from), to: dateOnly(to) }, economicSchema);
    return data.economicCalendar ?? [];
  }

  async getHistoricalBars(input: { symbol: string; interval: BarInterval; range: ChartRange; from: number; to: number; currency?: string }): Promise<NormalizedBar[]> {
    if (!Number.isSafeInteger(input.from) || !Number.isSafeInteger(input.to) || input.from <= 0 || input.to <= input.from) {
      throw new FinnhubClientError("invalid_request", "Ungueltiger Finnhub-Zeitraum.");
    }
    const symbol = normalizedSymbol(input.symbol);
    const { data } = await this.request("stock/candle", { symbol, resolution: intervalResolution(input.interval), from: input.from, to: input.to }, candleSchema, { maxBytes: 5_000_000 });
    if (data.s === "no_data") return [];
    const length = Math.min(data.c?.length ?? 0, data.h?.length ?? 0, data.l?.length ?? 0, data.o?.length ?? 0, data.t?.length ?? 0, data.v?.length ?? 0);
    const adjusted = input.interval === "1d" || input.interval === "1w" || input.interval === "1mo";
    const rows: CanonicalBarInput[] = Array.from({ length }, (_, index) => {
      const openTimeMs = (data.t?.[index] ?? 0) * 1_000;
      return {
        providerId: "finnhub", providerSymbol: symbol, symbol, venue: null,
        range: input.range, interval: input.interval,
        openTime: new Date(openTimeMs).toISOString(), closeTime: new Date(openTimeMs + intervalDurationMs(input.interval) - 1).toISOString(),
        open: data.o?.[index], high: data.h?.[index], low: data.l?.[index], close: data.c?.[index], volume: data.v?.[index],
        currency: input.currency ?? "XXX", isAdjusted: adjusted,
        adjustmentType: adjusted ? "SPLIT_ADJUSTED" : "RAW",
        adjustedCloseType: adjusted ? "SPLIT_ADJUSTED" : null,
        provider: "Finnhub", providerTimestamp: null, receivedTimestamp: new Date().toISOString(), sessionTimeZone: null,
        quality: "historical", sourceQualityIssues: [adjusted ? "Finnhub-Tageskerzen sind splitbereinigt; Intraday-Kerzen sind unbereinigt." : "Finnhub-Intraday-Kerzen sind unbereinigt."],
      };
    });
    return normalizeBarSeries(rows).bars;
  }

  async healthCheck(): Promise<{ status: "ok" | "degraded"; latencyMs: number; message: string }> {
    const started = Date.now();
    const result = await this.getQuote("AAPL");
    return {
      status: result.quote ? "ok" : "degraded",
      latencyMs: Date.now() - started,
      message: result.quote ? "Finnhub-Quote erreichbar." : "Finnhub erreichbar, aber Testquote leer.",
    };
  }

  get streamQuality(): MarketDataQuality { return this.quality; }
  get tokenForSocket(): string { return this.apiKey; }
}

export function getFinnhubClient(options: { apiKey?: string | null; quality?: MarketDataQuality } = {}): FinnhubClient {
  return new FinnhubClient(options);
}

type SocketEvent = { data?: unknown };
export interface FinnhubSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: (event: SocketEvent) => void): void;
}
export type FinnhubSocketFactory = (url: string) => FinnhubSocketLike;

let streamLeaseActive = false;

function defaultSocketFactory(url: string): FinnhubSocketLike {
  if (typeof WebSocket === "undefined") throw new FinnhubClientError("unavailable", "WebSocket ist in dieser Laufzeit nicht verfuegbar.");
  return new WebSocket(url) as unknown as FinnhubSocketLike;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export async function* streamFinnhubTrades(
  symbols: string[],
  options: {
    signal?: AbortSignal;
    quality?: MarketDataQuality;
    socketFactory?: FinnhubSocketFactory;
    reconnectBaseMs?: number;
    maxQueuedBatches?: number;
    maxSymbols?: number;
    apiKey?: string | null;
    resolveSymbol?: (providerSymbol: string) => string;
  } = {},
): AsyncIterable<NormalizedTrade[]> {
  if (streamLeaseActive) throw new FinnhubClientError("connection_limit", "Finnhub erlaubt pro API-Key nur eine aktive WebSocket-Verbindung.");
  const unique = [...new Set(symbols.map(normalizedSymbol))];
  const maxSymbols = options.maxSymbols ?? positiveInteger(process.env.FINNHUB_STREAM_MAX_SYMBOLS, 30);
  if (unique.length > maxSymbols) throw new FinnhubClientError("symbol_limit", `Finnhub-Stream ist auf ${maxSymbols} Symbole begrenzt.`);
  if (unique.length === 0) return;
  const client = getFinnhubClient({ apiKey: options.apiKey, quality: options.quality });
  const socketFactory = options.socketFactory ?? defaultSocketFactory;
  const maxQueuedBatches = options.maxQueuedBatches ?? 32;
  let reconnectAttempt = 0;
  streamLeaseActive = true;

  try {
    while (!options.signal?.aborted) {
      const queue: NormalizedTrade[][] = [];
      let closed = false;
      let terminalError: FinnhubClientError | null = null;
      let wake: (() => void) | null = null;
      const socket = socketFactory(`wss://ws.finnhub.io?token=${encodeURIComponent(client.tokenForSocket)}`);
      const wakeReader = () => { wake?.(); wake = null; };
      const abort = () => { closed = true; socket.close(1000, "aborted"); wakeReader(); };
      options.signal?.addEventListener("abort", abort, { once: true });

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        for (const symbol of unique) socket.send(JSON.stringify({ type: "subscribe", symbol }));
      });
      socket.addEventListener("message", (event) => {
        try {
          const raw = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          const parsed = socketMessageSchema.safeParse(raw);
          if (!parsed.success || parsed.data.type !== "trade") return;
          const receivedAt = new Date();
          const trades = (parsed.data.data ?? []).flatMap((trade: FinnhubTradePayload) => {
            const normalized = normalizeFinnhubTrade(trade, {
              quality: client.streamQuality,
              receivedAt,
              resolveSymbol: options.resolveSymbol,
            });
            return normalized ? [normalized] : [];
          });
          if (!trades.length) return;
          if (queue.length >= maxQueuedBatches) {
            terminalError = new FinnhubClientError("slow_consumer", "Finnhub-Trade-Stream wurde wegen Rueckstau beendet.");
            closed = true;
            socket.close(1013, "slow consumer");
          } else queue.push(trades);
          wakeReader();
        } catch {
          // Einzelne ungueltige Provider-Nachrichten werden verworfen.
        }
      });
      socket.addEventListener("close", () => { closed = true; wakeReader(); });
      socket.addEventListener("error", () => { closed = true; socket.close(1011, "provider error"); wakeReader(); });

      while (!options.signal?.aborted && (!closed || queue.length > 0)) {
        if (queue.length > 0) {
          yield queue.shift() as NormalizedTrade[];
          continue;
        }
        await new Promise<void>((resolve) => { wake = resolve; });
      }
      options.signal?.removeEventListener("abort", abort);
      if (terminalError) throw terminalError;
      if (options.signal?.aborted) break;
      reconnectAttempt += 1;
      const delay = Math.min((options.reconnectBaseMs ?? 500) * 2 ** Math.min(reconnectAttempt - 1, 5), 15_000);
      await wait(delay, options.signal);
    }
  } finally {
    streamLeaseActive = false;
  }
}
