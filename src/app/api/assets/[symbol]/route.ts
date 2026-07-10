import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { validateSymbol } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { symbol } = await params;
  const parsed = validateSymbol(symbol);

  if (!parsed.success) {
    return jsonError("Ungültiges Symbol.", 400);
  }

  const provider = getMarketDataProvider();
  const ttlMs = 5000;
  const staleTtlMs = 120000;
  const result = await withCacheFallback(
    `asset:${parsed.data}`,
    () => provider.getAsset(parsed.data),
    { ttlMs, staleTtlMs }
  );
  const detail = result.value;

  if (!detail) {
    return jsonError("Asset nicht gefunden.", 404);
  }

  return jsonOk({
    ...detail,
    metadata: {
      provider: provider.providerName,
      quality: result.fromCache ? "cached" : detail.quote.quality,
      streamMode: provider.streamMode,
      fromCache: result.fromCache,
      cacheStoredAt: result.cacheStoredAt,
      cacheWarning: result.warning,
      ttlMs,
      staleTtlMs,
      disclaimer:
        "Asset-Details können realtime, delayed, cached oder mock sein. Scores und KI-Texte sind keine Anlageberatung."
    }
  }, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-Provider": provider.providerName,
      "X-StockPilot-Data-Quality": result.fromCache ? "cached" : detail.quote.quality
    }
  });
}
