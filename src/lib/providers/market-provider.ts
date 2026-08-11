import { NO_INDICATORS, buildTechnicalIndicators } from "@/lib/analysis/technical";
import { selectVerifiedFundamentals } from "@/lib/analysis/verified-fundamentals";
import {
  buildEvidenceBoundScores,
  buildQuoteOnlyScoreEvidence,
  professionalScoresFromEvidence,
  scoresFromEvidence
} from "@/lib/analysis/evidence-scores";

import { buildRiskReport } from "@/lib/risk-engine";

import { getMockAsset, getMockDashboard } from "@/lib/mock/market";
import { getNewsWithMetadata } from "@/lib/providers/news-provider";
import { getFundamentalsWithMetadata, type FundamentalsProviderMetadata } from "@/lib/providers/fundamentals-provider";
import { logEvent } from "@/lib/observability";
import { resolveQuoteChain } from "@/lib/providers/quote-chain";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { NO_HISTORY, fetchDailyHistory, sliceHistoryRanges, type HistoryResult } from "@/lib/providers/price-history";
import { getServerCacheAdapter } from "@/lib/server-cache";
import { buildVerifiedProviderDashboard } from "@/lib/provider-dashboard";
import { developmentFixturesAllowed } from "@/lib/runtime-data-policy";
import { safeDecodeURIComponent } from "@/lib/validation";
import type {
  Asset,
  AiAnalysis,
  AnalysisLayer,
  AssetDetail,
  AssetSummary,
  Candle,
  DashboardData,
  DataQualityReport,
  MarketDataQuality,
  MarketStatus,
  MacroFactor,
  NewsItem,
  NormalizedQuote,
  ProfessionalScores,
  TechnicalIndicators,
  TimeRange
} from "@/lib/types";

// Die Kennung lebt in `quote-chain.ts` und wird hier nur weitergereicht,
// damit bestehende Importe unveraendert funktionieren.
export type { MarketProviderId } from "@/lib/providers/quote-chain";
import type { MarketProviderId } from "@/lib/providers/quote-chain";

export type StreamMode = "provider_websocket" | "rest_polling" | "mock_stream";

export interface MarketStreamOptions {
  signal?: AbortSignal;
  intervalMs?: number;
}

export interface RealtimeProvider {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;
  streamQuotes(symbols: string[], options?: MarketStreamOptions): AsyncIterable<NormalizedQuote[]>;
}

export interface NearRealtimeProvider {
  getQuote(symbol: string): Promise<NormalizedQuote | null>;
  getQuotes(symbols: string[]): Promise<NormalizedQuote[]>;
}

export interface DelayedProvider {
  getDelayedQuote(symbol: string): Promise<NormalizedQuote | null>;
}

export interface HistoricalProvider {
  getCandles(symbol: string, interval: "1m" | "5m" | "15m" | "1h" | "1d"): Promise<Candle[]>;
}

export interface MarketDataProvider extends RealtimeProvider, NearRealtimeProvider, DelayedProvider, HistoricalProvider {
  getDashboard(): Promise<DashboardData>;
  getAsset(symbol: string): Promise<AssetDetail | null>;
}

type QuoteProvider = NearRealtimeProvider & {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;
  streamQuotes?: (symbols: string[], options?: MarketStreamOptions) => AsyncIterable<NormalizedQuote[]>;
};

class ProviderConfigurationError extends Error {}
class ProviderHttpError extends Error {
  constructor(
    readonly providerName: string,
    readonly status: number,
    readonly retryAfterMs?: number
  ) {
    super(`${providerName} HTTP ${status}`);
  }
}

class ProviderRateLimitBackoffError extends Error {}
class ProviderAccessUnavailableError extends Error {}

