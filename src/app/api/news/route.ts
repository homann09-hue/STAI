import { getNewsProvider } from "@/lib/providers/news-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { validateSymbol } from "@/lib/validation";

export async function GET(request: Request) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawSymbol = searchParams.get("symbol") ?? undefined;
  const parsed = rawSymbol ? validateSymbol(rawSymbol) : null;

  if (parsed && !parsed.success) {
    return jsonError("Ungueltiges Symbol.", 400);
  }

  const symbol = parsed?.success ? parsed.data : undefined;
  const result = await withCacheFallback(`news:${symbol ?? "all"}`, () =>
    getNewsProvider().getNews(symbol)
  );

  return jsonOk({ news: result.value }, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
