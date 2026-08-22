import type {
  CanonicalInstrument,
  InstrumentAnalysisReadiness,
  InstrumentIdentifier,
  InstrumentResolutionStatus,
  MarketDataQuality,
  MarketUniverseInstrument,
} from "@/lib/types";

export type InstrumentCatalogOrigin = "instrument_master" | "provider_search";
export type InstrumentQuoteStatus =
  "unknown" | "available" | "restricted" | "error";

export interface InstrumentCatalogHit extends CanonicalInstrument {
  exchange: string;
  exchangeFullName: string | null;
  provider: string;
  identifiers: InstrumentIdentifier[];
  identityConfidence: number;
  resolutionStatus: InstrumentResolutionStatus;
  resolutionWarnings: string[];
  origin: InstrumentCatalogOrigin;
  quoteStatus: InstrumentQuoteStatus;
  quoteQuality: MarketDataQuality;
  quoteCheckedAt: string | null;
  discoveredAt: string;
  confirmationCount: number;
  matchedVia: "symbol" | "name" | "identifier" | null;
}

export interface InstrumentCatalogCoverage {
  complete: false;
  mode: "search_driven";
  directorySyncAvailable: boolean;
  note: string;
  consequence: string;
  verifiedAt: string;
}

function normalizedSearchValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("en-US");
}

function catalogSearchScore(
  hit: InstrumentCatalogHit,
  normalizedQuery: string,
): number {
  const symbol = normalizedSearchValue(hit.symbol);
  const displaySymbol = normalizedSearchValue(hit.displaySymbol);
  const name = normalizedSearchValue(hit.name);
  const identifiers = hit.identifiers.map((identifier) =>
    normalizedSearchValue(identifier.value),
  );

  let relevance = 0;
  if (normalizedQuery) {
    if (symbol === normalizedQuery) relevance = 1_000_000;
    else if (displaySymbol === normalizedQuery) relevance = 950_000;
    else if (identifiers.includes(normalizedQuery)) relevance = 900_000;
    else if (symbol.startsWith(normalizedQuery)) relevance = 800_000;
    else if (displaySymbol.startsWith(normalizedQuery)) relevance = 750_000;
    else if (name === normalizedQuery) relevance = 700_000;
    else if (name.startsWith(normalizedQuery)) relevance = 650_000;
    else if (
      identifiers.some((identifier) => identifier.startsWith(normalizedQuery))
    )
      relevance = 600_000;
    else if (name.includes(normalizedQuery)) relevance = 500_000;
    else if (symbol.includes(normalizedQuery)) relevance = 400_000;
    else if (displaySymbol.includes(normalizedQuery)) relevance = 350_000;
    else if (
      identifiers.some((identifier) => identifier.includes(normalizedQuery))
    )
      relevance = 300_000;
  }

  const resolution =
    hit.resolutionStatus === "resolved"
      ? 10_000
      : hit.resolutionStatus === "ambiguous"
        ? 5_000
        : 0;
  const quote =
    hit.quoteStatus === "available"
      ? 2_000
      : hit.quoteStatus === "unknown"
        ? 1_000
        : 0;
  const origin = hit.origin === "instrument_master" ? 500 : 0;
  const confidence = Math.min(100, Math.max(0, hit.identityConfidence));
  const confirmations = Math.min(
    100,
    Math.max(0, Math.floor(hit.confirmationCount)),
  );

  return relevance + resolution + quote + origin + confidence + confirmations;
}

export function rankInstrumentCatalogHits(
  hits: readonly InstrumentCatalogHit[],
  query: string,
): InstrumentCatalogHit[] {
  const normalizedQuery = normalizedSearchValue(query);
  const providerOrder = new Map(
    hits.map((hit, index) => [hit.canonicalId, index] as const),
  );
  return [...hits].sort((left, right) => {
    const scoreDifference =
      catalogSearchScore(right, normalizedQuery) -
      catalogSearchScore(left, normalizedQuery);
    if (scoreDifference !== 0) return scoreDifference;
    // Bei fachlich gleichem Score bleibt die Relevanzreihenfolge des
    // Providers erhalten. Alphabetische Canonical-IDs hatten bei AAPL das
    // argentinische Nebenlisting vor NASDAQ sortiert.
    const orderDifference =
      (providerOrder.get(left.canonicalId) ?? Number.MAX_SAFE_INTEGER) -
      (providerOrder.get(right.canonicalId) ?? Number.MAX_SAFE_INTEGER);
    return (
      orderDifference || left.canonicalId.localeCompare(right.canonicalId, "en")
    );
  });
}

