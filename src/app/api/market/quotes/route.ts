import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import { summarizeQuoteProviders } from "@/lib/providers/quote-provenance";
import { normalizeCanonicalQuoteRecord } from "@/lib/canonical-quote";
import {
  bindQuotesToCanonicalIdentities,
  canonicalQuoteCacheKey,
  prepareCanonicalQuoteRequest,
  type CanonicalQuoteMappingResolution,
} from "@/lib/quote-request-identity";
import { resolveCanonicalQuoteIdentities } from "@/lib/instrument-master-store";
import type { NormalizedQuote } from "@/lib/types";
import { validateSymbol } from "@/lib/validation";

const inFlightQuoteBatches = new Map<string, Promise<NormalizedQuote[]>>();
const MAX_QUOTE_SYMBOLS = 40;
const MAX_QUERY_LENGTH = 4_000;
const MAX_IN_FLIGHT_QUOTE_BATCHES = 80;

type ParsedRequest =
  | { ok: true; mode: "canonical"; values: string[] }
  | { ok: true; mode: "legacy_symbol"; values: string[] }
  | { ok: false; message: string };

function parseRequest(request: Request): ParsedRequest {
  const { searchParams } = new URL(request.url);
  const canonical = searchParams.get("canonicalIds") ?? "";
  const legacy = searchParams.get("symbols") ?? searchParams.get("symbol") ?? "";
  if (canonical && legacy) {
    return { ok: false, message: "canonicalIds und symbols dürfen nicht kombiniert werden." };
  }
  const raw = canonical || legacy;
  if (raw.length > MAX_QUERY_LENGTH) return { ok: false, message: "Quote-Anfrage ist zu lang." };
  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (!values.length) return { ok: false, message: "Mindestens eine Instrument-ID ist erforderlich." };
  if (values.length > MAX_QUOTE_SYMBOLS) {
    return { ok: false, message: `Maximal ${MAX_QUOTE_SYMBOLS} Instrumente pro Anfrage.` };
  }
  return { ok: true, mode: canonical ? "canonical" : "legacy_symbol", values };
}

