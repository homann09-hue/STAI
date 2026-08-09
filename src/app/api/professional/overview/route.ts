import { jsonOk, rateLimit } from "@/lib/api-guard";
import { entitledCacheHeaders, requireFeature } from "@/lib/billing/feature-guard";
import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";
import { withCacheFallback } from "@/lib/provider-cache";
import { getCostControls } from "@/lib/cost-controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  // Das Profi-Terminal ist eine Bezahlleistung. Vor dieser Prüfung lieferte die
  // Route ihren Inhalt an jeden Aufrufer aus, auch ohne Konto.
  const access = await requireFeature(request, "pro_terminal");
  if (!access.ok) return access.response;

  const costControls = getCostControls();
  const provider = getProfessionalDataProvider();
  const result = await withCacheFallback(
    "professional:overview",
    () => provider.getMarketReport(),
    { staleTtlMs: costControls.professionalStaleTtlMs, ttlMs: costControls.professionalTtlMs }
  );

  return jsonOk({
    ...result.value,
    metadata: {
      provider: "StockPilot Professional Data Layer",
      quality: result.fromCache ? "cached" : "mixed",
      fromCache: result.fromCache,
      cacheStoredAt: result.cacheStoredAt,
      cacheWarning: result.warning,
      ttlMs: costControls.professionalTtlMs,
      staleTtlMs: costControls.professionalStaleTtlMs,
      disclaimer:
        "Professionelle Datenfelder können je nach Anbieter, Lizenz und Markt verzögert, nicht verfügbar oder Demo-Daten sein."
    }
  }, {
    headers: {
      ...entitledCacheHeaders,
      "X-StockPilot-Plan": access.entitlements.plan,
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.professionalTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-Data-Quality": result.fromCache ? "cached" : "mixed"
    }
  });
}
