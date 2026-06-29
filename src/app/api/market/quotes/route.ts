import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { validateSymbol } from "@/lib/validation";

function parseSymbols(request: Request) {
  const { searchParams } = new URL(request.url);
  return (searchParams.get("symbols") ?? searchParams.get("symbol") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 40);
}

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const rawSymbols = parseSymbols(request);

  if (!rawSymbols.length) {
    return jsonError("Mindestens ein Symbol ist erforderlich.", 400);
  }

  const symbols: string[] = [];

  for (const rawSymbol of rawSymbols) {
    const parsed = validateSymbol(rawSymbol);
    if (!parsed.success) return jsonError("Ungueltiges Symbol.", 400);
    symbols.push(parsed.data);
  }

  const provider = getMarketDataProvider();
  const cacheKey = `quotes:${symbols.join(",")}:${provider.providerId}`;
  const result = await withCacheFallback(cacheKey, () => provider.getQuotes(symbols), { ttlMs: 5000 });

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
        "Cache-Control": "s-maxage=5, stale-while-revalidate=20",
        "X-StockPilot-Provider": provider.providerName,
        "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
      }
    }
  );
}
