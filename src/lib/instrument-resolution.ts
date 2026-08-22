import type { QuoteStatus } from "@/lib/quote-entitlement";

export interface KnownInstrumentIdentity {
  internalInstrumentId: string;
  canonicalId: string;
  symbol: string;
  name: string;
  assetClass: string;
  exchange: string;
  exchangeCode: string | null;
  mic: string | null;
  currency: string;
  provider: string;
  quoteStatus: QuoteStatus;
}

export type InstrumentIdentityResolution =
  | { status: "resolved"; identity: KnownInstrumentIdentity }
  | {
      status: "ambiguous";
      symbol: string;
      candidates: KnownInstrumentIdentity[];
      truncated: boolean;
    }
  | { status: "not_found"; symbol: string }
  | { status: "unavailable"; symbol: string };

const CANONICAL_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,199}$/i;

export function isCanonicalInstrumentId(value: string) {
  return CANONICAL_ID_PATTERN.test(value.trim());
}

export function resolveInstrumentCandidates(
  symbol: string,
  candidates: readonly KnownInstrumentIdentity[],
  options: { requestedCanonicalId?: string | null; truncated?: boolean } = {},
): InstrumentIdentityResolution {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const unique = [
    ...new Map(
      candidates
        .filter((candidate) => candidate.symbol === normalizedSymbol)
        .map((candidate) => [candidate.canonicalId, candidate]),
    ).values(),
  ].sort((left, right) => left.canonicalId.localeCompare(right.canonicalId, "en"));
  const requestedCanonicalId = options.requestedCanonicalId?.trim() || null;

  if (requestedCanonicalId) {
    const selected = unique.find(
      (candidate) => candidate.canonicalId === requestedCanonicalId,
    );
    return selected
      ? { status: "resolved", identity: selected }
      : { status: "not_found", symbol: normalizedSymbol };
  }

  if (unique.length === 0) return { status: "not_found", symbol: normalizedSymbol };
  if (unique.length === 1) return { status: "resolved", identity: unique[0] };

  return {
    status: "ambiguous",
    symbol: normalizedSymbol,
    candidates: unique,
    truncated: options.truncated === true,
  };
}

export function instrumentDetailHref(identity: Pick<KnownInstrumentIdentity, "symbol" | "canonicalId">) {
  return `/assets/${encodeURIComponent(identity.symbol)}?canonicalId=${encodeURIComponent(identity.canonicalId)}`;
}