const DEFAULT_STREAM_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 40;
const DEFAULT_DASHBOARD_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "AMZN",
  "GOOGL",
  "META",
  "JPM",
  "XOM",
  "LLY",
  "SPY",
  "QQQ",
  "VOO",
  "BTC-USD",
  "ETH-USD"
];
const DETAIL_RANGES = ["1D", "5D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
const DEFAULT_QUOTE_CACHE_TTL_MS = Math.max(5000, Number(process.env.STOCKPILOT_QUOTE_CACHE_TTL_MS) || 30000);
const DEFAULT_CRYPTO_QUOTE_CACHE_TTL_MS = Math.max(1000, Number(process.env.STOCKPILOT_CRYPTO_QUOTE_CACHE_TTL_MS) || 3000);
const DEFAULT_STALE_QUOTE_CACHE_TTL_MS = Math.max(
  DEFAULT_QUOTE_CACHE_TTL_MS,
  Number(process.env.STOCKPILOT_STALE_QUOTE_CACHE_TTL_MS) || 300000
);
const DEFAULT_RATE_LIMIT_BACKOFF_MS = Math.max(10000, Number(process.env.STOCKPILOT_RATE_LIMIT_BACKOFF_MS) || 60000);
const DEFAULT_PROVIDER_CONCURRENCY = Math.max(
  1,
  Math.min(10, Number(process.env.STOCKPILOT_PROVIDER_CONCURRENCY) || 6)
);
const DEFAULT_DASHBOARD_QUOTE_TIMEOUT_MS = Math.max(
  150,
  Number(process.env.STOCKPILOT_DASHBOARD_QUOTE_TIMEOUT_MS) || 650
);
const DEFAULT_ASSET_QUOTE_TIMEOUT_MS = Math.max(
  250,
  Number(process.env.STOCKPILOT_ASSET_QUOTE_TIMEOUT_MS) || 900
);

type QuoteCacheEntry = {
  quote: NormalizedQuote;
  storedAtMs: number;
  ttlMs: number;
  staleTtlMs: number;
};

const quoteCache = new Map<string, QuoteCacheEntry>();
const quoteSharedCache = getServerCacheAdapter();
const inFlightQuoteRequests = new Map<string, Promise<NormalizedQuote | null>>();
const inFlightPollingBatches = new Map<string, Promise<NormalizedQuote[]>>();
const providerRateLimitUntil = new Map<MarketProviderId, number>();
const providerSymbolAccessDeniedUntil = new Map<string, number>();

function nowIso() {
  return new Date().toISOString();
}

async function withDeadline<T>(operation: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function calculateChange(price: number, previousClose?: number, explicitChange?: number) {
  if (explicitChange !== undefined) return explicitChange;
  if (!previousClose) return 0;
  return Number((price - previousClose).toFixed(4));
}

function calculateChangePercent(price: number, previousClose?: number, explicitPercent?: number) {
  if (explicitPercent !== undefined) return explicitPercent;
  if (!previousClose) return 0;
  return Number((((price - previousClose) / previousClose) * 100).toFixed(4));
}

function normalizeMarketStatus(value: unknown): MarketStatus {
  const status = String(value ?? "unknown").toLowerCase();

  if (status.includes("pre")) return "pre_market";
  if (status.includes("after") || status.includes("post") || status.includes("extended")) return "after_hours";
  if (status.includes("open")) return "open";
  if (status.includes("closed")) return "closed";
  return "unknown";
}

function inferAssetType(symbol: string, fallback?: Asset["type"]): Asset["type"] {
  if (fallback) return fallback;
  if (/^[A-Z]{6}$/.test(symbol) && symbol.endsWith("USD")) return "forex";
  if (symbol.includes("-USD") || symbol.includes("/USD")) return "crypto";
  if (symbol.startsWith("^") || symbol.startsWith("I:")) return "index";
  return "stock";
}

function symbolForProvider(symbol: string, provider: MarketProviderId) {
  const normalized = safeDecodeURIComponent(symbol).trim().toUpperCase();

  if (provider === "binance") {
    return normalized.replace("-USD", "USDT").replace("/", "");
  }

  if (provider === "coinbase") {
    return normalized.replace("/", "-");
  }

  if (provider === "finnhub" && normalized.endsWith("-USD")) {
    return `BINANCE:${normalized.replace("-USD", "USDT")}`;
  }

  if (provider === "twelve_data" && normalized.endsWith("-USD")) {
    return normalized.replace("-USD", "/USD");
  }

  return normalized;
}

function isCryptoSymbol(symbol: string) {
  const normalized = safeDecodeURIComponent(symbol).trim().toUpperCase();
  return normalized.includes("-USD") || normalized.includes("/USD") || normalized.endsWith("USDT");
}

function envQuality(name: string, fallback: MarketDataQuality) {
  const value = process.env[name] as MarketDataQuality | undefined;
  const allowed: MarketDataQuality[] = ["realtime", "near_realtime", "delayed", "historical", "mock", "unavailable"];
  return value && allowed.includes(value) ? value : fallback;
}

function isRateLimitError(error: unknown) {
  if (error instanceof ProviderHttpError) return error.status === 429 || error.status === 418;
  return /HTTP (429|418)/.test(error instanceof Error ? error.message : String(error));
}

function isProviderAccessError(error: unknown) {
  if (error instanceof ProviderHttpError) return error.status === 402 || error.status === 403;
  return false;
}

function quoteCacheKey(provider: QuoteProvider, symbol: string) {
  return `${provider.providerId}:${symbolForProvider(symbol, provider.providerId)}`;
}

function quoteSharedCacheKey(key: string) {
  return `quote:${key}`;
}

function providerBackoffCacheKey(provider: QuoteProvider) {
  return `provider-backoff:${provider.providerId}`;
}

function quoteCacheTtlFor(provider: QuoteProvider) {
  return provider.providerId === "binance" || provider.providerId === "coinbase"
    ? DEFAULT_CRYPTO_QUOTE_CACHE_TTL_MS
    : DEFAULT_QUOTE_CACHE_TTL_MS;
}

function markServerCachedQuote(quote: NormalizedQuote) {
  return {
    ...quote,
    provider: quote.provider.includes("Server-Cache") ? quote.provider : `${quote.provider} (Server-Cache)`,
    latencyMs: 0
  };
}

function startProviderBackoff(provider: QuoteProvider, error: unknown) {
  const retryAfterMs = error instanceof ProviderHttpError ? error.retryAfterMs : undefined;
  const backoffMs = Math.max(10000, retryAfterMs ?? DEFAULT_RATE_LIMIT_BACKOFF_MS);
  const now = Date.now();
  const currentUntil = providerRateLimitUntil.get(provider.providerId) ?? 0;
  const nextUntil = Math.max(currentUntil, now + backoffMs);
  providerRateLimitUntil.set(provider.providerId, nextUntil);
  void quoteSharedCache.set(providerBackoffCacheKey(provider), nextUntil, Math.max(1, nextUntil - now));

  if (currentUntil <= now) {
    logEvent("warn", "market_provider.rate_limit_backoff", {
      provider: provider.providerName,
      retryInMs: nextUntil - now
    });
  }
}

async function getCachedProviderQuote(provider: QuoteProvider, symbol: string) {
  const normalizedSymbol = uniqueSymbols([symbol])[0];
  if (!normalizedSymbol) return null;

  const key = quoteCacheKey(provider, normalizedSymbol);
  const now = Date.now();
  let cached = quoteCache.get(key);

  if (!cached) {
    cached = await quoteSharedCache.get<QuoteCacheEntry>(quoteSharedCacheKey(key)) ?? undefined;
    if (cached) quoteCache.set(key, cached);
  }

  if (cached && now - cached.storedAtMs < cached.ttlMs) {
    return markServerCachedQuote(cached.quote);
  }

  const sharedBackoffUntil = await quoteSharedCache.get<number>(providerBackoffCacheKey(provider));
  const backoffUntil = Math.max(providerRateLimitUntil.get(provider.providerId) ?? 0, sharedBackoffUntil ?? 0);
  if (backoffUntil > now) {
    if (cached && now - cached.storedAtMs < cached.staleTtlMs) {
      return markServerCachedQuote(cached.quote);
    }

    throw new ProviderRateLimitBackoffError(`${provider.providerName} rate-limit backoff active`);
  }

  const accessDeniedUntil = providerSymbolAccessDeniedUntil.get(key) ?? 0;
  if (accessDeniedUntil > now) {
    if (cached && now - cached.storedAtMs < cached.staleTtlMs) {
      return markServerCachedQuote(cached.quote);
    }

    throw new ProviderAccessUnavailableError(`${provider.providerName} access unavailable for ${normalizedSymbol}`);
  }

  const inFlight = inFlightQuoteRequests.get(key);
  if (inFlight) return inFlight;

  const request = provider
    .getQuote(normalizedSymbol)
    .then(async (quote) => {
      if (quote) {
        const entry: QuoteCacheEntry = {
          quote,
          storedAtMs: Date.now(),
          ttlMs: quoteCacheTtlFor(provider),
          staleTtlMs: DEFAULT_STALE_QUOTE_CACHE_TTL_MS
        };

        quoteCache.set(key, entry);
        await quoteSharedCache.set(quoteSharedCacheKey(key), entry, entry.staleTtlMs);
      }

      return quote;
    })
    .catch((error) => {
      if (isRateLimitError(error)) {
        startProviderBackoff(provider, error);

        if (cached && now - cached.storedAtMs < cached.staleTtlMs) {
          return markServerCachedQuote(cached.quote);
        }

        throw new ProviderRateLimitBackoffError(`${provider.providerName} rate-limit backoff active`);
      }

      if (isProviderAccessError(error)) {
        providerSymbolAccessDeniedUntil.set(key, Date.now() + Math.max(DEFAULT_STALE_QUOTE_CACHE_TTL_MS, 3600000));

        if (cached && now - cached.storedAtMs < cached.staleTtlMs) {
          return markServerCachedQuote(cached.quote);
        }

        throw new ProviderAccessUnavailableError(`${provider.providerName} access unavailable for ${normalizedSymbol}`);
      }

      throw error;
    })
    .finally(() => {
      inFlightQuoteRequests.delete(key);
    });

  inFlightQuoteRequests.set(key, request);
  return request;
}

async function getCachedProviderQuotes(provider: QuoteProvider, symbols: string[]) {
  const normalizedSymbols = uniqueSymbols(symbols);
  const results: Array<NormalizedQuote | null> = Array.from({ length: normalizedSymbols.length }, () => null);
  let cursor = 0;

  async function worker() {
    while (cursor < normalizedSymbols.length) {
      const index = cursor;
      cursor += 1;
      const symbol = normalizedSymbols[index];

      try {
        results[index] = await getCachedProviderQuote(provider, symbol);
      } catch (error) {
        if (
          !(error instanceof ProviderConfigurationError) &&
          !(error instanceof ProviderRateLimitBackoffError) &&
          !(error instanceof ProviderAccessUnavailableError)
        ) {
          logEvent("error", "market_provider.quote_failed", { provider: provider.providerName, symbol, error });
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DEFAULT_PROVIDER_CONCURRENCY, normalizedSymbols.length) }, () => worker())
  );

  return results.filter((quote): quote is NormalizedQuote => Boolean(quote));
}

async function fetchJson<T>(url: URL, providerName: string, timeoutMs = 4500): Promise<{ data: T; latencyMs: number }> {
  try {
    return await fetchBoundedProviderJson<T>(url, providerName, {
      timeoutMs,
      userAgent: "StockPilotAI/0.1 market-data-layer"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = Number(message.match(/\bHTTP\s+(\d{3})\b/)?.[1]);

    if (Number.isFinite(status)) {
      throw new ProviderHttpError(providerName, status, undefined);
    }

    throw error;
  }
}

function toNormalizedQuote(input: {
  symbol: string;
  name?: string;
  assetType?: Asset["type"];
  price: number;
  currency?: string;
  change?: number;
  changePercent?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  freeFloat?: number;
  exchange?: string;
  timestamp?: string;
  provider: string;
  quality: MarketDataQuality;
  latencyMs?: number;
  marketStatus?: MarketStatus;
}): NormalizedQuote {
  const previousClose = input.previousClose;
  const change = calculateChange(input.price, previousClose, input.change);
  const changePercent = calculateChangePercent(input.price, previousClose, input.changePercent);

  return {
    symbol: input.symbol.toUpperCase(),
    name: input.name,
    assetType: inferAssetType(input.symbol, input.assetType),
    price: Number(input.price.toFixed(6)),
    currency: input.currency ?? "USD",
    change: Number(change.toFixed(6)),
    changePercent: Number(changePercent.toFixed(4)),
    bid: input.bid,
    ask: input.ask,
    spread:
      input.bid !== undefined && input.ask !== undefined
        ? Number(Math.max(0, input.ask - input.bid).toFixed(6))
        : undefined,
    volume: input.volume,
    high: input.high,
    low: input.low,
    open: input.open,
    previousClose,
    fiftyTwoWeekHigh: input.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: input.fiftyTwoWeekLow,
    marketCap: input.marketCap,
    freeFloat: input.freeFloat,
    exchange: input.exchange,
    timestamp: input.timestamp ?? nowIso(),
    provider: input.provider,
    quality: input.quality,
    latencyMs: input.latencyMs,
    marketStatus: input.marketStatus ?? "unknown"
  };
}

function normalizedFromDetail(detail: AssetDetail | AssetSummary): NormalizedQuote {
  return toNormalizedQuote({
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    assetType: detail.asset.type,
    price: detail.quote.price,
    currency: detail.asset.currency,
    change: detail.quote.change,
    changePercent: detail.quote.changePercent,
    bid: detail.quote.bid,
    ask: detail.quote.ask,
    volume: detail.quote.volume,
    high: detail.quote.dayHigh,
    low: detail.quote.dayLow,
    open: detail.quote.open,
    previousClose: detail.quote.previousClose,
    fiftyTwoWeekHigh: detail.quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: detail.quote.fiftyTwoWeekLow,
    marketCap: "fundamentals" in detail ? detail.fundamentals.marketCap : undefined,
    exchange: detail.asset.exchange,
    timestamp: detail.quote.asOf,
    provider: detail.quote.provider,
    quality: detail.quote.quality,
    latencyMs: detail.quote.latencyMs,
    marketStatus: detail.quote.marketStatus
  });
}

function sectorForQuote(quote: NormalizedQuote) {
  if (quote.assetType === "crypto") return "Digital Asset";
  if (quote.assetType === "etf") return "ETF / Fonds";
  if (quote.assetType === "index") return "Index / Benchmark";
  if (quote.assetType === "forex") return "Devisen";
  return "Aktie";
}

function summaryFromNormalizedQuote(quote: NormalizedQuote): AssetSummary {
  const summary = {
    asset: {
      symbol: quote.symbol,
      name: quote.name ?? quote.symbol,
      type: quote.assetType,
      exchange: quote.exchange ?? (quote.assetType === "crypto" ? "Crypto" : "Provider"),
      currency: quote.currency,
      sector: sectorForQuote(quote),
      description:
        "Aus dem aktiven Marktdatenanbieter normalisiert. Detaildaten hängen von Provider, Tarif und Börsenlizenz ab."
    },
    quote: {
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      dayHigh: quote.high ?? quote.price,
      dayLow: quote.low ?? quote.price,
      volume: quote.volume ?? 0,
      delayedByMinutes: quote.quality === "delayed" ? 15 : 0,
      asOf: quote.timestamp,
      bid: quote.bid,
      ask: quote.ask,
      spread: quote.spread,
      open: quote.open,
      previousClose: quote.previousClose,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      provider: quote.provider,
      quality: quote.quality,
      latencyMs: quote.latencyMs,
      marketStatus: quote.marketStatus
    },
    scores: { trend: 0, news: 0, fundamental: 0, technical: 0, risk: 0, total: 0 },
    aiRisk: "hoch" as const
  };
  const scoreEvidence = buildQuoteOnlyScoreEvidence(summary.quote);
  return { ...summary, scores: scoresFromEvidence(scoreEvidence), scoreEvidence };
}

/**
 * Leere Zeitfenster.
 *
 * Hier stand `candlesFromQuote`: aus einem einzelnen Kurs wurden 32 Kerzen je
 * Zeitfenster mit einer Sinusfunktion erzeugt. Die Risiko-Engine las daraus
 * Momentum und Volumentrend und erzeugte Befunde mit Belegen — erfundene Daten,
 * die als Analyseergebnis auftraten.
 *
 * Echte Historie kommt jetzt aus `price-history.ts`. Wenn keine verfügbar ist,
 * bleibt es leer.
 */
function emptyCandleRanges(): Record<TimeRange, Candle[]> {
  return Object.fromEntries(DETAIL_RANGES.map((range) => [range, [] as Candle[]])) as Record<
    TimeRange,
    Candle[]
  >;
}

/**
 * Aus einem einzelnen Kurs lassen sich keine Indikatoren berechnen.
 *
 * Hier stand vorher der Versuch, es trotzdem zu tun:
 *
 * ```
 * rsi = 50 + Vorzeichen × min(24, |Tagesveränderung| × 4)
 * macd.value = Vorzeichen × Kurs × 0,004
 * ma200 = Kurs × (1 − Vorzeichen × 0,018)
 * ```
 *
 * Das ist kein RSI, sondern die Tagesveränderung in anderer Skala. Ein MACD,
 * der proportional zum Kursniveau ist, sagt über Momentum nichts aus — und ein
 * „MA 200" aus einem einzigen Kurswert ist eine Behauptung über 200 Perioden,
 * von denen genau null vorlagen.
 *
 * §90 verbietet Funktionsfassaden. Der ehrliche Rückgabewert ist deshalb: nichts.
 * Sobald dieser Pfad echte Historie bekommt, ersetzt `buildTechnicalIndicators`
 * die Zeile — die Kerzen aus `candlesFromQuote` reichen dafür nicht, weil sie
 * selbst aus dem Kurs erzeugt sind.
 */
function indicatorsFromQuote(_quote: NormalizedQuote): TechnicalIndicators {
  return NO_INDICATORS;
}

function providerOnlyDataQuality(quote: NormalizedQuote): DataQualityReport {
  const isCurrent = quote.quality === "realtime" || quote.quality === "near_realtime";
  const isDelayed = quote.quality === "delayed" || quote.quality === "historical";
  const unavailable = quote.quality === "unavailable";

  return {
    score: unavailable ? 18 : isCurrent ? 62 : 45,
    freshness: unavailable ? "stale" : isDelayed ? "delayed" : "fresh",
    sourceLabel: quote.quality === "near_realtime" ? "Near-Realtime-Daten" : quote.quality,
    isMock: false,
    updatedAt: quote.timestamp,
    stale: unavailable,
    sufficientForAnalysis: false,
    confidence: unavailable ? 12 : isCurrent ? 45 : 32,
    issues: [
      "Für eine belastbare Einschätzung liegen derzeit nicht genügend verifizierte Fundamentaldaten, News und historische Kerzen vor."
    ],
    warnings: [
      "Diese Detailseite basiert auf einem normalisierten Provider-Quote und zeigt fehlende Analysebereiche bewusst als Datenlücke.",
      ...(isDelayed ? ["Kursdaten sind verzögert oder historisch und nicht als Live-Signal geeignet."] : [])
    ],
    contradictions: [],
    sources: [
      {
        name: quote.provider,
        type: "provider",
        rank: 5,
        fetchedAt: quote.timestamp,
        status: unavailable ? "missing" : isDelayed ? "delayed" : "fresh",
        note: "Serverseitig normalisierter Quote. Keine API-Keys im Frontend."
      },
      {
        name: "StockPilot Analysis Guard",
        type: "derived",
        rank: 4,
        fetchedAt: quote.timestamp,
        status: "missing",
        note: "Fundamentaldaten, News, Analystenfelder und echte historische Kerzen sind für dieses Symbol noch nicht ausreichend verifiziert."
      }
    ]
  };
}

/**
 * Detailansicht aus einem Provider-Kurs — jetzt mit echter Historie, wenn es
 * sie gibt.
 *
 * `history` ist bewusst ein Parameter und wird nicht hier geholt: so bleibt die
 * Funktion ohne Netzzugriff prüfbar, und der Aufrufer entscheidet über das
 * Zeitlimit.
 */
/**
 * Holt echte Nachrichten — und nur echte.
 *
 * `getNewsWithMetadata` fällt am Ende auf `getMockNews()` zurück. Dieser
 * Rückfall ist für `/api/news` gedacht, wo er als Demoquelle gekennzeichnet
 * wird; im Analysepfad wäre er ein §61-Verstoß. Übernommen wird deshalb nur,
 * was **nicht** als `quality: "mock"` gekennzeichnet ist.
 *
 * Wirft nicht: eine nicht erreichbare Nachrichtenquelle darf die Asset-Seite
 * nicht abbrechen. Sie darf aber auch nicht durch erfundene Meldungen ersetzt
 * werden.
 */
async function realNewsFor(symbol: string): Promise<NewsItem[]> {
  try {
    const { news, metadata } = await getNewsWithMetadata(symbol);
    if (metadata.quality === "mock") return [];
    return news;
  } catch (error) {
    logEvent("warn", "market_provider.news_failed", {
      symbol,
      message: error instanceof Error ? error.message : "unknown"
    });
    return [];
  }
}

function detailFromProviderQuote(
  quote: NormalizedQuote,
  history: HistoryResult = NO_HISTORY,
  news: NewsItem[] = [],
  fundamentalsResult: {
    fundamentals: AssetDetail["fundamentals"] | null;
    metadata: FundamentalsProviderMetadata;
  } | null = null
): AssetDetail {
  const summary = summaryFromNormalizedQuote(quote);
  const candles = history.candles.length ? sliceHistoryRanges(history.candles) : emptyCandleRanges();
  // Indikatoren nur aus echter Historie. Ohne sie bleibt es bei Luecken statt
  // bei Zahlen, die aus dem Tageskurs abgeleitet waeren.
  const indicators = history.candles.length
    ? buildTechnicalIndicators(history.candles)
    : indicatorsFromQuote(quote);
  const { fundamentals, evidence: fundamentalsEvidence } = selectVerifiedFundamentals(
    fundamentalsResult,
    {
      value: quote.marketCap,
      provider: quote.provider,
      quality: quote.quality,
      fetchedAt: quote.timestamp
    }
  );
  const scoreEvidence = buildEvidenceBoundScores({
    quote: summary.quote,
    candles: history.candles,
    indicators,
    fundamentals,
    fundamentalsEvidence,
    news,
    historyProvider: history.provider
  });
  const scoredSummary: AssetSummary = {
    ...summary,
    scores: scoresFromEvidence(scoreEvidence),
    scoreEvidence
  };
  const professionalScores = professionalScoresFromEvidence(scoreEvidence);
  const dataQuality = assessProviderEvidence({
    quote,
    history,
    news,
    fundamentals: fundamentalsEvidence,
    base: providerOnlyDataQuality(quote)
  });
  const historyConfirmed =
    history.candles.length >= 60 && history.integrity?.backtestStatus !== "blocked";
  const newsConfirmed = news.length > 0;
  const analysisLayers: AnalysisLayer[] = [
    {
      label: "Kursdaten",
      value: quote.quality,
      status: quote.changePercent >= 0 ? "positive" : "negative",
      detail: "Normalisierter Provider-Quote mit ausgewiesenem Qualitäts- und Verzögerungsstatus.",
      source: quote.provider,
      updatedAt: quote.timestamp
    },
    {
      label: "Historische Evidenz",
      value: historyConfirmed ? `${history.candles.length} Kerzen` : "nicht ausreichend",
      status: historyConfirmed ? "positive" : "risk",
      detail: historyConfirmed
        ? `${history.candles.length} verwertbare Provider-Kerzen bilden die technische Analysebasis. ${history.note}`
        : `Für eine belastbare technische Analyse fehlen ausreichend verifizierte Kerzen. ${history.note}`,
      source: history.provider ?? "StockPilot Analysis Guard",
      updatedAt: history.integrity?.dataCutoff ?? quote.timestamp
    },
    {
      label: "News-Evidenz",
      value: newsConfirmed ? `${news.length} Meldung(en)` : "nicht verfügbar",
      status: newsConfirmed ? "neutral" : "risk",
      detail: newsConfirmed
        ? "Externe Meldungen mit Quelle, Link und Veröffentlichungszeitpunkt sind angebunden."
        : "Keine verifizierten externen Meldungen für diese Analyse verfügbar.",
      source: newsConfirmed ? news[0].source : "StockPilot Analysis Guard",
      updatedAt: newsConfirmed ? news[0].publishedAt : quote.timestamp
    },
    {
      label: "Fundamentaldaten",
      value:
        fundamentalsEvidence.verifiedCount > 0
          ? `${fundamentalsEvidence.verifiedCount}/${fundamentalsEvidence.totalFields} Felder`
          : "nicht verifiziert",
      status:
        fundamentalsEvidence.verifiedCount === fundamentalsEvidence.totalFields
          ? "positive"
          : fundamentalsEvidence.verifiedCount > 0
            ? "neutral"
            : "risk",
      detail:
        fundamentalsEvidence.verifiedCount > 0
          ? `${fundamentalsEvidence.coveragePercent} % der definierten Fundamentals-Felder sind durch Anbieterwerte belegt. Mock-/Fallback-Felder bleiben ausgeschlossen.`
          : "Im aktiven Asset-Analysepfad liegen keine verifizierten Fundamentaldaten vor; es werden keine Ersatzwerte erfunden.",
      source: fundamentalsEvidence.provider,
      updatedAt: fundamentalsEvidence.fetchedAt
    }
  ];
  const macroFactors: MacroFactor[] = [
    {
      label: "Makro-Kontext",
      impact: "neutral",
      detail: "Makro- und Branchenfaktoren sind für dieses Symbol noch nicht quellenbasiert verknüpft.",
      source: "StockPilot Analysis Guard"
    }
  ];
  /**
   * Der Risikobericht kommt aus der Engine, nicht aus einer Konstante.
   *
   * Hier stand ein fest verdrahteter Bericht: Score 82, Level „hoch", eine
   * einzige Feststellung — für **jedes** Symbol dieselbe. Ein Risiko-Score, der
   * sich nie ändert, sieht aus wie eine Messung und ist eine Konstante.
   *
   * Aufgefallen ist das erst durch einen Nebeneffekt meiner eigenen Änderung:
   * `buildRiskReport` wurde ausschließlich aus `mock/market.ts` aufgerufen. Als
   * das Mock-Gerüst aus `getAsset` verschwand, fiel damit auch die Risiko-Engine
   * aus der Anwendung — 278 Zeilen geprüfter Rechnung, die niemand mehr
   * erreichte.
   *
   * Die Engine kommt mit dünner Datenlage zurecht; genau dafür ist sie gebaut.
   * Fehlt die Historie, meldet sie „Keine belastbare Kurshistorie" als eigenen
   * Befund — statt zu schweigen und damit ein Instrument ohne Daten wie eines
   * ohne Risiken aussehen zu lassen.
   */
  const riskReport = buildRiskReport(
    {
      asset: scoredSummary.asset,
      quote: scoredSummary.quote,
      candles,
      indicators,
      news,
      earningsDate: null,
      professionalScores,
      analysisLayers,
      macroFactors
    },
    dataQuality
  );
  const aiAnalysis: AiAnalysis = {
    summary:
      "Für dieses Symbol reicht die verifizierte Datenbasis derzeit nicht für eine belastbare probabilistische Einschätzung.",
    upsideDrivers: ["Aktueller Kurs und Tagesbewegung sind verfügbar."],
    downsideDrivers: ["Wesentliche Analysequellen fehlen oder sind nicht verifiziert."],
    counterArguments: ["Ein einzelner Quote reicht nicht für eine robuste Chancen-/Risikoanalyse."],
    dataGaps: [
      ...(fundamentalsEvidence.verifiedCount === 0
        ? ["Fundamentaldaten fehlen."]
        : fundamentalsEvidence.verifiedCount < fundamentalsEvidence.totalFields
          ? [`Fundamentaldaten sind nur teilweise belegt (${fundamentalsEvidence.verifiedCount}/${fundamentalsEvidence.totalFields}).`]
          : []),
      ...(newsConfirmed ? [] : ["Unternehmensnachrichten fehlen."]),
      ...(historyConfirmed ? [] : ["Ausreichende historische Provider-Kerzen fehlen."]),
      "Analysten-, Insider- und Eventdaten fehlen."
    ],
    bullCase: "Nicht belastbar ableitbar, bis zusätzliche Quellen verifiziert sind.",
    bearCase: "Nicht belastbar ableitbar, bis zusätzliche Quellen verifiziert sind.",
    neutralCase: "Beobachten, Datenabdeckung prüfen und keine Signale aus einem Einzelquote ableiten.",
    shortTerm: "Nur Kursstatus sichtbar; Einschätzung mit niedriger Konfidenz.",
    mediumTerm: "Nicht ausreichend belastbar.",
    longTerm: "Nicht ausreichend belastbar.",
    riskLevel: "hoch",
    uncertainty: "hoch",
    probabilities: {
      up: 0,
      down: 0,
      sideways: 0
    },
    sources: dataQuality.sources.map((source) => source.name),
    weakDataWarning:
      "Für eine belastbare Einschätzung liegen derzeit nicht genügend verifizierte Daten vor.",
    modelNote:
      "Modellbasierte Einordnung aus begrenzten Provider-Kursdaten. Keine Garantie und keine Anlageberatung."
  };

  const detail: AssetDetail = {
    ...scoredSummary,
    aiRisk: riskReport.level,
    candles,
    indicators,
    fundamentals,
    fundamentalsEvidence,
    news,
    aiAnalysis,
    professionalScores,
    dataQuality,
    riskReport,
    analysisLayers,
    macroFactors,
    analystOpinion: null,
    insiderActivity: [],
    earningsDate: null
  };
  const evidenceAnalysis = buildEvidenceBoundAnalysis(detail);
  const evidenceScores: ProfessionalScores = evidenceAnalysis
    ? {
        ...professionalScores,
        probabilityUp: evidenceAnalysis.probabilities.up,
        probabilityDown: evidenceAnalysis.probabilities.down,
        probabilitySideways: evidenceAnalysis.probabilities.sideways,
        explanation: [
          "Wahrscheinlichkeiten basieren auf verifizierter Historie, gemessener Rendite und Volatilität.",
          fundamentalsEvidence.verifiedCount > 0
            ? `${fundamentalsEvidence.verifiedCount} Fundamentals-Feld(er) sind belegt; die Wahrscheinlichkeiten bleiben technisch und verwenden sie nicht als Kursprognose.`
            : "Fundamentaldaten fehlen weiterhin; die Einordnung ist auf technische Evidenz begrenzt."
        ]
      }
    : {
        ...professionalScores,
        probabilityUp: 0,
        probabilityDown: 0,
        probabilitySideways: 0,
        explanation: [
          "Wahrscheinlichkeiten werden wegen unzureichender verifizierter Evidenz zurückgehalten.",
          "Keine Garantie und keine Anlageberatung."
        ]
      };

  return {
    ...detail,
    aiAnalysis: evidenceAnalysis ?? aiAnalysis,
    professionalScores: evidenceScores
  };
}

/*
 * Hier stand `enrichAssetWithQuote`. Die Funktion nahm ein Mock-Asset, ersetzte
 * darin `quote` und `dataQuality` -- und lieferte alles Uebrige unveraendert
 * aus: Scores, Fundamentaldaten, News, Insider-Trades, Earnings-Datum.
 *
 * Sie ist ersatzlos entfernt. Es gibt kein Geruest mehr, das angereichert
 * werden koennte: `getAsset` baut die Ansicht vollstaendig aus Anbieterdaten.
 */

function uniqueSymbols(symbols: string[]) {
  return [...new Set(symbols.map((symbol) => safeDecodeURIComponent(symbol).trim().toUpperCase()).filter(Boolean))].slice(0, MAX_BATCH_SIZE);
}

function pollingBatchKey(provider: NearRealtimeProvider, symbols: string[]) {
  const providerId = "providerId" in provider ? String((provider as QuoteProvider).providerId) : provider.constructor.name;
  return `${providerId}:${[...uniqueSymbols(symbols)].sort().join(",")}`;
}

async function getSharedPollingQuotes(provider: NearRealtimeProvider, symbols: string[]) {
  const normalizedSymbols = uniqueSymbols(symbols);
  const key = pollingBatchKey(provider, normalizedSymbols);
  const existing = inFlightPollingBatches.get(key);
  if (existing) return existing;

  const request = provider.getQuotes(normalizedSymbols).finally(() => {
    inFlightPollingBatches.delete(key);
  });
  inFlightPollingBatches.set(key, request);
  return request;
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}

async function* pollQuotes(provider: NearRealtimeProvider, symbols: string[], options?: MarketStreamOptions) {
  const intervalMs = Math.max(1500, options?.intervalMs ?? DEFAULT_STREAM_INTERVAL_MS);

  while (!options?.signal?.aborted) {
    const quotes = await getSharedPollingQuotes(provider, symbols);
    if (quotes.length) yield quotes;
    await sleep(intervalMs, options?.signal);
  }
}

class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = "StockPilot Mock Market Feed";
  readonly providerId = "mock" as const;
  readonly quality = "mock" as const;
  readonly streamMode = "mock_stream" as const;

  async getDashboard() {
    return getMockDashboard();
  }

  async getAsset(symbol: string) {
    return getMockAsset(symbol);
  }

  async getQuote(symbol: string) {
    const detail = getMockAsset(symbol);
    return detail ? normalizedFromDetail(detail) : null;
  }

  async getQuotes(symbols: string[]) {
    return uniqueSymbols(symbols)
      .map((symbol) => getMockAsset(symbol))
      .filter((detail): detail is AssetDetail => Boolean(detail))
      .map((detail) => normalizedFromDetail(detail));
  }

  async getDelayedQuote(symbol: string) {
    return this.getQuote(symbol);
  }

  async getCandles(symbol: string) {
    return getMockAsset(symbol)?.candles["1D"] ?? [];
  }

  streamQuotes(symbols: string[], options?: MarketStreamOptions) {
    return pollQuotes(this, symbols, options);
  }
}

class UnavailableMarketDataProvider implements MarketDataProvider {
  readonly providerName = "Kein verifizierter Marktdatenanbieter";
  readonly providerId = "unavailable" as const;
  readonly quality = "unavailable" as const;
  readonly streamMode = "rest_polling" as const;

  async getDashboard() {
    return buildVerifiedProviderDashboard([], this.providerName, []);
  }

  async getAsset() {
    return null;
  }

  async getQuote() {
    return null;
  }

  async getQuotes() {
    return [];
  }

  async getDelayedQuote() {
    return null;
  }

  async getCandles() {
    return [];
  }

  async *streamQuotes() {
    yield* [] as NormalizedQuote[][];
  }
}

abstract class HttpQuoteProvider implements QuoteProvider {
  abstract readonly providerName: string;
  abstract readonly providerId: MarketProviderId;
  abstract readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode = "rest_polling";

  abstract getQuote(symbol: string): Promise<NormalizedQuote | null>;

  async getQuotes(symbols: string[]) {
    return getCachedProviderQuotes(this, symbols);
  }
}

async function* streamFinnhubWebSocket(
  provider: FinnhubQuoteProvider,
  symbols: string[],
  options?: MarketStreamOptions
): AsyncIterable<NormalizedQuote[]> {
  const token = process.env.FINNHUB_API_KEY;

  if (!token || typeof WebSocket === "undefined") {
    yield* pollQuotes(provider, symbols, options);
    return;
  }

  const normalizedSymbols = uniqueSymbols(symbols);
  const socket = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);
  const maxQueuedBatches = 32;
  const queue: NormalizedQuote[][] = [];
  let done = false;
  let wake: (() => void) | null = null;
  const wakeReader = () => {
    wake?.();
    wake = null;
  };

  options?.signal?.addEventListener(
    "abort",
    () => {
      done = true;
      socket.close();
      wakeReader();
    },
    { once: true }
  );

  socket.addEventListener("open", () => {
    for (const symbol of normalizedSymbols) {
      socket.send(JSON.stringify({ type: "subscribe", symbol: symbolForProvider(symbol, "finnhub") }));
    }
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string;
        data?: Array<{ s?: string; p?: number; v?: number; t?: number }>;
      };

      if (payload.type !== "trade" || !payload.data?.length) return;

      const quotes = payload.data
        .map((trade) => {
          const providerSymbol = String(trade.s ?? "");
          const symbol =
            normalizedSymbols.find((item) => symbolForProvider(item, "finnhub") === providerSymbol) ??
            providerSymbol.replace(/^BINANCE:/, "").replace("USDT", "-USD");
          const price = parseNumber(trade.p);
          if (!price) return null;

          return toNormalizedQuote({
            symbol,
            price,
            volume: parseNumber(trade.v),
            timestamp: trade.t ? new Date(trade.t).toISOString() : nowIso(),
            provider: "Finnhub WebSocket",
            quality: provider.quality,
            latencyMs: trade.t ? Math.max(0, Date.now() - trade.t) : undefined,
            marketStatus: "unknown"
          });
        })
        .filter((quote): quote is NormalizedQuote => Boolean(quote));

      if (quotes.length) {
        if (queue.length >= maxQueuedBatches) queue.shift();
        queue.push(quotes);
        wakeReader();
      }
    } catch {
      queue.push([]);
      wakeReader();
    }
  });

  socket.addEventListener("error", () => {
    done = true;
    wakeReader();
  });

  socket.addEventListener("close", () => {
    done = true;
    wakeReader();
  });

  try {
    while (!done && !options?.signal?.aborted) {
      const next = queue.shift();
      if (next) {
        if (next.length) yield next;
        continue;
      }

      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  } finally {
    socket.close();
  }
}

class FinnhubQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Finnhub";
  readonly providerId = "finnhub" as const;
  readonly quality = envQuality("FINNHUB_DATA_QUALITY", "near_realtime");
  readonly streamMode: StreamMode = process.env.FINNHUB_STREAM_ENABLED === "true" ? "provider_websocket" : "rest_polling";

  async getQuote(symbol: string) {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) throw new ProviderConfigurationError("FINNHUB_API_KEY fehlt");

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("token", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const price = parseNumber(data.c);
    if (!price) return null;

    const previousClose = parseNumber(data.pc);

    return toNormalizedQuote({
      symbol,
      price,
      previousClose,
      change: parseNumber(data.d),
      changePercent: parseNumber(data.dp),
      high: parseNumber(data.h),
      low: parseNumber(data.l),
      open: parseNumber(data.o),
      timestamp: parseNumber(data.t) ? new Date(Number(data.t) * 1000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }

  streamQuotes(symbols: string[], options?: MarketStreamOptions) {
    if (this.streamMode !== "provider_websocket") return pollQuotes(this, symbols, options);
    return streamFinnhubWebSocket(this, symbols, options);
  }
}

class TwelveDataQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Twelve Data";
  readonly providerId = "twelve_data" as const;
  readonly quality = envQuality("TWELVE_DATA_QUALITY", "near_realtime");

  async getQuote(symbol: string) {
    const token = process.env.TWELVE_DATA_API_KEY;
    if (!token) throw new ProviderConfigurationError("TWELVE_DATA_API_KEY fehlt");

    const url = new URL("https://api.twelvedata.com/quote");
    url.searchParams.set("symbol", symbolForProvider(symbol, this.providerId));
    url.searchParams.set("apikey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const price = parseNumber(data.close ?? data.price);
    if (!price) return null;

    const timestamp = typeof data.datetime === "string" ? new Date(data.datetime).toISOString() : nowIso();

    return toNormalizedQuote({
      symbol,
      price,
      currency: typeof data.currency === "string" ? data.currency : "USD",
      change: parseNumber(data.change),
      changePercent: parseNumber(data.percent_change),
      volume: parseNumber(data.volume),
      high: parseNumber(data.high),
      low: parseNumber(data.low),
      open: parseNumber(data.open),
      previousClose: parseNumber(data.previous_close),
      timestamp,
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }
}

class EodhdQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "EODHD";
  readonly providerId = "eodhd" as const;
  readonly quality = envQuality("EODHD_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const token = process.env.EODHD_API_KEY;
    if (!token) throw new ProviderConfigurationError("EODHD_API_KEY fehlt");

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL(`https://eodhd.com/api/real-time/${encodeURIComponent(providerSymbol)}`);
    url.searchParams.set("api_token", token);
    url.searchParams.set("fmt", "json");

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const price = parseNumber(data.close ?? data.price);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      price,
      change: parseNumber(data.change),
      changePercent: parseNumber(data.change_p ?? data.changePercent),
      volume: parseNumber(data.volume),
      high: parseNumber(data.high),
      low: parseNumber(data.low),
      open: parseNumber(data.open),
      previousClose: parseNumber(data.previousClose ?? data.previous_close),
      timestamp: parseNumber(data.timestamp) ? new Date(Number(data.timestamp) * 1000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: normalizeMarketStatus(data.marketStatus)
    });
  }
}

class MassiveSnapshotProvider extends HttpQuoteProvider {
  readonly providerName = "Polygon/Massive";
  readonly providerId = "massive" as const;
  readonly quality = envQuality("MASSIVE_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const token = process.env.MASSIVE_API_KEY ?? process.env.POLYGON_API_KEY;
    if (!token) throw new ProviderConfigurationError("MASSIVE_API_KEY oder POLYGON_API_KEY fehlt");

    const url = new URL(
      process.env.MASSIVE_SNAPSHOT_URL ??
        process.env.POLYGON_SNAPSHOT_URL ??
        "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers"
    );
    url.searchParams.set("tickers", symbolForProvider(symbol, this.providerId));
    url.searchParams.set("apiKey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const tickers = Array.isArray(data.tickers) ? data.tickers : [];
    const item = (tickers[0] ?? data.ticker ?? data) as Record<string, unknown>;
    const day = (item.day ?? {}) as Record<string, unknown>;
    const prevDay = (item.prevDay ?? {}) as Record<string, unknown>;
    const lastTrade = (item.lastTrade ?? {}) as Record<string, unknown>;
    const lastQuote = (item.lastQuote ?? {}) as Record<string, unknown>;
    const price = parseNumber(lastTrade.p ?? item.fmv ?? day.c ?? item.price);

    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      price,
      change: parseNumber(item.todaysChange),
      changePercent: parseNumber(item.todaysChangePerc),
      bid: parseNumber(lastQuote.p ?? lastQuote.bp),
      ask: parseNumber(lastQuote.P ?? lastQuote.ap),
      volume: parseNumber(day.v),
      high: parseNumber(day.h),
      low: parseNumber(day.l),
      open: parseNumber(day.o),
      previousClose: parseNumber(prevDay.c),
      timestamp: parseNumber(item.updated ?? lastTrade.t) ? new Date(Number(item.updated ?? lastTrade.t) / 1000000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }
}

class AlphaVantageQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Alpha Vantage Fallback";
  readonly providerId = "alpha_vantage" as const;
  readonly quality = envQuality("ALPHA_VANTAGE_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const token = process.env.ALPHA_VANTAGE_API_KEY;
    if (!token) throw new ProviderConfigurationError("ALPHA_VANTAGE_API_KEY fehlt");

    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbolForProvider(symbol, this.providerId));
    url.searchParams.set("apikey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName, 7000);
    const quote = (data["Global Quote"] ?? {}) as Record<string, unknown>;
    const price = parseNumber(quote["05. price"]);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      price,
      change: parseNumber(quote["09. change"]),
      changePercent: parseNumber(String(quote["10. change percent"] ?? "").replace("%", "")),
      volume: parseNumber(quote["06. volume"]),
      high: parseNumber(quote["03. high"]),
      low: parseNumber(quote["04. low"]),
      open: parseNumber(quote["02. open"]),
      previousClose: parseNumber(quote["08. previous close"]),
      timestamp: typeof quote["07. latest trading day"] === "string" ? `${quote["07. latest trading day"]}T21:00:00.000Z` : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }
}

class FmpQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Financial Modeling Prep";
  readonly providerId = "fmp" as const;
  readonly quality = envQuality("FMP_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const knownAsset = getMockAsset(symbol)?.asset;
    if (knownAsset?.type === "etf" && process.env.FMP_ENABLE_ETF_QUOTES !== "true") return null;

    const token = process.env.FMP_API_KEY;
    if (!token) throw new ProviderConfigurationError("FMP_API_KEY fehlt");

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL(`${process.env.FMP_API_BASE_URL ?? "https://financialmodelingprep.com/stable"}/quote`);
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("apikey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>[] | Record<string, unknown>>(
      url,
      this.providerName,
      6000
    );
    const item = (Array.isArray(data) ? data[0] : data) ?? {};
    const price = parseNumber(item.price);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      name: typeof item.name === "string" ? item.name : undefined,
      price,
      change: parseNumber(item.change),
      changePercent: parseNumber(item.changePercentage ?? item.changesPercentage),
      volume: parseNumber(item.volume),
      high: parseNumber(item.dayHigh),
      low: parseNumber(item.dayLow),
      open: parseNumber(item.open),
      previousClose: parseNumber(item.previousClose),
      fiftyTwoWeekHigh: parseNumber(item.yearHigh),
      fiftyTwoWeekLow: parseNumber(item.yearLow),
      marketCap: parseNumber(item.marketCap),
      exchange: typeof item.exchange === "string" ? item.exchange : undefined,
      timestamp: parseNumber(item.timestamp) ? new Date(Number(item.timestamp) * 1000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: normalizeMarketStatus(item.marketState ?? item.marketStatus)
    });
  }
}

class BinanceQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Binance Spot";
  readonly providerId = "binance" as const;
  readonly quality = envQuality("BINANCE_DATA_QUALITY", "near_realtime");

  async getQuote(symbol: string) {
    if (!isCryptoSymbol(symbol)) return null;

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL("https://api.binance.com/api/v3/ticker/24hr");
    url.searchParams.set("symbol", providerSymbol);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName, 4500);
    const price = parseNumber(data.lastPrice);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      assetType: "crypto",
      price,
      currency: "USD",
      change: parseNumber(data.priceChange),
      changePercent: parseNumber(data.priceChangePercent),
      bid: parseNumber(data.bidPrice),
      ask: parseNumber(data.askPrice),
      volume: parseNumber(data.quoteVolume ?? data.volume),
      high: parseNumber(data.highPrice),
      low: parseNumber(data.lowPrice),
      open: parseNumber(data.openPrice),
      previousClose: parseNumber(data.prevClosePrice),
      timestamp: parseNumber(data.closeTime) ? new Date(Number(data.closeTime)).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "open"
    });
  }
}

class CoinbaseQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Coinbase Exchange";
  readonly providerId = "coinbase" as const;
  readonly quality = envQuality("COINBASE_DATA_QUALITY", "near_realtime");

  async getQuote(symbol: string) {
    if (!isCryptoSymbol(symbol)) return null;

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL(`https://api.exchange.coinbase.com/products/${encodeURIComponent(providerSymbol)}/ticker`);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName, 4500);
    const price = parseNumber(data.price);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      assetType: "crypto",
      price,
      currency: "USD",
      bid: parseNumber(data.bid),
      ask: parseNumber(data.ask),
      volume: parseNumber(data.volume),
      timestamp: typeof data.time === "string" ? new Date(data.time).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "open"
    });
  }
}

function selectedCryptoProviderId(): MarketProviderId | null {
  const provider = (process.env.STOCKPILOT_CRYPTO_PROVIDER ?? "binance").toLowerCase();

  if (provider === "none" || provider === "off") return null;
  if (provider === "coinbase") return "coinbase";
  return "binance";
}

function getCryptoQuoteProvider(): QuoteProvider | null {
  const provider = selectedCryptoProviderId();

  switch (provider) {
    case "binance":
      return new BinanceQuoteProvider();
    case "coinbase":
      return new CoinbaseQuoteProvider();
    default:
      return null;
  }
}

