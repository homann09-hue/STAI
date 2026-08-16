import { quoteFeedTypeForQuality } from "@/lib/canonical-quote";
import type { MarketDataQuality, NormalizedTrade } from "@/lib/types";

export type FinnhubQuotePayload = {
  c?: number;
  d?: number | null;
  dp?: number | null;
  h?: number | null;
  l?: number | null;
  o?: number | null;
  pc?: number | null;
  t?: number | null;
};

export type FinnhubQuoteSnapshot = {
  price: number;
  change: number | null;
  changePercent: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  timestamp: string;
};

export type FinnhubTradePayload = {
  s?: string;
  p?: number;
  v?: number;
  t?: number;
  c?: string[] | null;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function positive(value: unknown): number | null {
  const parsed = finite(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function isoFromEpoch(value: unknown, multiplier: number): string | null {
  const parsed = finite(value);
  if (parsed === null || parsed <= 0) return null;
  const date = new Date(parsed * multiplier);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function normalizeFinnhubQuote(
  payload: FinnhubQuotePayload,
  receivedAt = new Date(),
): FinnhubQuoteSnapshot | null {
  const price = positive(payload.c);
  if (price === null) return null;

  return {
    price,
    change: finite(payload.d),
    changePercent: finite(payload.dp),
    high: positive(payload.h),
    low: positive(payload.l),
    open: positive(payload.o),
    previousClose: positive(payload.pc),
    timestamp: isoFromEpoch(payload.t, 1_000) ?? receivedAt.toISOString(),
  };
}

export function normalizeFinnhubTrade(
  payload: FinnhubTradePayload,
  options: {
    quality: MarketDataQuality;
    receivedAt?: Date;
    resolveSymbol?: (providerSymbol: string) => string;
  },
): NormalizedTrade | null {
  const providerSymbol = payload.s?.trim().toUpperCase() ?? "";
  const symbol = options.resolveSymbol?.(providerSymbol) ?? providerSymbol;
  const price = positive(payload.p);
  const size = positive(payload.v);
  const eventTimestamp = isoFromEpoch(payload.t, 1);
  if (!providerSymbol || !symbol || price === null || size === null || !eventTimestamp) {
    return null;
  }

  const receivedTimestamp = (options.receivedAt ?? new Date()).toISOString();
  return {
    instrumentId: null,
    symbol,
    providerId: "finnhub",
    providerSymbol,
    venue: providerSymbol.includes(":") ? providerSymbol.split(":", 1)[0] : null,
    price,
    size,
    tradeId: null,
    conditions: Array.isArray(payload.c)
      ? payload.c.filter((condition): condition is string => typeof condition === "string")
      : [],
    tape: null,
    eventTimestamp,
    providerTimestamp: eventTimestamp,
    receivedTimestamp,
    provider: "Finnhub",
    quality: options.quality,
    feedType: quoteFeedTypeForQuality(options.quality),
    isRealtime: options.quality === "realtime",
    reportedDelaySeconds: null,
    qualityIssues: [
      "Finnhub WebSocket liefert Handelsereignisse, keine Bid/Ask-Quotes.",
      "Verzoegerung und Boersenfeed sind tarif- und symbolabhaengig.",
    ],
  };
}
