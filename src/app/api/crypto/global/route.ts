import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { getCoinGeckoGlobalReference } from "@/lib/providers/coingecko-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  try {
    const result = await getCoinGeckoGlobalReference();
    return jsonOk({ data: result.value, metadata: { provider: "CoinGecko", quality: result.quality, fromCache: result.fromCache, cacheStoredAt: result.cacheStoredAt, cacheWarning: result.warning, disclaimer: "Globale Kryptomarktdaten sind Referenz-Snapshots und keine sekündlichen Live-Kurse." } }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400", "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh", "X-StockPilot-Data-Quality": result.quality } });
  } catch {
    return jsonError("Globale Kryptomarktdaten sind aktuell nicht verfügbar.", 503);
  }
}
