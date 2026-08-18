import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { getCoinGeckoMetadata } from "@/lib/providers/coingecko-client";
import { validateSymbol } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ symbol: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const parsed = validateSymbol((await params).symbol);
  if (!parsed.success) return jsonError("Ungültiges Krypto-Symbol.", 400);
  try {
    const result = await getCoinGeckoMetadata(parsed.data);
    const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400", "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh", "X-StockPilot-Data-Quality": result.quality };
    if (result.value.status === "ambiguous") return jsonOk({ ...result.value, metadata: { provider: "CoinGecko", quality: result.quality, warning: "Das Symbol ist mehrdeutig. StockPilot wählt bewusst keinen Coin automatisch aus." } }, { status: 409, headers });
    if (result.value.status === "not_found") return jsonOk({ ...result.value, metadata: { provider: "CoinGecko", quality: result.quality } }, { status: 404, headers });
    return jsonOk({ ...result.value, metadata: { provider: "CoinGecko", quality: result.quality, fromCache: result.fromCache, cacheStoredAt: result.cacheStoredAt, cacheWarning: result.warning, disclaimer: "CoinGecko dient als Referenzquelle. Diese Antwort ist kein sekündlicher Live-Kurs." } }, { headers });
  } catch {
    return jsonError("Krypto-Referenzdaten sind aktuell nicht verfügbar.", 503);
  }
}
