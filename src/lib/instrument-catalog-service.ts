import "server-only";

import { buildCanonicalInstrument } from "@/lib/canonical-instrument";
import {
  instrumentDirectoryCapabilityReport,
  searchProviderInstruments,
} from "@/lib/providers/instrument-directory-provider";
import {
  buildCanonicalInstrumentId,
  instrumentRecordFromHit,
  persistInstrumentHits,
  searchStoredInstruments,
} from "@/lib/instrument-master-store";
import { logEvent } from "@/lib/observability";
import type {
  InstrumentCatalogCoverage,
  InstrumentCatalogHit,
  InstrumentQuoteStatus,
} from "@/lib/instrument-catalog";
import type {
  InstrumentIdentifier,
  MarketDataQuality,
  MarketUniverseAssetClass,
} from "@/lib/types";

export const instrumentCatalogAssetClasses = [
  "stock",
  "etf",
  "crypto",
  "index",
  "forex",
  "commodity",
  "bond",
  "future",
  "option",
  "warrant",
  "fund",
] as const satisfies ReadonlyArray<MarketUniverseAssetClass>;

export interface InstrumentCatalogSearchInput {
  query?: string;
  assetClass?: MarketUniverseAssetClass | "all";
  limit?: number;
}

function quoteStatus(value: unknown): InstrumentQuoteStatus {
  return value === "available" || value === "restricted" || value === "error"
    ? value
    : "unknown";
}

function configuredQuality(
  provider: string,
  status: InstrumentQuoteStatus,
): MarketDataQuality {
  if (status !== "available") return "unavailable";

  const id = provider.trim().toLowerCase();
  const envName = id.includes("finnhub")
    ? "FINNHUB_DATA_QUALITY"
    : id.includes("twelve")
      ? "TWELVE_DATA_QUALITY"
      : id.includes("eodhd")
        ? "EODHD_DATA_QUALITY"
        : id.includes("massive") || id.includes("polygon")
          ? "MASSIVE_DATA_QUALITY"
          : id.includes("alpha")
            ? "ALPHA_VANTAGE_DATA_QUALITY"
            : "FMP_DATA_QUALITY";
  const configured = process.env[envName] as MarketDataQuality | undefined;
  const allowed: MarketDataQuality[] = [
    "realtime",
    "near_realtime",
    "delayed",
    "historical",
  ];
  return configured && allowed.includes(configured) ? configured : "delayed";
}

function normalizeIdentifiers(
  value: unknown,
  symbol: string,
  exchange: string,
  provider: string,
) {
  const identifiers = Array.isArray(value)
    ? value
        .map((item): InstrumentIdentifier | null => {
          if (!item || typeof item !== "object") return null;
          const record = item as Record<string, unknown>;
          const type = String(
            record.identifier_type ?? record.type ?? "",
          ) as InstrumentIdentifier["type"];
          const identifierValue = String(record.value ?? "").trim();
          if (!identifierValue) return null;
          return {
            type,
            value: identifierValue,
            provider: record.provider ? String(record.provider) : undefined,
          };
        })
        .filter((item): item is InstrumentIdentifier => Boolean(item))
    : [];

  const fallback: InstrumentIdentifier[] = [
    { type: "ticker", value: symbol },
    { type: "provider_symbol", value: symbol, provider },
  ];
  if (exchange && exchange !== "unknown")
    fallback.push({ type: "exchange", value: exchange });

  const merged = new Map<string, InstrumentIdentifier>();
  [...identifiers, ...fallback].forEach((item) => {
    merged.set(`${item.type}:${item.value}:${item.provider ?? ""}`, item);
  });
  return [...merged.values()].slice(0, 16);
}

function storedHit(row: Record<string, unknown>): InstrumentCatalogHit {
  const provider = String(row.provider);
  const symbol = String(row.symbol);
  const exchange = String(row.exchange);
  const status = quoteStatus(row.quote_status);
  const identifiers = normalizeIdentifiers(
    row.identifiers,
    symbol,
    exchange,
    provider,
  );
  const canonical = buildCanonicalInstrument({
    internalInstrumentId: row.id,
    canonicalId: String(row.canonical_id),
    symbol,
    displaySymbol: row.display_symbol,
    name: String(row.name),
    assetClass: row.asset_class as MarketUniverseAssetClass,
    instrumentType: row.instrument_type,
    exchangeName: row.exchange_full_name,
    exchangeCode: row.exchange_code,
    mic: row.mic,
    currency: String(row.currency),
    country: row.country,
    identifiers,
    primaryProvider: provider,
    tradingTimezone: row.trading_timezone,
    pricePrecision: row.price_precision,
    quantityPrecision: row.quantity_precision,
    isActive: row.is_active,
    isDelisted: row.is_delisted,
  });

  return {
    ...canonical,
    exchange,
    exchangeFullName:
      row.exchange_full_name === null
        ? null
        : String(row.exchange_full_name ?? "") || null,
    provider,
    identifiers,
    identityConfidence: Number(row.identity_confidence ?? 0),
    resolutionStatus:
      row.resolution_status as InstrumentCatalogHit["resolutionStatus"],
    resolutionWarnings: Array.isArray(row.resolution_warnings)
      ? row.resolution_warnings.map(String)
      : [],
    origin: "instrument_master",
    quoteStatus: status,
    quoteQuality: configuredQuality(provider, status),
    quoteCheckedAt:
      row.quote_checked_at === null
        ? null
        : String(row.quote_checked_at ?? "") || null,
    discoveredAt: String(row.last_seen_at),
    confirmationCount: Number(row.confirmation_count ?? 0),
    matchedVia:
      Array.isArray(row.matched_identifiers) && row.matched_identifiers.length
        ? "identifier"
        : null,
  };
}

