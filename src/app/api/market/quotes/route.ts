import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import type { NormalizedQuote } from "@/lib/types";
import { validateSymbol } from "@/lib/validation";

const inFlightQuoteBatches = new Map<string, Promise<NormalizedQuote[]>>();
const MAX_QUOTE_SYMBOLS = 40;

function parseSymbols(request: Request) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("symbols") ?? searchParams.get("symbol") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const rawSymbols = parseSymbols(request);

  if (!rawSymbols.length) {
    return jsonError("Mindestens ein Symbol ist erforderlich.", 400);
  }

  if (rawSymbols.length > MAX_QUOTE_SYMBOLS) {
    return jsonError(`Maximal ${MAX_QUOTE_SYMBOLS} Symbole pro Anfrage.`, 400);
  }

  const symbols: string[] = [];
  const seen = new Set<string>();

  for (const rawSymbol of rawSymbols) {
    const parsed = validateSymbol(rawSymbol);
    if (!parsed.success) return jsonError("Ungueltiges Symbol.", 400);
    if (!seen.has(parsed.data)) {
      seen.add(parsed.data);
      symbols.push(parsed.data);
    }
  }

  const provider = getMarketDataProvider();
  const costControls = getCostControls();
  const cacheSymbols = [...new Set(symbols)].sort();
  const cacheKey = `quotes:${cacheSymbols.join(",")}:${provider.providerId}`;
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

  return jsonOk(
    {
      provider: provider.providerName,
      streamMode: provider.streamMode,
      quotes: result.value,
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
