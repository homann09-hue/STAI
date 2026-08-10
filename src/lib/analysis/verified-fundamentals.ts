import type {
  Fundamentals,
  FundamentalsEvidence,
  FundamentalsFieldSource,
  MarketDataQuality,
} from "@/lib/types";

const FUNDAMENTAL_FIELDS = [
  "peRatio",
  "revenueGrowth",
  "earningsGrowth",
  "debtToEquity",
  "cashflow",
  "dividendYield",
  "marketCap",
] as const satisfies ReadonlyArray<keyof Fundamentals>;

type FundamentalsPayload = {
  fundamentals: Fundamentals | null;
  metadata: {
    provider: string;
    quality: MarketDataQuality;
    fetchedAt: string;
    fields: Partial<Record<keyof Fundamentals, FundamentalsFieldSource>>;
    caveat: string | null;
    fallback: {
      warning: string | null;
    };
  };
} | null;

type QuoteMarketCap = {
  value?: number;
  provider: string;
  quality: MarketDataQuality;
  fetchedAt: string;
};

function emptyFundamentals(): Fundamentals {
  return {
    peRatio: null,
    revenueGrowth: 0,
    earningsGrowth: 0,
    debtToEquity: 0,
    cashflow: 0,
    dividendYield: null,
    marketCap: 0,
  };
}

function usableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

/**
 * Entfernt alle Mock- und unbekannten Fallbackwerte aus einem gemischten
 * Providerergebnis. Ein separat belegter Market Cap aus dem Quote darf die
 * Lücke schließen, weil seine Herkunft unabhängig bekannt ist.
 */
export function selectVerifiedFundamentals(
  payload: FundamentalsPayload,
  quoteMarketCap: QuoteMarketCap,
): { fundamentals: Fundamentals; evidence: FundamentalsEvidence } {
  const fundamentals = emptyFundamentals();
  const fields = Object.fromEntries(
    FUNDAMENTAL_FIELDS.map((field) => [
      field,
      payload?.metadata.fields[field] ?? "unavailable",
    ]),
  ) as Partial<Record<keyof Fundamentals, FundamentalsFieldSource>>;
  const providers: string[] = [];

  for (const field of FUNDAMENTAL_FIELDS) {
    const value = payload?.fundamentals?.[field];
    if (!payload || fields[field] !== "provider" || !usableNumber(value))
      continue;
    (fundamentals as unknown as Record<keyof Fundamentals, number | null>)[
      field
    ] = value;
    providers.push(payload.metadata.provider);
  }

  if (
    fields.marketCap !== "provider" &&
    usableNumber(quoteMarketCap.value) &&
    quoteMarketCap.value > 0 &&
    quoteMarketCap.quality !== "mock" &&
    quoteMarketCap.quality !== "unavailable"
  ) {
    fundamentals.marketCap = quoteMarketCap.value;
    fields.marketCap = "provider";
    providers.push(quoteMarketCap.provider);
  }

  const verifiedFields = FUNDAMENTAL_FIELDS.filter(
    (field) => fields[field] === "provider",
  );
  const excludedMockFields = FUNDAMENTAL_FIELDS.filter(
    (field) => fields[field] === "mock",
  );
  const unavailableFields = FUNDAMENTAL_FIELDS.filter(
    (field) => fields[field] === "unavailable",
  );
  const provider = unique(providers).join(" + ") || "StockPilot Analysis Guard";
  const onlyQuoteMarketCap =
    verifiedFields.length === 1 && verifiedFields[0] === "marketCap";
  const quality = onlyQuoteMarketCap
    ? quoteMarketCap.quality
    : payload && verifiedFields.length > 0
      ? payload.metadata.quality
      : "unavailable";
  const fetchedAt =
    onlyQuoteMarketCap || !payload
      ? quoteMarketCap.fetchedAt
      : payload.metadata.fetchedAt;

  return {
    fundamentals,
    evidence: {
      provider,
      quality,
      fetchedAt,
      fields,
      verifiedFields,
      excludedMockFields,
      unavailableFields,
      verifiedCount: verifiedFields.length,
      totalFields: FUNDAMENTAL_FIELDS.length,
      coveragePercent: Math.round(
        (verifiedFields.length / FUNDAMENTAL_FIELDS.length) * 100,
      ),
      caveat: payload?.metadata.caveat ?? null,
      warning:
        excludedMockFields.length > 0
          ? `${excludedMockFields.length} Mock-/Fallback-Feld(er) wurden aus der produktiven Asset-Ansicht entfernt.`
          : (payload?.metadata.fallback.warning ?? null),
    },
  };
}
