import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";
import { withCacheFallback } from "@/lib/provider-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const result = await withCacheFallback(
    "professional:overview",
    () => getProfessionalDataProvider().getMarketReport(),
    { ttlMs: 15000 }
  );

  return jsonOk(result.value, {
    headers: {
      "Cache-Control": "s-maxage=15, stale-while-revalidate=60",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
