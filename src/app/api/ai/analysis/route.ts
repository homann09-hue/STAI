import { getAiAnalysisWithMetadata } from "@/lib/providers/ai-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import { validateSymbol } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

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
      staleTtlMs: costControls.aiStaleTtlMs,
      ttlMs: costControls.aiTtlMs
    }
  );
  const { analysis, metadata } = result.value;

  if (!analysis) {
    return jsonError("KI-Analyse nicht gefunden.", 404);
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
      ...cacheControlHeaders(costControls.aiTtlMs, costControls.aiStaleTtlMs),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.aiTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-AI-Provider": metadata.providerName,
      "X-StockPilot-Data-Quality": metadata.quality,
      "X-StockPilot-Model-Estimate": "true"
    }
  });
}
