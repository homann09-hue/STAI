import { normalizeCanonicalQuoteRecord } from "@/lib/canonical-quote";
import { parseCanonicalQuoteIdentity } from "@/lib/quote-request-identity";
import type { NormalizedQuote } from "@/lib/types";

export type MarketStreamSubscription =
  | { canonicalIds: readonly string[] }
  | { symbols: readonly string[] };

export type MarketStreamIdentityMode = "canonical" | "legacy_symbol";

export interface NormalizedMarketStreamSubscription {
  mode: MarketStreamIdentityMode;
  values: string[];
  key: string;
  query: string;
}

const SAFE_SYMBOL = /^[A-Z0-9][A-Z0-9._:/-]{0,31}$/;

export function normalizeMarketStreamSubscription(
  subscription: MarketStreamSubscription,
): NormalizedMarketStreamSubscription {
  if ("canonicalIds" in subscription) {
    const values = [
      ...new Set(
        subscription.canonicalIds
          .map((value) => parseCanonicalQuoteIdentity(value)?.canonicalId ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ].slice(0, 30);
    return {
      mode: "canonical",
      values,
      key: `canonical:${values.join(",")}`,
      query: `canonicalIds=${encodeURIComponent(values.join(","))}`,
    };
  }

  const values = [
    ...new Set(
      subscription.symbols
        .map((value) => value.trim().toUpperCase())
        .filter((value) => SAFE_SYMBOL.test(value)),
    ),
  ].slice(0, 30);
  return {
    mode: "legacy_symbol",
    values,
    key: `legacy:${values.join(",")}`,
    query: `symbols=${encodeURIComponent(values.join(","))}`,
  };
}

export function quoteKeyForStreamMode(
  quote: NormalizedQuote,
  mode: MarketStreamIdentityMode,
) {
  if (mode === "canonical") return quote.canonicalId?.trim().toLowerCase() ?? null;
  return quote.symbol.trim().toUpperCase() || null;
}

export function indexQuotesForStreamSubscription(
  rawQuotes: readonly unknown[],
  subscription: NormalizedMarketStreamSubscription,
) {
  const allowed = new Set(subscription.values);
  const indexed: Record<string, NormalizedQuote> = {};
  for (const rawQuote of rawQuotes) {
    const quote = normalizeCanonicalQuoteRecord(rawQuote);
    if (!quote) continue;
    const key = quoteKeyForStreamMode(quote, subscription.mode);
    if (!key || !allowed.has(key)) continue;
    indexed[key] = quote;
  }
  return indexed;
}
