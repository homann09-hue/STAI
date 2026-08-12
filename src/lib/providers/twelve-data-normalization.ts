import { z } from "zod";

import { buildNormalizedQuote } from "@/lib/canonical-quote";
import { buildCanonicalInstrumentId } from "@/lib/instrument-identity";
import {
  normalizeBarSeries,
  type NormalizedBarSeries,
} from "@/lib/canonical-bar";
import type {
  BarInterval,
  MarketDataQuality,
  MarketStatus,
  MarketUniverseAssetClass,
  NormalizedQuote,
} from "@/lib/types";

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const twelveDataQuoteSchema = z
  .object({
    symbol: z.string().optional(),
    name: z.string().optional(),
    exchange: z.string().optional(),
    mic_code: z.string().optional(),
    currency: z.string().optional(),
    type: z.string().optional(),
    timestamp: scalarSchema.optional(),
    datetime: z.string().optional(),
    close: scalarSchema.optional(),
    price: scalarSchema.optional(),
    open: scalarSchema.optional(),
    high: scalarSchema.optional(),
    low: scalarSchema.optional(),
    previous_close: scalarSchema.optional(),
    change: scalarSchema.optional(),
    percent_change: scalarSchema.optional(),
    volume: scalarSchema.optional(),
    average_volume: scalarSchema.optional(),
    is_market_open: z.boolean().optional(),
    fifty_two_week: z
      .object({
        high: scalarSchema.optional(),
        low: scalarSchema.optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const twelveDataSearchResponseSchema = z
  .object({
    status: z.string(),
    data: z.array(
      z
        .object({
          symbol: z.string(),
          instrument_name: z.string(),
          exchange: z.string().optional(),
          mic_code: z.string().optional(),
          exchange_timezone: z.string().optional(),
          instrument_type: z.string().optional(),
          country: z.string().optional(),
          currency: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const twelveDataTimeSeriesResponseSchema = z
  .object({
    status: z.string().optional(),
    meta: z
      .object({
        symbol: z.string(),
        interval: z.string(),
        currency: z.string().optional(),
        exchange_timezone: z.string().optional(),
        exchange: z.string().optional(),
        mic_code: z.string().optional(),
        type: z.string().optional(),
      })
      .passthrough(),
    values: z.array(
      z
        .object({
          datetime: z.string(),
          timestamp: scalarSchema.optional(),
          open: scalarSchema,
          high: scalarSchema,
          low: scalarSchema,
          close: scalarSchema,
          volume: scalarSchema.optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const twelveDataMarketStateSchema = z.array(
  z
    .object({
      name: z.string(),
      code: z.string(),
      country: z.string(),
      is_market_open: z.boolean(),
      time_after_open: z.string().optional(),
      time_to_open: z.string().optional(),
      time_to_close: z.string().optional(),
    })
    .passthrough(),
);

export type TwelveDataSearchRow = z.infer<
  typeof twelveDataSearchResponseSchema
>["data"][number];
export type TwelveDataMarketState = z.infer<
  typeof twelveDataMarketStateSchema
>[number];

export type TwelveDataResolvedInstrument = {
  symbol: string;
  name: string;
  assetClass: MarketUniverseAssetClass;
  instrumentType: string | null;
  exchange: string | null;
  mic: string | null;
  currency: string;
  country: string | null;
  tradingTimezone: string | null;
  providerSymbol: string;
};

const intervalMap: Record<string, BarInterval> = {
  "1min": "1m",
  "5min": "5m",
  "15min": "15m",
  "30min": "30m",
  "1h": "1h",
  "4h": "4h",
  "1day": "1d",
  "1week": "1w",
  "1month": "1mo",
};

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

const countryCodes: Record<string, string> = {
  "UNITED STATES": "US",
  GERMANY: "DE",
  "UNITED KINGDOM": "GB",
  CANADA: "CA",
  AUSTRALIA: "AU",
  AUSTRIA: "AT",
  SWITZERLAND: "CH",
  FRANCE: "FR",
  NETHERLANDS: "NL",
  BELGIUM: "BE",
  SPAIN: "ES",
  ITALY: "IT",
  PORTUGAL: "PT",
  IRELAND: "IE",
  DENMARK: "DK",
  SWEDEN: "SE",
  NORWAY: "NO",
  FINLAND: "FI",
  POLAND: "PL",
  "CZECH REPUBLIC": "CZ",
  GREECE: "GR",
  HUNGARY: "HU",
  ROMANIA: "RO",
  TURKEY: "TR",
  ISRAEL: "IL",
  INDIA: "IN",
  JAPAN: "JP",
  CHINA: "CN",
  "HONG KONG": "HK",
  SINGAPORE: "SG",
  "SOUTH KOREA": "KR",
  TAIWAN: "TW",
  THAILAND: "TH",
  MALAYSIA: "MY",
  INDONESIA: "ID",
  PHILIPPINES: "PH",
  VIETNAM: "VN",
  "NEW ZEALAND": "NZ",
  BRAZIL: "BR",
  ARGENTINA: "AR",
  MEXICO: "MX",
  CHILE: "CL",
  COLOMBIA: "CO",
  PERU: "PE",
  "SOUTH AFRICA": "ZA",
  EGYPT: "EG",
  "SAUDI ARABIA": "SA",
  "UNITED ARAB EMIRATES": "AE",
  QATAR: "QA",
  KUWAIT: "KW",
  BAHRAIN: "BH",
  OMAN: "OM",
  ICELAND: "IS",
  CYPRUS: "CY",
  LUXEMBOURG: "LU",
  MALTA: "MT",
  SLOVENIA: "SI",
  SLOVAKIA: "SK",
  CROATIA: "HR",
  SERBIA: "RS",
  BULGARIA: "BG",
  ESTONIA: "EE",
  LATVIA: "LV",
  LITHUANIA: "LT",
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positive(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function nonNegative(value: unknown): number | null {
  const parsed = numberValue(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function timestampFrom(value: unknown): string | null {
  const numeric = numberValue(value);
  if (numeric === null || numeric <= 0) return null;
  const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function quoteTimestamp(row: z.infer<typeof twelveDataQuoteSchema>) {
  const numeric = timestampFrom(row.timestamp);
  if (numeric) return numeric;
  if (!row.datetime || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(row.datetime)) {
    return null;
  }
  const parsed = Date.parse(row.datetime);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function assetClassFromType(
  value: unknown,
  symbol = "",
): MarketUniverseAssetClass {
  const type = cleanText(value, 80).toLowerCase();
  if (/exchange-traded|\betf\b|\betn\b/.test(type)) return "etf";
  if (/digital currency|cryptocurrency|crypto/.test(type)) return "crypto";
  if (/physical currency|forex|currency pair/.test(type)) return "forex";
  if (/index/.test(type)) return "index";
  if (/commodity|energy resource|agricultural/.test(type)) return "commodity";
  if (/bond/.test(type)) return "bond";
  if (/mutual fund|closed-end fund|\bfund\b/.test(type)) return "fund";
  if (/future/.test(type)) return "future";
  if (/option/.test(type)) return "option";
  if (/warrant|right/.test(type)) return "warrant";
  if (symbol.includes("/")) return "forex";
  return "stock";
}

function supportedQuoteAssetClass(
  value: unknown,
  symbol: string,
): "stock" | "etf" | "crypto" | "forex" | "index" {
  const mapped = assetClassFromType(value, symbol);
  return ["stock", "etf", "crypto", "forex", "index"].includes(mapped)
    ? (mapped as "stock" | "etf" | "crypto" | "forex" | "index")
    : "stock";
}

function canonicalSymbol(requestedSymbol: string) {
  return requestedSymbol.trim().toUpperCase();
}

function normalizedCountry(value: unknown) {
  const country = cleanText(value, 120).toUpperCase();
  if (!country) return null;
  if (/^[A-Z]{2,3}$/.test(country)) return country;
  return countryCodes[country] ?? null;
}

export function normalizeTwelveDataQuote(
  raw: unknown,
  requestedSymbol: string,
  options: {
    quality: MarketDataQuality;
    latencyMs: number;
    now?: Date;
  },
): NormalizedQuote | null {
  const parsed = twelveDataQuoteSchema.safeParse(raw);
  if (!parsed.success) return null;
  const row = parsed.data;
  const price = positive(row.close ?? row.price);
  if (price === null) return null;

  const symbol = canonicalSymbol(requestedSymbol);
  const providerSymbol = cleanText(row.symbol, 80).toUpperCase() || symbol;
  const eventTimestamp = quoteTimestamp(row);
  const marketStatus: MarketStatus =
    row.is_market_open === true
      ? "open"
      : row.is_market_open === false
        ? "closed"
        : "unknown";
  const currency = cleanText(row.currency, 8).toUpperCase() || "XXX";
  const venue =
    cleanText(row.mic_code, 32).toUpperCase() ||
    cleanText(row.exchange, 80).toUpperCase() ||
    null;
  const assetType = supportedQuoteAssetClass(row.type, providerSymbol);
  const instrumentId =
    venue && currency !== "XXX"
      ? buildCanonicalInstrumentId({
          assetClass: assetType,
          exchange: venue,
          symbol,
          currency,
        })
      : null;

  return buildNormalizedQuote(
    {
      instrumentId,
      symbol,
      name: cleanText(row.name, 160) || undefined,
      assetType,
      providerId: "twelve_data",
      providerSymbol,
      venue,
      currency,
      last: price,
      open: numberValue(row.open),
      high: numberValue(row.high),
      low: numberValue(row.low),
      previousClose: numberValue(row.previous_close),
      change: numberValue(row.change),
      changePercent: numberValue(row.percent_change),
      volume: nonNegative(row.volume),
      fiftyTwoWeekHigh: positive(row.fifty_two_week?.high),
      fiftyTwoWeekLow: positive(row.fifty_two_week?.low),
      marketStatus,
      eventTimestamp,
      providerTimestamp: eventTimestamp,
      receivedTimestamp: (options.now ?? new Date()).toISOString(),
      provider: "Twelve Data",
      quality: options.quality,
      latencyMs: options.latencyMs,
      reportedDelaySeconds: null,
      sourceQualityIssues: ["twelve_data_delay_unverified"],
    },
    { now: options.now },
  );
}

export function normalizeTwelveDataBatchQuotes(
  raw: unknown,
  requestedSymbols: readonly string[],
  options: {
    quality: MarketDataQuality;
    latencyMs: number;
    now?: Date;
  },
) {
  const requested = requestedSymbols.map(canonicalSymbol);
  const direct = twelveDataQuoteSchema.safeParse(raw);
  if (direct.success && positive(direct.data.close ?? direct.data.price)) {
    const symbol = requested[0];
    const quote = symbol
      ? normalizeTwelveDataQuote(direct.data, symbol, options)
      : null;
    return quote ? [quote] : [];
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

  return requested.flatMap((symbol) => {
    const providerSymbol = symbol.replace(/-USD$/, "/USD");
    const record = raw as Record<string, unknown>;
    const row =
      record[providerSymbol] ??
      record[symbol] ??
      Object.values(record).find((entry) => {
        const candidate = twelveDataQuoteSchema.safeParse(entry);
        return (
          candidate.success &&
          cleanText(candidate.data.symbol, 80).toUpperCase() === providerSymbol
        );
      });
    const quote = normalizeTwelveDataQuote(row, symbol, options);
    return quote ? [quote] : [];
  });
}

export function normalizeTwelveDataSearch(
  raw: unknown,
): TwelveDataResolvedInstrument[] {
  const parsed = twelveDataSearchResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.status.toLowerCase() !== "ok") return [];

  return parsed.data.data.flatMap((row) => {
    const symbol = cleanText(row.symbol, 80).toUpperCase();
    const name = cleanText(row.instrument_name, 240);
    if (!symbol || !name) return [];
    return [
      {
        symbol,
        name,
        assetClass: assetClassFromType(row.instrument_type, symbol),
        instrumentType: cleanText(row.instrument_type, 80) || null,
        exchange: cleanText(row.exchange, 120) || null,
        mic: cleanText(row.mic_code, 32).toUpperCase() || null,
        currency: cleanText(row.currency, 12).toUpperCase() || "XXX",
        country: normalizedCountry(row.country),
        tradingTimezone: cleanText(row.exchange_timezone, 80) || null,
        providerSymbol: symbol,
      },
    ];
  });
}

function barOpenTime(datetime: string, interval: BarInterval) {
  const trimmed = datetime.trim();
  if (!trimmed) return null;
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
      ? trimmed
      : `${trimmed.replace(" ", "T")}Z`;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) return null;
  const open = new Date(parsed);
  if (interval !== "1mo") {
    return {
      open: open.toISOString(),
      close: new Date(open.getTime() + intervalMilliseconds[interval]).toISOString(),
    };
  }
  return {
    open: open.toISOString(),
    close: new Date(
      Date.UTC(open.getUTCFullYear(), open.getUTCMonth() + 1, 1),
    ).toISOString(),
  };
}

export function normalizeTwelveDataBars(
  raw: unknown,
  requestedSymbol: string,
  options: {
    instrumentId?: string | null;
    venue?: string | null;
    currency?: string | null;
    now?: Date;
  } = {},
): NormalizedBarSeries {
  const parsed = twelveDataTimeSeriesResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return normalizeBarSeries([], { now: options.now });
  }
  const interval = intervalMap[parsed.data.meta.interval];
  if (!interval) return normalizeBarSeries([], { now: options.now });
  const meta = parsed.data.meta;
  const symbol = canonicalSymbol(requestedSymbol);
  const venue = options.venue ?? meta.mic_code ?? meta.exchange ?? null;
  const currency = options.currency ?? meta.currency ?? "XXX";

  const rows = parsed.data.values.flatMap((row) => {
    const times = barOpenTime(row.datetime, interval);
    const volume = nonNegative(row.volume);
    // 0 ist ein echter Wert. Fehlendes Volumen wird nicht als 0 erfunden,
    // sondern als ungueltige Providerzeile im Serienbericht gezaehlt.
    if (!times) return [];
    return [
      {
        instrumentId: options.instrumentId ?? null,
        providerId: "twelve_data",
        providerSymbol: meta.symbol,
        venue,
        symbol,
        range: interval === "1d" ? "MAX" : "1D",
        interval,
        openTime: times.open,
        closeTime: times.close,
        time: row.datetime,
        open: positive(row.open),
        high: positive(row.high),
        low: positive(row.low),
        close: positive(row.close),
        volume,
        currency,
        isAdjusted: false,
        adjustmentType: "RAW",
        provider: "Twelve Data",
        providerTimestamp: null,
        receivedTimestamp: (options.now ?? new Date()).toISOString(),
        sessionTimeZone: meta.exchange_timezone ?? null,
        quality: "historical",
        sourceQualityIssues: ["provider_timestamp_missing"],
      },
    ];
  });

  return normalizeBarSeries(rows, { now: options.now });
}

export function normalizeTwelveDataMarketState(
  raw: unknown,
): TwelveDataMarketState[] {
  const parsed = twelveDataMarketStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function resolveTwelveDataInstrument(
  candidates: readonly TwelveDataResolvedInstrument[],
  identifier: { symbol: string; exchange?: string; mic?: string; country?: string },
): {
  status: "resolved" | "ambiguous" | "not_found";
  instrument: TwelveDataResolvedInstrument | null;
  candidates: TwelveDataResolvedInstrument[];
} {
  const symbol = canonicalSymbol(identifier.symbol);
  const exact = candidates.filter((item) => item.symbol === symbol);
  const normalizedExchange = cleanText(identifier.exchange, 120).toUpperCase();
  const normalizedMic = cleanText(identifier.mic, 32).toUpperCase();
  const normalizedCountry = cleanText(identifier.country, 120).toUpperCase();
  const narrowed = exact.filter((item) => {
    if (normalizedMic && item.mic?.toUpperCase() !== normalizedMic) return false;
    if (
      normalizedExchange &&
      item.exchange?.toUpperCase() !== normalizedExchange
    )
      return false;
    if (normalizedCountry && item.country?.toUpperCase() !== normalizedCountry)
      return false;
    return true;
  });
  const matches = narrowed.length || normalizedExchange || normalizedMic || normalizedCountry
    ? narrowed
    : exact;
  if (matches.length === 1) {
    return { status: "resolved", instrument: matches[0], candidates: matches };
  }
  return {
    status: matches.length > 1 ? "ambiguous" : "not_found",
    instrument: null,
    candidates: matches,
  };
}
