import type {
  AssetType,
  MarketDataQuality,
  MarketStatus,
  NormalizedQuote,
  QuoteFeedType,
  QuoteMarketSession,
  QuoteQualityStatus,
} from "@/lib/types";

const assetTypes = new Set<AssetType>([
  "stock",
  "etf",
  "crypto",
  "forex",
  "index",
]);
const qualities = new Set<MarketDataQuality>([
  "realtime",
  "near_realtime",
  "delayed",
  "historical",
  "mock",
  "unavailable",
]);
const marketStatuses = new Set<MarketStatus>([
  "open",
  "closed",
  "pre_market",
  "after_hours",
  "unknown",
]);
const feedTypes = new Set<QuoteFeedType>([
  "REALTIME",
  "NEAR_REALTIME",
  "DELAYED",
  "END_OF_DAY",
  "REFERENCE_DATA",
  "INDICATIVE",
]);
const quoteMarketSessions = new Set<QuoteMarketSession>([
  "PRE_MARKET",
  "REGULAR",
  "AFTER_HOURS",
  "CLOSED",
  "HALTED",
  "UNKNOWN",
]);
const quoteQualityStatuses = new Set<QuoteQualityStatus>([
  "OK",
  "DELAYED",
  "STALE",
  "DIVERGENT",
  "PARTIAL",
  "MARKET_CLOSED",
  "PROVIDER_DEGRADED",
  "UNAVAILABLE",
  "INVALID",
]);

export interface CanonicalQuoteInput {
  canonicalId?: unknown;
  instrumentId?: unknown;
  symbol: unknown;
  name?: unknown;
  assetType?: unknown;
  providerId: unknown;
  providerSymbol?: unknown;
  venue?: unknown;
  currency?: unknown;
  bid?: unknown;
  bidSize?: unknown;
  ask?: unknown;
  askSize?: unknown;
  last?: unknown;
  price?: unknown;
  lastSize?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  previousClose?: unknown;
  change?: unknown;
  changePercent?: unknown;
  volume?: unknown;
  vwap?: unknown;
  fiftyTwoWeekHigh?: unknown;
  fiftyTwoWeekLow?: unknown;
  marketCap?: unknown;
  freeFloat?: unknown;
  marketStatus?: unknown;
  marketSession?: unknown;
  eventTimestamp?: unknown;
  providerTimestamp?: unknown;
  receivedTimestamp?: unknown;
  timestamp?: unknown;
  provider: unknown;
  quality?: unknown;
  latencyMs?: unknown;
  reportedDelaySeconds?: unknown;
  feedType?: unknown;
  sourceQualityStatus?: unknown;
  sourceQualityIssues?: unknown;
  providerDegraded?: boolean;
  divergent?: boolean;
}

export interface CanonicalQuoteBuildOptions {
  now?: Date;
  staleAfterMs?: number;
}

export class CanonicalQuoteValidationError extends Error {}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumberOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegativeNumberOrNull(value: unknown): number | null {
  const parsed = numberOrNull(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function qualityIssuesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .slice(0, 32)
        .map((issue) => text(issue, 80)?.toLowerCase() ?? null)
        .filter(
          (issue): issue is string =>
            issue !== null && /^[a-z0-9][a-z0-9_.:-]*$/.test(issue),
        ),
    ),
  ];
}

function rounded(value: number, precision: number): number {
  return Number(value.toFixed(precision));
}

function qualityFrom(value: unknown): MarketDataQuality {
  return typeof value === "string" && qualities.has(value as MarketDataQuality)
    ? (value as MarketDataQuality)
    : "unavailable";
}

export function quoteFeedTypeForQuality(
  quality: MarketDataQuality,
): QuoteFeedType {
  if (quality === "realtime") return "REALTIME";
  if (quality === "near_realtime") return "NEAR_REALTIME";
  if (quality === "delayed") return "DELAYED";
  if (quality === "historical") return "END_OF_DAY";
  return "INDICATIVE";
}