function providerHit(
  hit: Awaited<ReturnType<typeof searchProviderInstruments>>["hits"][number],
): InstrumentCatalogHit {
  const record = instrumentRecordFromHit(hit);
  const identifiers = normalizeIdentifiers(
    [],
    record.symbol,
    record.exchange,
    record.provider,
  );
  const canonical = buildCanonicalInstrument({
    canonicalId: buildCanonicalInstrumentId({
      assetClass: hit.assetClass,
      exchange: hit.exchange,
      symbol: hit.symbol,
      currency: hit.currency,
    }),
    symbol: record.symbol,
    displaySymbol: record.symbol,
    name: record.name,
    assetClass: record.assetClass,
    instrumentType: record.assetClass,
    exchangeName: record.exchangeFullName,
    exchangeCode: record.exchange,
    currency: record.currency,
    identifiers,
    primaryProvider: record.provider,
  });
  return {
    ...canonical,
    exchange: record.exchange,
    exchangeFullName: record.exchangeFullName,
    provider: record.provider,
    identifiers,
    identityConfidence: record.identityConfidence,
    resolutionStatus: record.resolutionStatus,
    resolutionWarnings: record.resolutionWarnings,
    origin: "provider_search",
    quoteStatus: "unknown",
    quoteQuality: "unavailable",
    quoteCheckedAt: null,
    discoveredAt: hit.fetchedAt,
    confirmationCount: 1,
    matchedVia: hit.matchedVia,
  };
}

export async function searchInstrumentCatalog(
  input: InstrumentCatalogSearchInput = {},
) {
  const query = input.query?.trim().slice(0, 64) ?? "";
  const assetClass = input.assetClass ?? "all";
  const limit = Math.min(200, Math.max(1, Math.floor(input.limit ?? 40)));
  const capability = instrumentDirectoryCapabilityReport();
  const storedRows = await searchStoredInstruments(query, limit, assetClass);
  const storedResults = storedRows.map((row) =>
    storedHit(row as Record<string, unknown>),
  );
  let providerResults: InstrumentCatalogHit[] = [];
  let providerNote = query
    ? "Gespeicherter Instrument Master wurde durchsucht."
    : "Gespeicherter Instrument Master; ohne Verzeichnislizenz wird kein statisches Ersatzuniversum angezeigt.";
  let degraded = false;
  let persistence: Awaited<ReturnType<typeof persistInstrumentHits>> | null =
    null;
  let providerLatencyMs = 0;

  const needsProviderLookup =
    Boolean(query) &&
    capability.searchAvailable &&
    storedResults.length < Math.min(5, limit);

  if (needsProviderLookup) {
    try {
      const directory = await searchProviderInstruments(query);
      providerLatencyMs = directory.latencyMs;
      degraded = directory.degraded;
      providerNote = directory.capabilityNote;
      const filteredHits = directory.hits.filter(
        (hit) => assetClass === "all" || hit.assetClass === assetClass,
      );
      persistence = await persistInstrumentHits(filteredHits, query);
      const known = new Set(storedResults.map((item) => item.canonicalId));
      providerResults = filteredHits
        .map(providerHit)
        .filter((item) => !known.has(item.canonicalId));
    } catch (error) {
      degraded = true;
      providerNote =
        "Provider-Suche fehlgeschlagen. Es werden nur verifizierte Eintraege des Instrument Masters angezeigt.";
      logEvent("warn", "instrument_catalog.provider_failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  } else if (query && !capability.searchAvailable) {
    providerNote =
      "Provider-Suche ist nicht konfiguriert. Es werden nur Eintraege des Instrument Masters angezeigt.";
  }

  const results = [...storedResults, ...providerResults].slice(0, limit);
  const coverage: InstrumentCatalogCoverage = {
    complete: false,
    mode: "search_driven",
    directorySyncAvailable: capability.directorySyncAvailable,
    note: providerNote,
    consequence: capability.consequence,
    verifiedAt: capability.verifiedAt,
  };

  return {
    query,
    assetClass,
    results,
    counts: {
      total: results.length,
      fromInstrumentMaster: storedResults.length,
      fromProviderSearch: providerResults.length,
    },
    persistence,
    coverage,
    degraded,
    provider: "FMP + StockPilot Instrument Master",
    providerLatencyMs,
    receivedAt: new Date().toISOString(),
  };
}
