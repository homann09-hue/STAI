import type {
  BarAdjustedCloseType,
  BarAdjustmentType,
  BarInterval,
  ChartRange,
  MarketDataQuality,
  NormalizedBar,
  QuoteQualityStatus,
} from "@/lib/types";

const intervals = new Set<BarInterval>([
  "1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w", "1mo",
]);
const intervalMilliseconds: Record<Exclude<BarInterval, "1mo">, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
};
const adjustmentTypes = new Set<BarAdjustmentType>([
  "RAW", "SPLIT_ADJUSTED", "DIVIDEND_ADJUSTED", "SPLIT_DIVIDEND_ADJUSTED",
]);
const adjustedCloseTypes = new Set<BarAdjustedCloseType>([
  "PROVIDER_ADJUSTED_UNSPECIFIED",
  "SPLIT_ADJUSTED",
  "DIVIDEND_ADJUSTED",
  "SPLIT_DIVIDEND_ADJUSTED",
]);
const qualities = new Set<MarketDataQuality>([
  "realtime", "near_realtime", "delayed", "historical", "mock", "unavailable",
]);
const chartRanges = new Set<ChartRange>([
  "1D", "5D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX",
]);

export interface CanonicalBarInput {
  instrumentId?: unknown;
  providerId: unknown;
  providerSymbol?: unknown;
  venue?: unknown;
  symbol: unknown;
  range: unknown;
  interval: unknown;
  openTime: unknown;
  closeTime: unknown;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  adjustedClose?: unknown;
  adjustedCloseType?: unknown;
  volume: unknown;
  tradeCount?: unknown;
  vwap?: unknown;
  currency?: unknown;
  isAdjusted: unknown;
  adjustmentType: unknown;
  provider: unknown;
  providerTimestamp?: unknown;
  receivedTimestamp?: unknown;
  sessionTimeZone?: unknown;
  quality?: unknown;
  sourceQualityIssues?: unknown;
  time?: unknown;
}

export interface CanonicalBarBuildOptions {
  now?: Date;
  futureToleranceMs?: number;
}

export interface BarSeriesQuality {
  status: QuoteQualityStatus;
  accepted: number;
  rejected: number;
  duplicates: number;
  qualityScore: number;
  issues: string[];
  sufficientForPriceAnalysis: boolean;
}

export interface NormalizedBarSeries {
  bars: NormalizedBar[];
  quality: BarSeriesQuality;
}

export class CanonicalBarValidationError extends Error {}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function expectedClose(openTime: string, interval: BarInterval): string {
  const open = new Date(openTime);
  if (interval !== "1mo") {
    return new Date(open.getTime() + intervalMilliseconds[interval]).toISOString();
  }
  return new Date(Date.UTC(open.getUTCFullYear(), open.getUTCMonth() + 1, 1)).toISOString();
}

function issueList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, 80)?.toLowerCase() ?? null).filter(
    (item): item is string => item !== null && /^[a-z0-9][a-z0-9_.:-]*$/.test(item),
  ))].slice(0, 32);
}