function readinessFor(hit: InstrumentCatalogHit): {
  status: InstrumentAnalysisReadiness;
  blockers: string[];
} {
  const blockers: string[] = [];

  if (hit.resolutionStatus === "invalid")
    blockers.push("Instrumentidentitaet ist ungueltig.");
  if (hit.resolutionStatus === "ambiguous")
    blockers.push("Instrumentidentitaet ist mehrdeutig.");
  if (hit.quoteStatus === "unknown")
    blockers.push("Kursverfuegbarkeit wurde noch nicht gemessen.");
  if (hit.quoteStatus === "restricted")
    blockers.push("Kursdaten sind im aktiven Tarif gesperrt.");
  if (hit.quoteStatus === "error")
    blockers.push("Letzter Kursabruf ist fehlgeschlagen.");
  if (hit.quoteQuality === "unavailable")
    blockers.push("Keine verifizierte Kursqualitaet vorhanden.");

  if (
    hit.resolutionStatus === "invalid" ||
    hit.quoteStatus === "restricted" ||
    hit.quoteStatus === "error"
  ) {
    return { status: "blocked", blockers };
  }

  if (
    blockers.length > 0 ||
    hit.resolutionStatus !== "resolved" ||
    hit.quoteQuality === "delayed" ||
    hit.quoteQuality === "historical"
  ) {
    return { status: "limited", blockers };
  }

  return { status: "ready", blockers };
}

export function instrumentCatalogHitToUniverse(
  hit: InstrumentCatalogHit,
): MarketUniverseInstrument {
  const readiness = readinessFor(hit);
  const coverage: MarketUniverseInstrument["coverage"] =
    hit.quoteStatus === "available"
      ? "available"
      : hit.quoteStatus === "restricted"
        ? "license_required"
        : hit.quoteStatus === "error"
          ? "provider_missing"
          : "prepared";

  const note =
    hit.quoteStatus === "available"
      ? "Kursverfuegbarkeit wurde im aktiven Tarif gemessen. Datenqualitaet und Zeitpunkt bleiben je Abruf sichtbar."
      : hit.quoteStatus === "restricted"
        ? "Instrument ist bekannt, Kursdaten sind im aktiven Provider-Tarif jedoch gesperrt."
        : hit.quoteStatus === "error"
          ? "Instrument ist bekannt, der letzte Kursabruf ist jedoch fehlgeschlagen."
          : "Instrument wurde vom Provider bestaetigt; die Kursverfuegbarkeit ist noch ungeprueft.";

  return {
    symbol: hit.symbol,
    displaySymbol: hit.displaySymbol,
    normalizedSymbol: hit.symbol,
    canonicalId: hit.canonicalId,
    internalInstrumentId: hit.internalInstrumentId,
    name: hit.name,
    assetClass: hit.assetClass,
    instrumentType: hit.instrumentType,
    exchange: hit.exchange,
    exchangeName: hit.exchangeName,
    exchangeCode: hit.exchangeCode,
    mic: hit.mic,
    country: hit.country ?? "nicht geliefert",
    currency: hit.currency,
    isin: hit.isin,
    figi: hit.figi,
    providerMappings: hit.providerMappings,
    tradingTimezone: hit.tradingTimezone,
    pricePrecision: hit.pricePrecision,
    quantityPrecision: hit.quantityPrecision,
    isActive: hit.isActive,
    isDelisted: hit.isDelisted,
    identifiers: hit.identifiers,
    identityConfidence: hit.identityConfidence,
    resolutionStatus: hit.resolutionStatus,
    resolutionWarnings: hit.resolutionWarnings,
    detailHref: `/assets/${encodeURIComponent(hit.symbol)}?canonicalId=${encodeURIComponent(hit.canonicalId)}`,
    analysisReadiness: readiness.status,
    analysisBlockers: readiness.blockers,
    provider: hit.provider,
    quality: hit.quoteQuality,
    quoteQuality: hit.quoteQuality,
    coverage,
    subscribable:
      hit.quoteStatus === "available" &&
      (hit.quoteQuality === "realtime" || hit.quoteQuality === "near_realtime"),
    lastUpdatedAt: hit.quoteCheckedAt ?? hit.discoveredAt,
    note,
    origin: hit.origin,
    quoteStatus: hit.quoteStatus,
    quoteCheckedAt: hit.quoteCheckedAt,
    discoveredAt: hit.discoveredAt,
  };
}
