import { normalizeCanonicalQuoteRecord } from "@/lib/canonical-quote";
import { isCanonicalInstrumentId } from "@/lib/instrument-resolution";
import type { AssetType, NormalizedQuote } from "@/lib/types";

const QUOTABLE_ASSET_TYPES = new Set<AssetType>([
  "stock", "etf", "crypto", "forex", "index",
]);

export interface CanonicalQuoteIdentity {
  canonicalId: string;
  symbol: string;
  assetType: AssetType;
  exchange: string;
  currency: string;
  providerSymbol: string;
}

export type CanonicalQuotePreparation =
  | { status: "ready"; identities: CanonicalQuoteIdentity[]; providerSymbols: string[] }
  | { status: "invalid"; canonicalId: string }
  | { status: "provider_symbol_collision"; providerSymbol: string; canonicalIds: string[] };

function parseAssetType(value: string): AssetType | null {
  return QUOTABLE_ASSET_TYPES.has(value as AssetType) ? (value as AssetType) : null;
}

/** Parses only assetClass:exchange:symbol:currency IDs; never guesses a listing. */
export function parseCanonicalQuoteIdentity(canonicalId: string): CanonicalQuoteIdentity | null {
  const normalized = canonicalId.trim().toLowerCase();
  if (!isCanonicalInstrumentId(normalized)) return null;
  const parts = normalized.split(":");
  if (parts.length !== 4) return null;
  const [assetClass, exchange, symbolPart, currencyPart] = parts;
  const assetType = parseAssetType(assetClass);
  const symbol = symbolPart.toUpperCase();
  const currency = currencyPart.toUpperCase();
  if (!assetType || !/^[a-z0-9][a-z0-9.-]{0,47}$/.test(exchange) ||
      !/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(symbol) || !/^[A-Z0-9]{3,8}$/.test(currency)) return null;
  return { canonicalId: normalized, symbol, assetType, exchange: exchange.toUpperCase(), currency, providerSymbol: symbol };
}

export function prepareCanonicalQuoteRequest(canonicalIds: readonly string[]): CanonicalQuotePreparation {
  const identities: CanonicalQuoteIdentity[] = [];
  const seenIds = new Set<string>();
  for (const requestedId of canonicalIds) {
    const identity = parseCanonicalQuoteIdentity(requestedId);
    if (!identity) return { status: "invalid", canonicalId: requestedId };
    if (seenIds.has(identity.canonicalId)) continue;
    seenIds.add(identity.canonicalId);
    identities.push(identity);
  }
  const byProviderSymbol = new Map<string, string[]>();
  for (const identity of identities) {
    const ids = byProviderSymbol.get(identity.providerSymbol) ?? [];
    ids.push(identity.canonicalId);
    byProviderSymbol.set(identity.providerSymbol, ids);
  }
  for (const [providerSymbol, ids] of byProviderSymbol) {
    if (ids.length > 1) return { status: "provider_symbol_collision", providerSymbol, canonicalIds: ids };
  }
  return { status: "ready", identities, providerSymbols: identities.map((identity) => identity.providerSymbol) };
}

export function canonicalQuoteCacheKey(providerId: string, identities: readonly CanonicalQuoteIdentity[]) {
  return `quotes:canonical:${providerId}:${identities.map((identity) => identity.canonicalId).sort().join(",")}`;
}

export function bindQuotesToCanonicalIdentities(rawQuotes: readonly unknown[], identities: readonly CanonicalQuoteIdentity[]): NormalizedQuote[] {
  const identityByProviderSymbol = new Map(identities.map((identity) => [identity.providerSymbol, identity]));
  const bound = new Map<string, NormalizedQuote>();
  for (const rawQuote of rawQuotes) {
    const normalized = normalizeCanonicalQuoteRecord(rawQuote);
    if (!normalized) continue;
    const identity = identityByProviderSymbol.get(normalized.providerSymbol.toUpperCase()) ?? identityByProviderSymbol.get(normalized.symbol);
    if (!identity) continue;
    const quote = normalizeCanonicalQuoteRecord({
      ...normalized,
      canonicalId: identity.canonicalId,
      symbol: identity.symbol,
      assetType: identity.assetType,
      currency: identity.currency,
      venue: normalized.venue ?? identity.exchange,
    });
    if (quote) bound.set(identity.canonicalId, quote);
  }
  return identities.map((identity) => bound.get(identity.canonicalId)).filter((quote): quote is NormalizedQuote => Boolean(quote));
}