class ProviderBackedMarketDataProvider implements MarketDataProvider {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;
  private readonly cryptoProvider = getCryptoQuoteProvider();

  constructor(private readonly quoteProvider: QuoteProvider) {
    this.providerName = quoteProvider.providerName;
    this.providerId = quoteProvider.providerId;
    this.quality = quoteProvider.quality;
    this.streamMode = quoteProvider.streamMode;
  }

  async getDashboard() {
    const symbols = uniqueSymbols(DEFAULT_DASHBOARD_SYMBOLS);
    const quotes = await withDeadline(this.getQuotes(symbols), DEFAULT_DASHBOARD_QUOTE_TIMEOUT_MS, []);
    const summaries = quotes
      .filter((quote) => quote.quality !== "mock" && quote.quality !== "unavailable")
      .map(summaryFromNormalizedQuote);
    const news = await realNewsFor("");

    return buildVerifiedProviderDashboard(summaries, this.providerName, news);
  }

  /**
   * Baut die Asset-Ansicht **allein aus Anbieterdaten**.
   *
   * Hier stand vorher `this.fallback.getAsset(symbol)` als Gerüst, und
   * `enrichAssetWithQuote` überschrieb davon genau zwei Felder: `quote` und
   * `dataQuality`. Alles andere überlebte aus `mock/market.ts` — und das war
   * für sechs Symbole eine ganze Menge:
   *
   * | Feld | Was ausgeliefert wurde |
   * |---|---|
   * | `scores` | Eine Tabelle. `AAPL: { trend: 46, news: 52, … }`, fest im Code |
   * | `professionalScores` | Daraus gerechnet — inklusive des angezeigten Sentiments |
   * | `fundamentals` | KGV, Wachstum, Verschuldung aus `fundamentalsMap` |
   * | `news` | Erfundene Meldungen mit erfundenen Zeitstempeln |
   * | `insiderActivity` | „Executive Officer", Sell, 1.800.000 $ |
   * | `earningsDate` | `"2026-07-29"` |
   *
   * Für AAPL stand damit ein echter Kurs neben erfundenen Fundamentaldaten,
   * ohne jeden Unterschied in der Darstellung. Das ist §61 in seiner
   * gefährlichsten Form: nicht offensichtlich falsch, sondern plausibel falsch.
   *
   * Der ehrliche Pfad existierte bereits — `detailFromProviderQuote` wurde für
   * jedes Symbol *außerhalb* der Mock-Tabelle benutzt und meldet Lücken als
   * Lücken. Er gilt jetzt für alle.
   */
  async getAsset(symbol: string) {
    const quote = await withDeadline(this.getQuote(symbol), DEFAULT_ASSET_QUOTE_TIMEOUT_MS, null);
    if (!quote) return null;

    // Die Historie ist der teuerste Abruf im Pfad (ueber 1000 Kerzen). Sie
    // bekommt ein eigenes, groesseres Zeitlimit -- und bei Ueberschreitung
    // eine leere Reihe statt einer erzeugten.
    // Historie und Nachrichten parallel. Beide haben ein eigenes Zeitlimit und
    // enden im Fehlerfall leer -- nie in Ersatzdaten.
    const [history, news, fundamentals] = await Promise.all([
      withDeadline(fetchDailyHistory(symbol), 9500, NO_HISTORY),
      withDeadline(realNewsFor(symbol), 6000, [] as NewsItem[]),
      withDeadline(getFundamentalsWithMetadata(symbol), 8500, null)
    ]);

    return detailFromProviderQuote(quote, history, news, fundamentals);
  }