function barScore(quality: MarketDataQuality, issues: readonly string[]): number {
  const base: Record<MarketDataQuality, number> = {
    realtime: 100,
    near_realtime: 90,
    delayed: 72,
    historical: 72,
    mock: 20,
    unavailable: 0,
  };
  const penalties: Record<string, number> = {
    instrument_id_missing: 8,
    venue_missing: 5,
    currency_unknown: 15,
    provider_timestamp_missing: 4,
    session_timezone_missing: 4,
    trade_count_missing: 2,
    vwap_missing: 2,
  };
  const score = issues.reduce((sum, issue) => sum - (penalties[issue] ?? 0), base[quality]);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildNormalizedBar(
  input: CanonicalBarInput,
  options: CanonicalBarBuildOptions = {},
): NormalizedBar {
  const now = options.now ?? new Date();
  const symbol = text(input.symbol, 32)?.toUpperCase() ?? "";
  const providerId = text(input.providerId, 48)?.toLowerCase() ?? "";
  const provider = text(input.provider, 80) ?? "";
  const interval = typeof input.interval === "string" && intervals.has(input.interval as BarInterval)
    ? input.interval as BarInterval : null;
  const openTime = isoTimestamp(input.openTime);
  const closeTime = isoTimestamp(input.closeTime);
  const open = positiveNumber(input.open);
  const high = positiveNumber(input.high);
  const low = positiveNumber(input.low);
  const close = positiveNumber(input.close);
  const volume = nonNegativeNumber(input.volume);
  if (typeof input.isAdjusted !== "boolean") {
    throw new CanonicalBarValidationError("Adjustment-Status fehlt.");
  }
  const isAdjusted = input.isAdjusted;
  const adjustmentType = typeof input.adjustmentType === "string" && adjustmentTypes.has(input.adjustmentType as BarAdjustmentType)
    ? input.adjustmentType as BarAdjustmentType : null;
  const range = typeof input.range === "string" && chartRanges.has(input.range as ChartRange)
    ? input.range as ChartRange : null;

  if (!/^[A-Z0-9][A-Z0-9._:/-]{0,31}$/.test(symbol)) throw new CanonicalBarValidationError("Ungueltiges Bar-Symbol.");
  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(providerId)) throw new CanonicalBarValidationError("Ungueltige Provider-ID.");
  if (!provider) throw new CanonicalBarValidationError("Providername fehlt.");
  if (!range) throw new CanonicalBarValidationError("Ungueltiger Chart-Zeitraum.");
  if (!interval || !openTime || !closeTime) throw new CanonicalBarValidationError("Intervall oder Zeitgrenze fehlt.");
  if (open === null || high === null || low === null || close === null) throw new CanonicalBarValidationError("OHLC muss vollstaendig und positiv sein.");
  if (volume === null) throw new CanonicalBarValidationError("Volumen muss groesser oder gleich null sein.");
  if (low > Math.min(open, close, high) || high < Math.max(open, close, low)) throw new CanonicalBarValidationError("OHLC-Grenzen sind widerspruechlich.");
  if (expectedClose(openTime, interval) !== closeTime) throw new CanonicalBarValidationError("Zeitgrenzen passen nicht zum Bar-Intervall.");
  if (Date.parse(openTime) > now.getTime() + Math.max(0, options.futureToleranceMs ?? 5_000)) throw new CanonicalBarValidationError("Bar beginnt in der Zukunft.");
  if (!adjustmentType) throw new CanonicalBarValidationError("Adjustment-Art fehlt.");
  if ((!isAdjusted && adjustmentType !== "RAW") || (isAdjusted && adjustmentType === "RAW")) throw new CanonicalBarValidationError("Adjustment-Status ist widerspruechlich.");

  const quality = typeof input.quality === "string" && qualities.has(input.quality as MarketDataQuality)
    ? input.quality as MarketDataQuality : "unavailable";
  const instrumentId = text(input.instrumentId, 160);
  const venue = text(input.venue, 80)?.toUpperCase() ?? null;
  const rawCurrency = text(input.currency, 8)?.toUpperCase() ?? "XXX";
  const currency = /^[A-Z0-9]{3,8}$/.test(rawCurrency) ? rawCurrency : "XXX";
  const providerTimestamp = isoTimestamp(input.providerTimestamp);
  if (input.providerTimestamp != null && providerTimestamp === null) {
    throw new CanonicalBarValidationError("Ungueltiger Provider-Zeitstempel.");
  }
  if (providerTimestamp && Date.parse(providerTimestamp) > now.getTime() + 5_000) {
    throw new CanonicalBarValidationError("Provider-Zeitstempel liegt in der Zukunft.");
  }
  const receivedTimestamp = isoTimestamp(input.receivedTimestamp) ?? now.toISOString();
  const sessionTimeZone = text(input.sessionTimeZone, 80);
  const tradeCount = nonNegativeNumber(input.tradeCount);
  const vwap = positiveNumber(input.vwap);
  if (vwap !== null && (vwap < low || vwap > high)) {
    throw new CanonicalBarValidationError("VWAP liegt ausserhalb der Bar-Spanne.");
  }
  const adjustedClose = positiveNumber(input.adjustedClose);
  const adjustedCloseType = typeof input.adjustedCloseType === "string" && adjustedCloseTypes.has(input.adjustedCloseType as BarAdjustedCloseType)
    ? input.adjustedCloseType as BarAdjustedCloseType
    : adjustedClose === null ? null : "PROVIDER_ADJUSTED_UNSPECIFIED";
  const issues = issueList(input.sourceQualityIssues);
  if (!instrumentId) issues.push("instrument_id_missing");
  if (!venue) issues.push("venue_missing");
  if (currency === "XXX") issues.push("currency_unknown");
  if (!providerTimestamp) issues.push("provider_timestamp_missing");
  if (!sessionTimeZone) issues.push("session_timezone_missing");
  if (tradeCount === null) issues.push("trade_count_missing");
  if (vwap === null) issues.push("vwap_missing");
  const qualityIssues = [...new Set(issues)];
  const qualityStatus: QuoteQualityStatus = quality === "unavailable" ? "UNAVAILABLE"
    : qualityIssues.length ? "PARTIAL"
      : quality === "delayed" || quality === "historical" ? "DELAYED" : "OK";

  return {
    instrumentId,
    providerId,
    providerSymbol: text(input.providerSymbol, 80)?.toUpperCase() ?? symbol,
    venue,
    symbol,
    range,
    interval,
    openTime,
    closeTime,
    timestamp: openTime,
    time: text(input.time, 32) ?? openTime,
    open,
    high,
    low,
    close,
    ...(adjustedClose === null ? {} : { adjustedClose }),
    adjustedCloseType,
    volume,
    tradeCount,
    vwap,
    currency,
    isAdjusted,
    adjustmentType,
    provider,
    providerTimestamp,
    receivedTimestamp,
    sessionTimeZone,
    quality,
    qualityStatus,
    qualityScore: barScore(quality, qualityIssues),
    qualityIssues,
  };
}

