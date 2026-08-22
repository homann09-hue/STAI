import { normalizeCanonicalQuoteRecord } from "@/lib/canonical-quote";
import { isCanonicalInstrumentId } from "@/lib/instrument-resolution";
import { normalizeProviderId } from "@/lib/providers/provider-registry";
import type { MarketProviderId } from "@/lib/providers/quote-chain";
import type { AssetType, NormalizedQuote } from "@/lib/types";

const QUOTABLE_ASSET_TYPES = new Set<AssetType>([
  "stock",
  "etf",
  "crypto",
  "forex",
  "index",
]);

const QUOTE_PROVIDER_IDS = new Set<MarketProviderId>([
  "alpaca",
  "finnhub",
  "twelve_data",
  "eodhd",
  "massive",
  "polygon",
  "fmp",
  "alpha_vantage",
  "databento",
  "binance",
  "coinbase",
]);

export interface CanonicalQuoteRequestIdentity {
  canonicalId: string;
  symbol: string;
  assetType: AssetType;
  exchange: string;
  currency: string;
}

export interface CanonicalQuoteProviderMapping {
  providerId: MarketProviderId;
  providerSymbol: string;
}

export interface CanonicalQuoteIdentity extends CanonicalQuoteRequestIdentity {
  internalInstrumentId: string;
  providerMappings: CanonicalQuoteProviderMapping[];
}

export interface StoredCanonicalInstrumentRow {
  id: unknown;
  canonical_id: unknown;
  symbol: unknown;
  asset_class: unknown;
  currency: unknown;
}

export interface StoredProviderIdentifierRow {
  instrument_id: unknown;
  identifier_type: unknown;
  value: unknown;
  provider: unknown;
}

export type CanonicalQuotePreparation =
  | { status: "ready"; identities: CanonicalQuoteRequestIdentity[] }
  | { status: "invalid"; canonicalId: string };

export type CanonicalQuoteMappingResolution =
  | {
      status: "ready";
      identities: CanonicalQuoteIdentity[];
      providerIds: MarketProviderId[];
    }
  | { status: "provider_unavailable" }
  | { status: "store_unavailable" }
  | { status: "instrument_not_found"; canonicalIds: string[] }
  | { status: "invalid_instrument"; canonicalIds: string[] }
  | {
      status: "provider_mapping_missing";
      canonicalIds: string[];
      providerIds: MarketProviderId[];
    }
  | {
      status: "provider_mapping_conflict";
      canonicalId: string;
      providerId: MarketProviderId;
    }
  | {
      status: "provider_symbol_collision";
      providerId: MarketProviderId;
      providerSymbol: string;
      canonicalIds: string[];
    };

function parseAssetType(value: string): AssetType | null {
  return QUOTABLE_ASSET_TYPES.has(value as AssetType)
    ? (value as AssetType)
    : null;
}

/** Parses only assetClass:exchange:symbol:currency IDs; never guesses a listing. */
export function parseCanonicalQuoteIdentity(
  canonicalId: string,
): CanonicalQuoteRequestIdentity | null {
  const normalized = canonicalId.trim().toLowerCase();
  if (!isCanonicalInstrumentId(normalized)) return null;
  const parts = normalized.split(":");
  if (parts.length !== 4) return null;
  const [assetClass, exchange, symbolPart, currencyPart] = parts;
  const assetType = parseAssetType(assetClass);
  const symbol = symbolPart.toUpperCase();
  const currency = currencyPart.toUpperCase();
  if (
    !assetType ||
    !/^[a-z0-9][a-z0-9.-]{0,47}$/.test(exchange) ||
    !/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(symbol) ||
    !/^[A-Z0-9]{3,8}$/.test(currency)
  )
    return null;
  return {
    canonicalId: normalized,
    symbol,
    assetType,
    exchange: exchange.toUpperCase(),
    currency,
  };
}

export function prepareCanonicalQuoteRequest(
  canonicalIds: readonly string[],
): CanonicalQuotePreparation {
  const identities: CanonicalQuoteRequestIdentity[] = [];
  const seenIds = new Set<string>();
  for (const requestedId of canonicalIds) {
    const identity = parseCanonicalQuoteIdentity(requestedId);
    if (!identity) return { status: "invalid", canonicalId: requestedId };
    if (seenIds.has(identity.canonicalId)) continue;
    seenIds.add(identity.canonicalId);
    identities.push(identity);
  }
  return { status: "ready", identities };
}