  async getQuote(symbol: string) {
    if (
      isCryptoSymbol(symbol) &&
      this.cryptoProvider &&
      this.cryptoProvider.providerId !== this.quoteProvider.providerId
    ) {
      try {
        const cryptoQuote = await getCachedProviderQuote(this.cryptoProvider, symbol);
        if (cryptoQuote?.bid !== undefined && cryptoQuote.ask !== undefined) return cryptoQuote;
      } catch (error) {
        if (
          !(error instanceof ProviderConfigurationError) &&
          !(error instanceof ProviderRateLimitBackoffError) &&
          !(error instanceof ProviderAccessUnavailableError)
        ) {
          logEvent("error", "crypto_provider.quote_failed", {
            provider: this.cryptoProvider.providerName,
            symbol,
            error
          });
        }
      }
    }

    try {
      const quote = await getCachedProviderQuote(this.quoteProvider, symbol);
      if (quote) return quote;
    } catch (error) {
      if (
        !(error instanceof ProviderConfigurationError) &&
        !(error instanceof ProviderRateLimitBackoffError) &&
        !(error instanceof ProviderAccessUnavailableError)
        ) {
        logEvent("error", "market_provider.quote_failed", { provider: this.providerName, symbol, error });
      }
    }

    // Hier stand `return this.fallback.getQuote(symbol)`. Antwortete der echte
    // Anbieter nicht, bekam der Nutzer fuer die sechs Symbole der Mock-Tabelle
    // einen **erfundenen Kurs** -- ununterscheidbar vom echten.
    //
    // Das ist der schlimmste Fall von §61: kein fehlendes Feld, sondern eine
    // falsche Zahl an der Stelle, auf die alles andere aufbaut. Kein Kurs ist
    // besser als ein ausgedachter.
    return null;
  }

