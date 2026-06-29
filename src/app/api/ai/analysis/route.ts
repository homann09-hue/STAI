import { getAiAnalysisProvider } from "@/lib/providers/ai-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { validateSymbol } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return jsonError("symbol query parameter is required", 400);
  }

  const parsed = validateSymbol(symbol);

  if (!parsed.success) {
    return jsonError("Ungueltiges Symbol.", 400);
  }

  const result = await withCacheFallback(`ai:${parsed.data}`, () =>
    getAiAnalysisProvider().getAnalysis(parsed.data)
  );
  const analysis = result.value;

  if (!analysis) {
    return jsonError("KI-Analyse nicht gefunden.", 404);
  }

  return jsonOk({ analysis }, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