/** Normalizes only registered quote-provider names; mock and unknown names stay rejected. */
export function normalizeQuoteProviderId(
  value: unknown,
): MarketProviderId | null {
  if (typeof value !== "string") return null;
  const token = value
    .trim()
    .toLowerCase()
    .replace(/\.io$/u, "")
    .replace(/[\s-]+/gu, "_");
  const aliases: Record<string, string> = {
    financial_modeling_prep: "fmp",
    financialmodelingprep: "fmp",
    polygon: "massive",
    polygon_massive: "massive",
    twelve_data: "twelve_data",
    alphavantage: "alpha_vantage",
  };
  const normalized = normalizeProviderId(aliases[token] ?? token);
  return normalized && QUOTE_PROVIDER_IDS.has(normalized as MarketProviderId)
    ? (normalized as MarketProviderId)
    : null;
}

function normalizeProviderSymbol(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9._:/^-]{0,63}$/.test(normalized)
    ? normalized
    : null;
}

function activeQuoteProviderIds(
  providerIds: readonly string[],
): MarketProviderId[] {
  const active: MarketProviderId[] = [];
  const seen = new Set<string>();
  for (const value of providerIds) {
    const providerId = normalizeQuoteProviderId(value);
    if (!providerId || seen.has(providerId)) continue;
    seen.add(providerId);
    active.push(providerId);
  }
  return active;
}

/**
 * Joins exact Instrument-Master rows with provider identifiers. Every lookup
 * is listing-specific and fails closed when identity or mapping evidence is
 * missing, contradictory or collision-prone.
 */
export function resolveStoredCanonicalQuoteMappings(
  requested: readonly CanonicalQuoteRequestIdentity[],
  instrumentRows: readonly StoredCanonicalInstrumentRow[],
  identifierRows: readonly StoredProviderIdentifierRow[],
  requestedProviderIds: readonly string[],
): CanonicalQuoteMappingResolution {
  const providerIds = activeQuoteProviderIds(requestedProviderIds);
  if (!providerIds.length) return { status: "provider_unavailable" };

  const instrumentsByCanonicalId = new Map<
    string,
    StoredCanonicalInstrumentRow[]
  >();
  for (const row of instrumentRows) {
    if (typeof row.canonical_id !== "string") continue;
    const canonicalId = row.canonical_id.trim().toLowerCase();
    const rows = instrumentsByCanonicalId.get(canonicalId) ?? [];
    rows.push(row);
    instrumentsByCanonicalId.set(canonicalId, rows);
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  const resolved: CanonicalQuoteIdentity[] = [];

  for (const identity of requested) {
    const rows = instrumentsByCanonicalId.get(identity.canonicalId) ?? [];
    if (!rows.length) {
      missing.push(identity.canonicalId);
      continue;
    }
    if (rows.length !== 1) {
      invalid.push(identity.canonicalId);
      continue;
    }

    const row = rows[0];
    const internalInstrumentId =
      typeof row.id === "string" ? row.id.trim() : "";
    const storedSymbol =
      typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
    const storedAssetClass =
      typeof row.asset_class === "string"
        ? row.asset_class.trim().toLowerCase()
        : "";
    const storedCurrency =
      typeof row.currency === "string"
        ? row.currency.trim().toUpperCase()
        : "";
    if (
      !internalInstrumentId ||
      storedSymbol !== identity.symbol ||
      storedAssetClass !== identity.assetType ||
      storedCurrency !== identity.currency
    ) {
      invalid.push(identity.canonicalId);
      continue;
    }

    const mappings: CanonicalQuoteProviderMapping[] = [];
    for (const providerId of providerIds) {
      const providerSymbols = new Set(
        identifierRows.flatMap((identifier) => {
          if (
            String(identifier.instrument_id ?? "") !== internalInstrumentId ||
            identifier.identifier_type !== "provider_symbol" ||
            normalizeQuoteProviderId(identifier.provider) !== providerId
          )
            return [];
          const providerSymbol = normalizeProviderSymbol(identifier.value);
          return providerSymbol ? [providerSymbol] : [];
        }),
      );
      if (providerSymbols.size > 1) {
        return {
          status: "provider_mapping_conflict",
          canonicalId: identity.canonicalId,
          providerId,
        };
      }
      const providerSymbol = [...providerSymbols][0];
      if (providerSymbol) mappings.push({ providerId, providerSymbol });
    }

    resolved.push({
      ...identity,
      internalInstrumentId,
      providerMappings: mappings,
    });
  }

  if (missing.length)
    return { status: "instrument_not_found", canonicalIds: missing };
  if (invalid.length)
    return { status: "invalid_instrument", canonicalIds: invalid };

  const withoutMapping = resolved
    .filter((identity) => identity.providerMappings.length === 0)
    .map((identity) => identity.canonicalId);
  if (withoutMapping.length) {
    return {
      status: "provider_mapping_missing",
      canonicalIds: withoutMapping,
      providerIds,
    };
  }

  const mappingOwners = new Map<string, string[]>();
  for (const identity of resolved) {
    for (const mapping of identity.providerMappings) {
      const key = `${mapping.providerId}:${mapping.providerSymbol}`;
      const owners = mappingOwners.get(key) ?? [];
      owners.push(identity.canonicalId);
      mappingOwners.set(key, owners);
    }
  }
  for (const [key, canonicalIds] of mappingOwners) {
    if (canonicalIds.length < 2) continue;
    const separator = key.indexOf(":");
    return {
      status: "provider_symbol_collision",
      providerId: key.slice(0, separator) as MarketProviderId,
      providerSymbol: key.slice(separator + 1),
      canonicalIds,
    };
  }

  return { status: "ready", identities: resolved, providerIds };
}

export function providerSymbolForIdentity(
  identity: CanonicalQuoteIdentity,
  providerId: string,
): string | null {
  const normalizedProviderId = normalizeQuoteProviderId(providerId);
  if (!normalizedProviderId) return null;
  return (
    identity.providerMappings.find(
      (mapping) => mapping.providerId === normalizedProviderId,
    )?.providerSymbol ?? null
  );
}

export function canonicalQuoteCacheKey(
  providerIds: readonly string[],
  identities: readonly CanonicalQuoteIdentity[],
) {
  const providers = activeQuoteProviderIds(providerIds).sort().join(",");
  const instruments = [...identities]
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId))
    .map((identity) => {
      const mappings = [...identity.providerMappings]
        .sort((left, right) => left.providerId.localeCompare(right.providerId))
        .map((mapping) => `${mapping.providerId}=${mapping.providerSymbol}`)
        .join("|");
      return `${identity.canonicalId}@${identity.internalInstrumentId}[${mappings}]`;
    })
    .join(",");
  return `quotes:canonical:${providers}:${instruments}`;
}