  async getQuotes(symbols: string[]) {
    const requested = uniqueSymbols(symbols);
    const cryptoSymbols = requested.filter((symbol) => isCryptoSymbol(symbol));
    let cryptoQuotes: NormalizedQuote[] = [];

    if (
      cryptoSymbols.length &&
      this.cryptoProvider &&
      this.cryptoProvider.providerId !== this.quoteProvider.providerId
    ) {
      try {
        cryptoQuotes = await this.cryptoProvider.getQuotes(cryptoSymbols);
      } catch (error) {
        logEvent("error", "crypto_provider.batch_failed", {
          provider: this.cryptoProvider.providerName,
          error
        });
      }
    }

    const cryptoMap = new Map(cryptoQuotes.map((quote) => [quote.symbol, quote]));
    const primaryRequested = requested.filter((symbol) => !cryptoMap.has(symbol));
    let realQuotes: NormalizedQuote[] = [];

    try {
      realQuotes = await this.quoteProvider.getQuotes(primaryRequested);
    } catch (error) {
      if (!(error instanceof ProviderConfigurationError)) {
        logEvent("error", "market_provider.batch_failed", { provider: this.providerName, error });
      }
    }

    // Symbole ohne echte Antwort fehlen in der Liste. Vorher wurden sie aus
    // `this.fallback.getQuotes(missing)` aufgefuellt -- erfundene Kurse, im
    // Dashboard nicht von echten zu unterscheiden. Eine kuerzere Liste ist die
    // ehrliche Antwort; wer sie anzeigt, sieht auch, dass etwas fehlt.
    const missing = requested.filter(
      (symbol) => ![...cryptoQuotes, ...realQuotes].some((quote) => quote.symbol === symbol)
    );

    if (missing.length > 0) {
      logEvent("warn", "market_provider.quotes_missing", {
        provider: this.providerName,
        requested: requested.length,
        missing: missing.length
      });
    }

    return [...cryptoQuotes, ...realQuotes].sort(
      (a, b) => requested.indexOf(a.symbol) - requested.indexOf(b.symbol)
    );
  }

