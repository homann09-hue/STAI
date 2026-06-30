import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const costControls = getCostControls();
  const result = await withCacheFallback(
    "professional:overview",
    () => getProfessionalDataProvider().getMarketReport(),
    { staleTtlMs: costControls.professionalStaleTtlMs, ttlMs: costControls.professionalTtlMs }
  );

  return jsonOk(result.value, {
    headers: {
      ...cacheControlHeaders(costControls.professionalTtlMs, costControls.professionalStaleTtlMs),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.professionalTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