export function quoteMarketSessionForStatus(
  status: MarketStatus,
): QuoteMarketSession {
  if (status === "open") return "REGULAR";
  if (status === "closed") return "CLOSED";
  if (status === "pre_market") return "PRE_MARKET";
  if (status === "after_hours") return "AFTER_HOURS";
  return "UNKNOWN";
}

function qualityScore(
  quality: MarketDataQuality,
  status: QuoteQualityStatus,
  issues: readonly string[],
): number {
  const base: Record<MarketDataQuality, number> = {
    realtime: 100,
    near_realtime: 90,
    delayed: 70,
    historical: 55,
    mock: 20,
    unavailable: 0,
  };
  const penalties: Record<string, number> = {
    canonical_id_missing: 8,
    instrument_id_missing: 8,
    venue_missing: 8,
    currency_unknown: 15,
    event_timestamp_missing: 15,
    provider_timestamp_missing: 5,
    bid_missing: 4,
    ask_missing: 4,
    bid_size_missing: 2,
    ask_size_missing: 2,
    realtime_delay_unverified: 15,
  };
  let score = base[quality];
  for (const issue of issues) score -= penalties[issue] ?? 0;
  if (status === "STALE") score = Math.min(score, 35);
  if (status === "DIVERGENT") score = Math.min(score, 25);
  if (status === "PROVIDER_DEGRADED") score = Math.min(score, 45);
  if (status === "INVALID" || status === "UNAVAILABLE") score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildNormalizedQuote(
  input: CanonicalQuoteInput,
  options: CanonicalQuoteBuildOptions = {},
): NormalizedQuote {
  const now = options.now ?? new Date();
  const receivedTimestamp =
    isoTimestamp(input.receivedTimestamp) ?? now.toISOString();
  const symbol = text(input.symbol, 32)?.toUpperCase() ?? "";
  const providerId = text(input.providerId, 48)?.toLowerCase() ?? "";
  const provider = text(input.provider, 80) ?? "";
  const last = positiveNumberOrNull(input.last ?? input.price);

  if (!/^[A-Z0-9][A-Z0-9._:/-]{0,31}$/.test(symbol)) {
    throw new CanonicalQuoteValidationError("Ungueltiges Quote-Symbol.");
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(providerId)) {
    throw new CanonicalQuoteValidationError("Ungueltige Provider-ID.");
  }
  if (!provider) {
    throw new CanonicalQuoteValidationError("Providername fehlt.");
  }
  if (last === null) {
    throw new CanonicalQuoteValidationError(
      "Letzter Kurs muss groesser als null sein.",
    );
  }

  const invalidIssues: string[] = [];
  const partialIssues: string[] = [];
  const canonicalId = text(input.canonicalId, 200);
  const instrumentId = text(input.instrumentId, 160);
  const providerSymbol =
    text(input.providerSymbol, 80)?.toUpperCase() ?? symbol;
  const venue = text(input.venue, 80)?.toUpperCase() ?? null;
  const rawCurrency = text(input.currency, 8)?.toUpperCase() ?? "XXX";
  const currency = /^[A-Z0-9]{3,8}$/.test(rawCurrency) ? rawCurrency : "XXX";
  const quality = qualityFrom(input.quality);
  const marketStatus =
    typeof input.marketStatus === "string" &&
    marketStatuses.has(input.marketStatus as MarketStatus)
      ? (input.marketStatus as MarketStatus)
      : "unknown";
  const marketSession =
    typeof input.marketSession === "string" &&
    quoteMarketSessions.has(input.marketSession as QuoteMarketSession)
      ? (input.marketSession as QuoteMarketSession)
      : quoteMarketSessionForStatus(marketStatus);
  const eventTimestamp = isoTimestamp(input.eventTimestamp ?? input.timestamp);
  const providerTimestamp = isoTimestamp(input.providerTimestamp);
  const latencyMs = nonNegativeNumberOrNull(input.latencyMs);
  const reportedDelaySeconds = nonNegativeNumberOrNull(
    input.reportedDelaySeconds,
  );
  const feedType =
    typeof input.feedType === "string" &&
    feedTypes.has(input.feedType as QuoteFeedType)
      ? (input.feedType as QuoteFeedType)
      : quoteFeedTypeForQuality(quality);
  const sourceQualityStatus =
    typeof input.sourceQualityStatus === "string" &&
    quoteQualityStatuses.has(input.sourceQualityStatus as QuoteQualityStatus)
      ? (input.sourceQualityStatus as QuoteQualityStatus)
      : null;
  const sourceQualityIssues = qualityIssuesFrom(input.sourceQualityIssues);

  let bid = positiveNumberOrNull(input.bid);
  let ask = positiveNumberOrNull(input.ask);
  const bidSize = nonNegativeNumberOrNull(input.bidSize);
  const askSize = nonNegativeNumberOrNull(input.askSize);
  const lastSize = nonNegativeNumberOrNull(input.lastSize);
  const rawVolume = numberOrNull(input.volume);
  const volume = nonNegativeNumberOrNull(input.volume);

  if (rawVolume !== null && rawVolume < 0)
    invalidIssues.push("negative_volume");
  if (bid !== null && ask !== null && bid > ask) {
    invalidIssues.push("crossed_market");
    bid = null;
    ask = null;
  }

  if (!canonicalId) partialIssues.push("canonical_id_missing");
  if (!instrumentId) partialIssues.push("instrument_id_missing");
  if (!venue) partialIssues.push("venue_missing");
  if (currency === "XXX") partialIssues.push("currency_unknown");
  if (!eventTimestamp) partialIssues.push("event_timestamp_missing");
  if (!providerTimestamp) partialIssues.push("provider_timestamp_missing");
  if (bid === null) partialIssues.push("bid_missing");
  if (ask === null) partialIssues.push("ask_missing");
  if (bidSize === null) partialIssues.push("bid_size_missing");
  if (askSize === null) partialIssues.push("ask_size_missing");
  if (feedType === "REALTIME" && reportedDelaySeconds !== 0) {
    partialIssues.push("realtime_delay_unverified");
  }

  const futureToleranceMs = 5_000;
  if (
    eventTimestamp &&
    Date.parse(eventTimestamp) > now.getTime() + futureToleranceMs
  ) {
    invalidIssues.push("future_event_timestamp");
  }
  if (
    providerTimestamp &&
    Date.parse(providerTimestamp) > now.getTime() + futureToleranceMs
  ) {
    invalidIssues.push("future_provider_timestamp");
  }

  const staleAfterMs = Math.max(1_000, options.staleAfterMs ?? 120_000);
  const quoteAgeMs = eventTimestamp
    ? Math.max(0, now.getTime() - Date.parse(eventTimestamp))
    : null;
  const stale =
    (quality === "realtime" || quality === "near_realtime") &&
    quoteAgeMs !== null &&
    quoteAgeMs > staleAfterMs &&
    marketSession !== "CLOSED";

  let qualityStatus: QuoteQualityStatus;
  if (invalidIssues.length || sourceQualityStatus === "INVALID")
    qualityStatus = "INVALID";
  else if (quality === "unavailable" || sourceQualityStatus === "UNAVAILABLE")
    qualityStatus = "UNAVAILABLE";
  else if (input.divergent || sourceQualityStatus === "DIVERGENT")
    qualityStatus = "DIVERGENT";
  else if (
    input.providerDegraded ||
    sourceQualityStatus === "PROVIDER_DEGRADED"
  )
    qualityStatus = "PROVIDER_DEGRADED";
  else if (stale || sourceQualityStatus === "STALE") qualityStatus = "STALE";
  else if (marketSession === "CLOSED") qualityStatus = "MARKET_CLOSED";
  else if (quality === "delayed" || quality === "historical")
    qualityStatus = "DELAYED";
  else if (partialIssues.length) qualityStatus = "PARTIAL";
  else qualityStatus = "OK";

  const issues = [
    ...new Set([...invalidIssues, ...sourceQualityIssues, ...partialIssues]),
  ];
  const previousClose = positiveNumberOrNull(input.previousClose);
  const suppliedChange = numberOrNull(input.change);
  const change =
    suppliedChange ?? (previousClose === null ? 0 : last - previousClose);
  const suppliedChangePercent = numberOrNull(input.changePercent);
  const changePercent =
    suppliedChangePercent ??
    (previousClose === null || previousClose === 0
      ? 0
      : ((last - previousClose) / previousClose) * 100);
  const isRealtime =
    feedType === "REALTIME" &&
    quality === "realtime" &&
    reportedDelaySeconds === 0 &&
    eventTimestamp !== null &&
    qualityStatus !== "INVALID" &&
    qualityStatus !== "STALE" &&
    qualityStatus !== "UNAVAILABLE";

  return {
    canonicalId,
    instrumentId,
    symbol,
    name: text(input.name, 160) ?? undefined,
    assetType:
      typeof input.assetType === "string" &&
      assetTypes.has(input.assetType as AssetType)
        ? (input.assetType as AssetType)
        : "stock",
    providerId,
    providerSymbol,
    venue,
    price: rounded(last, 6),
    last: rounded(last, 6),
    lastSize,
    currency,
    change: rounded(change, 6),
    changePercent: rounded(changePercent, 4),
    bid,
    bidSize,
    ask,
    askSize,
    spread:
      bid !== null && ask !== null ? rounded(Math.max(0, ask - bid), 6) : null,
    volume,
    vwap: positiveNumberOrNull(input.vwap),
    high: positiveNumberOrNull(input.high),
    low: positiveNumberOrNull(input.low),
    open: positiveNumberOrNull(input.open),
    previousClose,
    fiftyTwoWeekHigh: positiveNumberOrNull(input.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: positiveNumberOrNull(input.fiftyTwoWeekLow),
    marketCap: nonNegativeNumberOrNull(input.marketCap),
    freeFloat: nonNegativeNumberOrNull(input.freeFloat),
    exchange: venue,
    marketSession,
    eventTimestamp,
    providerTimestamp,
    receivedTimestamp,
    isRealtime,
    reportedDelaySeconds,
    feedType,
    qualityStatus,
    qualityScore: qualityScore(quality, qualityStatus, issues),
    qualityIssues: issues,
    timestamp: eventTimestamp ?? receivedTimestamp,
    provider,
    quality,
    latencyMs,
    marketStatus,
  };
}

export function normalizeCanonicalQuoteRecord(
  rawQuote: unknown,
  options: CanonicalQuoteBuildOptions = {},
): NormalizedQuote | null {
  if (!rawQuote || typeof rawQuote !== "object") return null;
  const quote = rawQuote as Record<string, unknown>;
  try {
    return buildNormalizedQuote(
      {
        canonicalId: quote.canonicalId,
        instrumentId: quote.instrumentId,
        symbol: quote.symbol,
        name: quote.name,
        assetType: quote.assetType,
        providerId: quote.providerId ?? "unavailable",
        providerSymbol: quote.providerSymbol ?? quote.symbol,
        venue: quote.venue ?? quote.exchange,
        currency: quote.currency,
        bid: quote.bid,
        bidSize: quote.bidSize,
        ask: quote.ask,
        askSize: quote.askSize,
        last: quote.last ?? quote.price,
        lastSize: quote.lastSize,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        vwap: quote.vwap,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        marketCap: quote.marketCap,
        freeFloat: quote.freeFloat,
        marketStatus: quote.marketStatus,
        marketSession: quote.marketSession,
        eventTimestamp: quote.eventTimestamp ?? quote.timestamp,
        providerTimestamp: quote.providerTimestamp,
        receivedTimestamp: quote.receivedTimestamp,
        provider: quote.provider ?? "unknown",
        quality: quote.quality,
        latencyMs: quote.latencyMs,
        reportedDelaySeconds: quote.reportedDelaySeconds,
        feedType: quote.feedType,
        sourceQualityStatus: quote.qualityStatus,
        sourceQualityIssues: quote.qualityIssues,
      },
      options,
    );
  } catch {
    return null;
  }
}
