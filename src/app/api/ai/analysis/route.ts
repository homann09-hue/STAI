import { getAiAnalysisProvider } from "@/lib/providers/ai-provider";
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
  const result = await withCacheFallback(`ai:${parsed.data}`, () =>
    getAiAnalysisProvider().getAnalysis(parsed.data)
  , {
    staleTtlMs: costControls.aiStaleTtlMs,
    ttlMs: costControls.aiTtlMs
  }
  );
  const analysis = result.value;

  if (!analysis) {
    return jsonError("KI-Analyse nicht gefunden.", 404);
  }

  return jsonOk({ analysis }, {
    headers: {
      ...cacheControlHeaders(costControls.aiTtlMs, costControls.aiStaleTtlMs),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.aiTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