  async getDelayedQuote(symbol: string) {
    return this.getQuote(symbol);
  }

  /**
   * Kerzen aus echter Tageshistorie.
   *
   * Hier stand `this.fallback.getAsset(symbol)` — also `makeCandles()` aus
   * `mock/market.ts`, wo der Schlusskurs aus einer Sinus- und einer
   * Kosinusfunktion entsteht. Genau diese Sorte Kerze hat dieses Projekt
   * bereits einmal aus dem Analysepfad entfernt; über diesen Weg kam sie
   * zurück.
   *
   * Intraday-Intervalle liefern **nichts**. Tagesschlusskurse enthalten keinen
   * Verlauf innerhalb des Tages, und ihn zu erfinden wäre der Ausgangsfehler.
   */
  async getCandles(symbol: string, interval: "1m" | "5m" | "15m" | "1h" | "1d") {
    if (interval !== "1d") return [];

    const history = await withDeadline(fetchDailyHistory(symbol), 9500, NO_HISTORY);
    if (!history.candles.length) return [];

    return sliceHistoryRanges(history.candles)["1Y"];
  }

  streamQuotes(symbols: string[], options?: MarketStreamOptions) {
    if (this.quoteProvider.streamMode === "provider_websocket" && this.quoteProvider.streamQuotes) {
      return this.quoteProvider.streamQuotes(symbols, options);
    }

    return pollQuotes(this, symbols, options);
  }
}


