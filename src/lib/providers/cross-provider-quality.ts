import type { NormalizedQuote, QuoteQualityStatus } from "@/lib/types";

export type CrossProviderComparisonStatus =
  | "single_source"
  | "confirmed"
  | "divergent"
  | "incomparable"
  | "stale_comparison";

export interface CrossProviderObservation {
  providerId: string;
  provider: string;
  providerSymbol: string;
  venue: string | null;
  currency: string;
  price: number;
  eventTimestamp: string | null;
  receivedTimestamp: string;
}

export interface CrossProviderComparison {
  primaryProviderId: string;
  secondaryProviderId: string;
  status: Exclude<CrossProviderComparisonStatus, "single_source">;
  differencePercent: number | null;
  allowedDifferencePercent: number;
  timestampSkewMs: number | null;
  issues: string[];
}

export interface CrossProviderQualityReport {
  status: CrossProviderComparisonStatus;
  providerCount: number;
  comparableProviderCount: number;
  primaryProviderId: string | null;
  selectedPrice: number | null;
  selectedProvider: string | null;
  comparisons: CrossProviderComparison[];
  observations: CrossProviderObservation[];
  issues: string[];
  analysisAllowed: boolean;
}

export interface CrossProviderSelection {
  quote: NormalizedQuote | null;
  report: CrossProviderQualityReport;
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(maximum, parsed)
    : fallback;
}

export function getCrossProviderQuoteCount(): number {
  return boundedInteger(process.env.MARKET_DATA_CROSSCHECK_PROVIDER_COUNT, 2, 4);
}

function providerCurrency(quote: NormalizedQuote): string {
  const providerSymbol = quote.providerSymbol.toUpperCase();
  for (const suffix of ["FDUSD", "USDT", "USDC", "BUSD", "USD", "EUR", "GBP", "BTC", "ETH"]) {
    if (providerSymbol.endsWith(suffix)) return suffix;
  }
  return quote.currency.toUpperCase();
}

