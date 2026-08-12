import { getAiAnalysisWithMetadata } from "@/lib/providers/ai-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { consumeQuota, entitledCacheHeaders, requireFeature } from "@/lib/billing/feature-guard";
import { quotaHeaders } from "@/lib/billing/usage-quota";
import { trackProviderUsage } from "@/lib/cost/usage-recorder";
import { withCacheFallback } from "@/lib/provider-cache";
import { getCostControls } from "@/lib/cost-controls";
import { validateSymbol } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  // KI-Analysen kosten je Aufruf Geld. Eine Tagesquote laesst sich nur je Konto
  // fuehren, deshalb steht hier eine Anmeldung vor dem ersten Aufruf.
  const access = await requireFeature(request, "ai_news");
  if (!access.ok) return access.response;

  const quota = await consumeQuota(access.auth, access.entitlements, "aiAnalysesPerDay");
  if (!quota.ok) return quota.response;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return jsonError("symbol query parameter is required", 400);
  }

  const parsed = validateSymbol(symbol);

  if (!parsed.success) {
    return jsonError("Ungültiges Symbol.", 400);
  }

  const costControls = getCostControls();
  const result = await withCacheFallback(
    `ai:${parsed.data}`,
    () => getAiAnalysisWithMetadata(parsed.data),
    {
      policy: "ai_analysis",
      staleTtlMs: costControls.aiStaleTtlMs,
      ttlMs: costControls.aiTtlMs
    }
  );
  // Die Zaehlung laeuft nebenher und verzoegert die Antwort nicht. Ein
  // Cache-Treffer kostet nichts und wird trotzdem gezaehlt -- sonst waere die
  // Trefferquote nicht messbar.
  trackProviderUsage(
    { userId: access.auth.userId, plan: access.entitlements.plan },
    "ai_model",
    result.fromCache
  );

  const { analysis, metadata } = result.value;

  if (!analysis) {
    return jsonError(
      metadata.analysisStatus === "blocked"
        ? "Für eine belastbare Einschätzung liegen derzeit nicht genügend verifizierte Daten vor."
        : "KI-Analyse nicht gefunden.",
      metadata.analysisStatus === "blocked" ? 422 : 404
    );
  }

  return jsonOk({
    analysis,
    metadata: {
      ...metadata,
      generatedFrom: result.fromCache ? "cache" : metadata.generatedFrom,
      cache: {
        fromCache: result.fromCache,
        storedAt: result.cacheStoredAt,
        warning: result.warning
      },
      disclaimer:
        "Keine Anlageberatung. KI-Analysen sind modellbasierte Einschätzungen und können falsch sein."
    }
  }, {
    headers: {
      ...entitledCacheHeaders,
      ...quotaHeaders(quota.status),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.aiTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-AI-Provider": metadata.providerName,
      "X-StockPilot-Data-Quality": metadata.quality,
      "X-StockPilot-Model-Estimate": "true"
    }
  });
}
