import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import type { NormalizedQuote } from "@/lib/types";
import { validateSymbol } from "@/lib/validation";

const inFlightQuoteBatches = new Map<string, Promise<NormalizedQuote[]>>();
const MAX_QUOTE_SYMBOLS = 40;
const MAX_SYMBOLS_QUERY_LENGTH = 900;
const MAX_IN_FLIGHT_QUOTE_BATCHES = 80;
const validAssetTypes = new Set<NormalizedQuote["assetType"]>(["stock", "etf", "crypto", "forex", "index"]);
const validQualities = new Set<NormalizedQuote["quality"]>([
  "realtime",
  "near_realtime",
  "delayed",
  "historical",
  "mock",
  "unavailable"
]);
const validMarketStatuses = new Set<NormalizedQuote["marketStatus"]>([
  "open",
  "closed",
  "pre_market",
  "after_hours",
  "unknown"
]);

function parseSymbols(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawSymbols = searchParams.get("symbols") ?? searchParams.get("symbol") ?? "";

  if (rawSymbols.length > MAX_SYMBOLS_QUERY_LENGTH) {
    return { ok: false as const, reason: "too_long" as const, symbols: [] };
  }

  const symbols = rawSymbols
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  return { ok: true as const, symbols };
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeText(value: unknown, maxLength: number, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function safeTimestamp(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date().toISOString();
}

function normalizeQuoteForResponse(rawQuote: unknown, allowedSymbols: Set<string>): NormalizedQuote | null {
  if (!rawQuote || typeof rawQuote !== "object") return null;

  const quote = rawQuote as Partial<NormalizedQuote>;
  const symbol = typeof quote.symbol === "string" ? quote.symbol.trim().toUpperCase() : "";

  if (!allowedSymbols.has(symbol)) return null;

  return {
    symbol,
    name: quote.name ? safeText(quote.name, 120, symbol) : undefined,
    assetType: quote.assetType && validAssetTypes.has(quote.assetType) ? quote.assetType : "stock",
    price: finiteNumber(quote.price),
    currency: safeText(quote.currency, 8, "USD").toUpperCase(),
    change: finiteNumber(quote.change),
    changePercent: finiteNumber(quote.changePercent),
    bid: optionalFiniteNumber(quote.bid),
    ask: optionalFiniteNumber(quote.ask),
    spread: optionalFiniteNumber(quote.spread),
    volume: optionalFiniteNumber(quote.volume),
    high: optionalFiniteNumber(quote.high),
    low: optionalFiniteNumber(quote.low),
    open: optionalFiniteNumber(quote.open),
    previousClose: optionalFiniteNumber(quote.previousClose),
    fiftyTwoWeekHigh: optionalFiniteNumber(quote.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: optionalFiniteNumber(quote.fiftyTwoWeekLow),
    marketCap: optionalFiniteNumber(quote.marketCap),
    freeFloat: optionalFiniteNumber(quote.freeFloat),
    exchange: quote.exchange ? safeText(quote.exchange, 80, "") : undefined,
    timestamp: safeTimestamp(quote.timestamp),
    provider: safeText(quote.provider, 80, "unknown"),
    quality: quote.quality && validQualities.has(quote.quality) ? quote.quality : "unavailable",
    latencyMs: optionalFiniteNumber(quote.latencyMs),
    marketStatus: quote.marketStatus && validMarketStatuses.has(quote.marketStatus) ? quote.marketStatus : "unknown"
  };
}

function orderQuotesForRequest(quotes: NormalizedQuote[], symbols: string[]) {
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol.toUpperCase(), quote]));
  return symbols.map((symbol) => bySymbol.get(symbol)).filter((quote): quote is NormalizedQuote => Boolean(quote));
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const parsedSymbols = parseSymbols(request);

  if (!parsedSymbols.ok) {
    return jsonError("Symbol-Anfrage ist zu lang.", 400);
  }

  if (!parsedSymbols.symbols.length) {
    return jsonError("Mindestens ein Symbol ist erforderlich.", 400);
  }

  if (parsedSymbols.symbols.length > MAX_QUOTE_SYMBOLS) {
    return jsonError(`Maximal ${MAX_QUOTE_SYMBOLS} Symbole pro Anfrage.`, 400);
  }

  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const rawSymbol of parsedSymbols.symbols) {
    const parsed = validateSymbol(rawSymbol);
    if (!parsed.success) return jsonError("Ungültiges Symbol.", 400);
    if (!seen.has(parsed.data)) {
      seen.add(parsed.data);
      symbols.push(parsed.data);
    }
  }

  const provider = getMarketDataProvider();
  const costControls = getCostControls();
  const cacheSymbols = [...new Set(symbols)].sort();
  const cacheKey = `quotes:${cacheSymbols.join(",")}:${provider.providerId}`;

  if (!inFlightQuoteBatches.has(cacheKey) && inFlightQuoteBatches.size >= MAX_IN_FLIGHT_QUOTE_BATCHES) {
    return jsonError("Quote-Service ist kurzzeitig ausgelastet. Bitte gleich erneut versuchen.", 429);
  }

  const result = await withCacheFallback(
    cacheKey,
    () => {
      const existing = inFlightQuoteBatches.get(cacheKey);
      if (existing) return existing;

      const request = provider.getQuotes(symbols).finally(() => {
        inFlightQuoteBatches.delete(cacheKey);
      });
      inFlightQuoteBatches.set(cacheKey, request);
      return request;
    },
    { staleTtlMs: costControls.quoteStaleTtlMs, ttlMs: costControls.quoteTtlMs }
  );
  const allowedSymbols = new Set(symbols);
  const safeQuotes = Array.isArray(result.value)
    ? result.value
        .map((quote) => normalizeQuoteForResponse(quote, allowedSymbols))
        .filter((quote): quote is NormalizedQuote => Boolean(quote))
        .slice(0, MAX_QUOTE_SYMBOLS)
    : [];
  const orderedQuotes = orderQuotesForRequest(safeQuotes, symbols);
  const mockFallbackSymbols = orderedQuotes
    .filter((quote) => quote.quality === "mock")
    .map((quote) => quote.symbol);
  const unavailableSymbols = symbols.filter(
    (symbol) => !orderedQuotes.some((quote) => quote.symbol === symbol)
  );
  const fallbackWarning = mockFallbackSymbols.length
    ? "Mindestens ein Symbol wurde aus Mock-/Fallback-Daten geliefert. Nicht als echte Live-Daten verwenden."
    : unavailableSymbols.length
      ? "Mindestens ein Symbol konnte nicht geladen werden."
      : null;

  return jsonOk(
    {
      provider: provider.providerName,
      streamMode: provider.streamMode,
      quotes: orderedQuotes,
      fallback: {
        degraded: Boolean(fallbackWarning),
        mockSymbols: mockFallbackSymbols,
        unavailableSymbols,
        warning: fallbackWarning
      },
      cache: {
        fromCache: result.fromCache,
        storedAt: result.cacheStoredAt,
        warning: result.warning
      }
    },
    {
      headers: {
        ...cacheControlHeaders(costControls.quoteTtlMs, costControls.quoteStaleTtlMs),
        "X-StockPilot-Provider": provider.providerName,
        "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
        "X-StockPilot-Cost-Ttl-Ms": `${costControls.quoteTtlMs}`,
        "X-StockPilot-Symbol-Count": `${symbols.length}`
      }
    }
  );
}
