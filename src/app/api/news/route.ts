import { getNewsProvider } from "@/lib/providers/news-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import { validateSymbol } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") ?? undefined;
  const parsed = rawSymbol ? validateSymbol(rawSymbol) : null;

  if (parsed && !parsed.success) {
    return jsonError("Ungueltiges Symbol.", 400);
  }

  const symbol = parsed?.success ? parsed.data : undefined;
  const costControls = getCostControls();
  const result = await withCacheFallback(`news:${symbol ?? "all"}`, () =>
    getNewsProvider().getNews(symbol)
  , {
    staleTtlMs: costControls.newsStaleTtlMs,
    ttlMs: costControls.newsTtlMs
  }
  );

  return jsonOk({ news: result.value }, {
    headers: {
      ...cacheControlHeaders(costControls.newsTtlMs, costControls.newsStaleTtlMs),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.newsTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