function normalizeLegacyQuotes(rawQuotes: readonly unknown[], symbols: readonly string[]) {
  const allowed = new Set(symbols);
  const bySymbol = new Map<string, NormalizedQuote>();
  for (const rawQuote of rawQuotes) {
    const quote = normalizeCanonicalQuoteRecord(rawQuote);
    if (quote && allowed.has(quote.symbol)) bySymbol.set(quote.symbol, quote);
  }
  return symbols
    .map((symbol) => bySymbol.get(symbol))
    .filter((quote): quote is NormalizedQuote => Boolean(quote));
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const parsed = parseRequest(request);
  if (!parsed.ok) return jsonError(parsed.message, 400);

  const provider = getMarketDataProvider();
  let requestSymbols: string[];
  let instrumentCount: number;
  let cacheKey: string;
  let canonicalPreparation: ReturnType<typeof prepareCanonicalQuoteRequest> | null = null;
  let canonicalResolution: CanonicalQuoteMappingResolution | null = null;

  if (parsed.mode === "canonical") {
    canonicalPreparation = prepareCanonicalQuoteRequest(parsed.values);
    if (canonicalPreparation.status === "invalid") {
      return jsonError("Ungültige kanonische Instrument-ID.", 400);
    }
    canonicalResolution = await resolveCanonicalQuoteIdentities(
      canonicalPreparation.identities,
      provider.providerIds,
    );
    if (canonicalResolution.status === "provider_unavailable") {
      return jsonError("Kein verifizierter Kursanbieter ist verfügbar.", 503);
    }
    if (canonicalResolution.status === "store_unavailable") {
      return jsonError("Instrument-Master ist vorübergehend nicht verfügbar.", 503);
    }
    if (canonicalResolution.status === "instrument_not_found") {
      return jsonError("Mindestens ein kanonisches Instrument wurde nicht gefunden.", 404);
    }
    if (canonicalResolution.status !== "ready") {
      return jsonError("Provider-Mapping für mindestens ein Listing ist nicht eindeutig verfügbar.", 409);
    }
    requestSymbols = [...new Set(canonicalResolution.identities.flatMap(
      (identity) => identity.providerMappings.map((mapping) => mapping.providerSymbol),
    ))];
    instrumentCount = canonicalResolution.identities.length;
    cacheKey = canonicalQuoteCacheKey(
      canonicalResolution.providerIds,
      canonicalResolution.identities,
    );
  } else {
    const symbols: string[] = [];
    const seen = new Set<string>();
    for (const rawSymbol of parsed.values) {
      const validated = validateSymbol(rawSymbol);
      if (!validated.success) return jsonError("Ungültiges Symbol.", 400);
      if (!seen.has(validated.data)) {
        seen.add(validated.data);
        symbols.push(validated.data);
      }
    }
    requestSymbols = symbols;
    instrumentCount = symbols.length;
    cacheKey = `quotes:legacy:${provider.providerId}:${[...symbols].sort().join(",")}`;
  }

  if (!inFlightQuoteBatches.has(cacheKey) && inFlightQuoteBatches.size >= MAX_IN_FLIGHT_QUOTE_BATCHES) {
    return jsonError("Quote-Service ist kurzzeitig ausgelastet. Bitte gleich erneut versuchen.", 429);
  }

  const costControls = getCostControls();
  const result = await withCacheFallback(
    cacheKey,
    () => {
      const existing = inFlightQuoteBatches.get(cacheKey);
      if (existing) return existing;
      const providerRequest = (canonicalResolution?.status === "ready"
        ? provider.getCanonicalQuotes(canonicalResolution.identities)
        : provider.getQuotes(requestSymbols)).finally(() => {
        inFlightQuoteBatches.delete(cacheKey);
      });
      inFlightQuoteBatches.set(cacheKey, providerRequest);
      return providerRequest;
    },
    { policy: "quote", staleTtlMs: costControls.quoteStaleTtlMs, ttlMs: costControls.quoteTtlMs },
  );

  const rawQuotes = Array.isArray(result.value) ? result.value : [];
  const quotes = canonicalResolution?.status === "ready"
    ? bindQuotesToCanonicalIdentities(rawQuotes, canonicalResolution.identities)
    : normalizeLegacyQuotes(rawQuotes, requestSymbols);
  const mockFallbackSymbols = quotes.filter((quote) => quote.quality === "mock").map((quote) => quote.symbol);
  const returnedKeys = new Set(quotes.map((quote) => quote.canonicalId ?? quote.symbol));
  const requestedKeys = canonicalResolution?.status === "ready"
    ? canonicalResolution.identities.map((identity) => identity.canonicalId)
    : requestSymbols;
  const unavailable = requestedKeys.filter((key) => !returnedKeys.has(key));
  const fallbackWarning = mockFallbackSymbols.length
    ? "Mindestens ein Instrument wurde aus klar markierten Mock-Daten geliefert."
    : unavailable.length
      ? "Mindestens ein Instrument konnte nicht geladen werden."
      : null;
  const quoteProvenance = summarizeQuoteProviders(quotes, provider.providerName);

  return jsonOk({
    provider: quoteProvenance.provider,
    providers: quoteProvenance.providers,
    streamMode: provider.streamMode,
    identityMode: parsed.mode,
    quotes,
    instruments: canonicalResolution?.status === "ready" ? canonicalResolution.identities : [],
    fallback: {
      degraded: Boolean(fallbackWarning),
      mockSymbols: mockFallbackSymbols,
      unavailableSymbols: parsed.mode === "legacy_symbol" ? unavailable : [],
      unavailableCanonicalIds: parsed.mode === "canonical" ? unavailable : [],
      warning: fallbackWarning,
    },
    cache: { fromCache: result.fromCache, storedAt: result.cacheStoredAt, warning: result.warning },
  }, {
    headers: {
      ...cacheControlHeaders(costControls.quoteTtlMs, costControls.quoteStaleTtlMs),
      "X-StockPilot-Provider": quoteProvenance.provider,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.quoteTtlMs}`,
      "X-StockPilot-Instrument-Count": `${instrumentCount}`,
      "X-StockPilot-Identity-Mode": parsed.mode,
    },
  });
}