export function bindQuotesToCanonicalIdentities(
  rawQuotes: readonly unknown[],
  identities: readonly CanonicalQuoteIdentity[],
): NormalizedQuote[] {
  const identityByProviderKey = new Map<string, CanonicalQuoteIdentity>();
  for (const identity of identities) {
    for (const mapping of identity.providerMappings) {
      identityByProviderKey.set(
        `${mapping.providerId}:${mapping.providerSymbol}`,
        identity,
      );
    }
  }

  const bound = new Map<string, NormalizedQuote>();
  for (const rawQuote of rawQuotes) {
    const normalized = normalizeCanonicalQuoteRecord(rawQuote);
    if (!normalized) continue;
    const providerId = normalizeQuoteProviderId(normalized.providerId);
    const providerSymbol = normalizeProviderSymbol(normalized.providerSymbol);
    if (!providerId || !providerSymbol) continue;
    const identity = identityByProviderKey.get(
      `${providerId}:${providerSymbol}`,
    );
    if (
      !identity ||
      (normalized.canonicalId &&
        normalized.canonicalId !== identity.canonicalId) ||
      normalized.currency.toUpperCase() !== identity.currency
    )
      continue;
    const quote = normalizeCanonicalQuoteRecord({
      ...normalized,
      canonicalId: identity.canonicalId,
      instrumentId: identity.internalInstrumentId,
      symbol: identity.symbol,
      assetType: identity.assetType,
      currency: identity.currency,
      venue: identity.exchange,
    });
    if (quote) bound.set(identity.canonicalId, quote);
  }
  return identities
    .map((identity) => bound.get(identity.canonicalId))
    .filter((quote): quote is NormalizedQuote => Boolean(quote));
}