export function normalizeBarSeries(
  rows: readonly CanonicalBarInput[],
  options: CanonicalBarBuildOptions = {},
): NormalizedBarSeries {
  const accepted: NormalizedBar[] = [];
  let rejected = 0;
  for (const row of rows) {
    try {
      accepted.push(buildNormalizedBar(row, options));
    } catch {
      rejected += 1;
    }
  }
  accepted.sort((left, right) => Date.parse(left.openTime) - Date.parse(right.openTime));
  const deduplicated = new Map<string, NormalizedBar>();
  let duplicates = 0;
  let divergentDuplicates = 0;
  for (const bar of accepted) {
    const key = `${bar.instrumentId ?? bar.symbol}:${bar.interval}:${bar.openTime}`;
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, bar);
      continue;
    }
    duplicates += 1;
    if (existing.open !== bar.open || existing.high !== bar.high || existing.low !== bar.low || existing.close !== bar.close || existing.volume !== bar.volume) divergentDuplicates += 1;
  }
  const bars = [...deduplicated.values()];
  const issues: string[] = [];
  if (rejected) issues.push("invalid_bars_rejected");
  if (duplicates) issues.push("duplicate_bars_rejected");
  if (divergentDuplicates) issues.push("divergent_duplicate_bars");
  const adjustmentKinds = new Set(
    bars.map((bar) => `${bar.isAdjusted}:${bar.adjustmentType}`),
  );
  const mixedAdjustments = adjustmentKinds.size > 1;
  const identityComplete = bars.every(
    (bar) => bar.instrumentId !== null && bar.currency !== "XXX",
  );
  if (mixedAdjustments) issues.push("mixed_adjustment_types");
  if (!identityComplete && bars.length) issues.push("instrument_identity_incomplete");
  const hasDelayedBars = bars.some((bar) => bar.qualityStatus === "DELAYED");
  const hasPartialBars = bars.some((bar) => bar.qualityStatus === "PARTIAL");
  const status: QuoteQualityStatus = divergentDuplicates || mixedAdjustments ? "DIVERGENT"
    : rejected || duplicates || hasPartialBars || !identityComplete ? "PARTIAL"
      : hasDelayedBars ? "DELAYED" : bars.length ? "OK" : "UNAVAILABLE";
  const averageScore = bars.length ? bars.reduce((sum, bar) => sum + bar.qualityScore, 0) / bars.length : 0;
  const penalty = Math.min(50, rejected * 5 + duplicates * 3 + divergentDuplicates * 15);
  return {
    bars,
    quality: {
      status,
      accepted: bars.length,
      rejected,
      duplicates,
      qualityScore: Math.max(0, Math.round(averageScore - penalty)),
      issues,
      sufficientForPriceAnalysis:
        bars.length >= 60 &&
        identityComplete &&
        status !== "DIVERGENT" &&
        status !== "UNAVAILABLE",
    },
  };
}
