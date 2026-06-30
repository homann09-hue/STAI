import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const result = await withCacheFallback("dashboard", () => getMarketDataProvider().getDashboard(), {
    staleTtlMs: 180000,
    ttlMs: 15000
  });

  return jsonOk(result.value, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=180",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