function timestampMs(quote: NormalizedQuote): number | null {
  const value = quote.eventTimestamp ?? quote.providerTimestamp ?? quote.timestamp;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function baseTolerancePercent(quote: NormalizedQuote): number {
  const configured = Number(process.env.MARKET_DATA_CROSSCHECK_TOLERANCE_BPS);
  if (Number.isFinite(configured) && configured > 0) return Math.min(10, configured / 100);
  if (quote.assetType === "forex") return 0.25;
  if (quote.assetType === "crypto") return 1;
  return 0.75;
}

function spreadPercent(quote: NormalizedQuote): number {
  return quote.spread !== null && quote.price > 0
    ? (quote.spread / quote.price) * 100
    : 0;
}

function tolerancePercent(primary: NormalizedQuote, secondary: NormalizedQuote): number {
  const marketClosed = primary.marketStatus === "closed" || secondary.marketStatus === "closed";
  return Math.max(
    baseTolerancePercent(primary) + (marketClosed ? 1 : 0),
    spreadPercent(primary) * 3,
    spreadPercent(secondary) * 3,
  );
}

function allowedSkewMs(primary: NormalizedQuote, secondary: NormalizedQuote): number {
  const configured = Number(process.env.MARKET_DATA_CROSSCHECK_MAX_SKEW_MS);
  if (Number.isFinite(configured) && configured >= 1_000) return Math.min(3_600_000, configured);
  const delayed = [primary.quality, secondary.quality].some((quality) => quality === "delayed" || quality === "historical");
  return delayed ? 20 * 60_000 : 2 * 60_000;
}

function observation(quote: NormalizedQuote): CrossProviderObservation {
  return {
    providerId: quote.providerId,
    provider: quote.provider,
    providerSymbol: quote.providerSymbol,
    venue: quote.venue,
    currency: providerCurrency(quote),
    price: quote.price,
    eventTimestamp: quote.eventTimestamp,
    receivedTimestamp: quote.receivedTimestamp,
  };
}

function compare(primary: NormalizedQuote, secondary: NormalizedQuote): CrossProviderComparison {
  const issues: string[] = [];
  const allowedDifferencePercent = tolerancePercent(primary, secondary);
  if (primary.symbol !== secondary.symbol || primary.assetType !== secondary.assetType) issues.push("cross_provider_instrument_mismatch");
  if (providerCurrency(primary) !== providerCurrency(secondary)) issues.push("cross_provider_currency_mismatch");
  if (primary.marketSession !== secondary.marketSession) issues.push("cross_provider_session_mismatch");
  const primaryTimestamp = timestampMs(primary);
  const secondaryTimestamp = timestampMs(secondary);
  const timestampSkewMs = primaryTimestamp !== null && secondaryTimestamp !== null
    ? Math.abs(primaryTimestamp - secondaryTimestamp)
    : null;
  if (timestampSkewMs === null) issues.push("cross_provider_timestamp_missing");
  else if (timestampSkewMs > allowedSkewMs(primary, secondary)) issues.push("cross_provider_timestamp_skew");

  if (issues.some((issue) => issue.endsWith("mismatch"))) {
    return {
      primaryProviderId: primary.providerId,
      secondaryProviderId: secondary.providerId,
      status: "incomparable",
      differencePercent: null,
      allowedDifferencePercent,
      timestampSkewMs,
      issues,
    };
  }
  if (issues.includes("cross_provider_timestamp_skew") || issues.includes("cross_provider_timestamp_missing")) {
    return {
      primaryProviderId: primary.providerId,
      secondaryProviderId: secondary.providerId,
      status: "stale_comparison",
      differencePercent: null,
      allowedDifferencePercent,
      timestampSkewMs,
      issues,
    };
  }

  const midpoint = (primary.price + secondary.price) / 2;
  const differencePercent = midpoint > 0
    ? (Math.abs(primary.price - secondary.price) / midpoint) * 100
    : Number.POSITIVE_INFINITY;
  if (differencePercent > allowedDifferencePercent) issues.push("cross_provider_price_divergence");
  if (primary.venue !== secondary.venue) issues.push("cross_venue_comparison");
  return {
    primaryProviderId: primary.providerId,
    secondaryProviderId: secondary.providerId,
    status: differencePercent > allowedDifferencePercent ? "divergent" : "confirmed",
    differencePercent: Number(differencePercent.toFixed(6)),
    allowedDifferencePercent: Number(allowedDifferencePercent.toFixed(6)),
    timestampSkewMs,
    issues,
  };
}

function uniqueIssues(values: readonly string[]): string[] {
  return [...new Set(values)].slice(0, 32);
}

function adjustedQuote(
  primary: NormalizedQuote,
  status: CrossProviderComparisonStatus,
  issues: string[],
): NormalizedQuote {
  let qualityStatus: QuoteQualityStatus = primary.qualityStatus;
  let qualityScore = primary.qualityScore;
  if (status === "divergent") {
    qualityStatus = "DIVERGENT";
    qualityScore = Math.min(25, qualityScore);
  } else if (status === "incomparable" || status === "stale_comparison") {
    qualityStatus = primary.qualityStatus === "INVALID" ? "INVALID" : "PARTIAL";
    qualityScore = Math.min(60, qualityScore);
  } else if (status === "confirmed") {
    qualityScore = Math.min(100, qualityScore + 2);
  }
  return {
    ...primary,
    qualityStatus,
    qualityScore,
    qualityIssues: uniqueIssues([...primary.qualityIssues, ...issues]),
  };
}

export function selectCrossProviderQuote(quotes: readonly NormalizedQuote[]): CrossProviderSelection {
  const deduplicated = quotes.filter(
    (quote, index) => quotes.findIndex((candidate) => candidate.providerId === quote.providerId) === index,
  );
  const primary = deduplicated[0] ?? null;
  if (!primary) {
    return {
      quote: null,
      report: {
        status: "single_source",
        providerCount: 0,
        comparableProviderCount: 0,
        primaryProviderId: null,
        selectedPrice: null,
        selectedProvider: null,
        comparisons: [],
        observations: [],
        issues: ["quote_unavailable"],
        analysisAllowed: false,
      },
    };
  }
  if (deduplicated.length === 1) {
    const issues = uniqueIssues([...primary.qualityIssues, "single_provider_quote"]);
    return {
      quote: { ...primary, qualityIssues: issues },
      report: {
        status: "single_source",
        providerCount: 1,
        comparableProviderCount: 0,
        primaryProviderId: primary.providerId,
        selectedPrice: primary.price,
        selectedProvider: primary.provider,
        comparisons: [],
        observations: [observation(primary)],
        issues: ["single_provider_quote"],
        analysisAllowed: primary.qualityStatus !== "INVALID" && primary.qualityStatus !== "UNAVAILABLE",
      },
    };
  }

  const comparisons = deduplicated.slice(1).map((secondary) => compare(primary, secondary));
  const status: CrossProviderComparisonStatus = comparisons.some((item) => item.status === "divergent")
    ? "divergent"
    : comparisons.some((item) => item.status === "confirmed")
      ? "confirmed"
      : comparisons.some((item) => item.status === "stale_comparison")
        ? "stale_comparison"
        : "incomparable";
  const issues = uniqueIssues([
    status === "confirmed" ? "cross_provider_confirmed" : `cross_provider_${status}`,
    ...comparisons.flatMap((item) => item.issues),
  ]);
  return {
    quote: adjustedQuote(primary, status, issues),
    report: {
      status,
      providerCount: deduplicated.length,
      comparableProviderCount: comparisons.filter((item) => item.status === "confirmed" || item.status === "divergent").length + 1,
      primaryProviderId: primary.providerId,
      selectedPrice: primary.price,
      selectedProvider: primary.provider,
      comparisons,
      observations: deduplicated.map(observation),
      issues,
      analysisAllowed: status !== "divergent" && primary.qualityStatus !== "INVALID" && primary.qualityStatus !== "UNAVAILABLE",
    },
  };
}
