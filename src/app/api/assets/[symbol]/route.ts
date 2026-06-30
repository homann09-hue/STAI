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
    return jsonError("Ungueltiges Symbol.", 400);
  }

  const result = await withCacheFallback(
    `asset:${parsed.data}`,
    () => getMarketDataProvider().getAsset(parsed.data),
    { ttlMs: 5000 }
  );
  const detail = result.value;

  if (!detail) {
    return jsonError("Asset nicht gefunden.", 404);
  }

  return jsonOk(detail, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