// `autoProviderId` und `selectedProviderId` sind entfallen: die Rangfolge
// entscheidet jetzt `resolveQuoteChain()` in quote-chain.ts, und zwar als
// Kette statt als Einzelwahl.

/**
 * Baut den Adapter zu einer Anbieterkennung.
 *
 * Krypto-Boersen sind hier enthalten, weil sie ausdruecklich gewaehlt werden
 * koennen -- in die automatische Rangfolge nehmen sie sich selbst nicht auf.
 */
function createQuoteProvider(id: MarketProviderId): QuoteProvider | null {
  switch (id) {
    case "finnhub":
      return new FinnhubQuoteProvider();
    case "twelve_data":
      return new TwelveDataQuoteProvider();
    case "eodhd":
      return new EodhdQuoteProvider();
    case "massive":
    case "polygon":
      return new MassiveSnapshotProvider();
    case "alpha_vantage":
      return new AlphaVantageQuoteProvider();
    case "fmp":
      return new FmpQuoteProvider();
    case "binance":
      return new BinanceQuoteProvider();
    case "coinbase":
      return new CoinbaseQuoteProvider();
    default:
      return null;
  }
}

/**
 * Fragt mehrere Quellen der Reihe nach.
 *
 * Der entscheidende Punkt ist, was **nicht** passiert: die Kette faelscht
 * keine Qualitaetsangabe. Antwortet die zweite Quelle, traegt der Kurs deren
 * Namen und deren Qualitaetsstufe -- nicht die der bevorzugten. Ein
 * near-realtime-Kurs von Finnhub darf nicht als verzoegerter FMP-Kurs
 * erscheinen, und umgekehrt erst recht nicht.
 */
export class ChainedQuoteProvider implements QuoteProvider {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;

  constructor(private readonly chain: QuoteProvider[]) {
    const head = chain[0];
    this.providerName = head.providerName;
    this.providerId = head.providerId;
    this.quality = head.quality;
    this.streamMode = head.streamMode;
  }

  async getQuote(symbol: string): Promise<NormalizedQuote | null> {
    for (const provider of this.chain) {
      try {
        const quote = await provider.getQuote(symbol);
        if (quote) return quote;
      } catch (error) {
        logEvent("warn", "market.provider_failed_over", {
          providerId: provider.providerId,
          symbol,
          message: error instanceof Error ? error.message : "unknown"
        });
      }
    }
    // Keine Quelle konnte antworten. Null heisst hier ehrlich "nichts
    // bekommen" -- der Aufrufer entscheidet ueber den Mock-Rueckfall.
    return null;
  }

  async getQuotes(symbols: string[]) {
    return getCachedProviderQuotes(this, symbols);
  }
}

export function getMarketDataProvider(): MarketDataProvider {
  const chain = resolveQuoteChain();
  const providers = chain.providers
    .map((id) => createQuoteProvider(id))
    .filter((provider): provider is QuoteProvider => provider !== null);

  if (providers.length === 0) {
    return developmentFixturesAllowed() ? new MockMarketDataProvider() : new UnavailableMarketDataProvider();
  }
  if (providers.length === 1) return new ProviderBackedMarketDataProvider(providers[0]);

  return new ProviderBackedMarketDataProvider(new ChainedQuoteProvider(providers));
}
import { assessProviderEvidence } from "@/lib/analysis/provider-evidence";
import { buildEvidenceBoundAnalysis } from "@/lib/analysis/evidence-analysis";
