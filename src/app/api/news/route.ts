import { getNewsWithMetadata } from "@/lib/providers/news-provider";
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
    return jsonError("Ungültiges Symbol.", 400);
  }

  const symbol = parsed?.success ? parsed.data : undefined;
  const costControls = getCostControls();
  const result = await withCacheFallback(`news:${symbol ?? "all"}`, () =>
    getNewsWithMetadata(symbol)
  , {
    staleTtlMs: costControls.newsStaleTtlMs,
    ttlMs: costControls.newsTtlMs
  }
  );
  const metadata = result.value.metadata as typeof result.value.metadata & { quality?: string };
  const quality = result.fromCache ? "cached" : metadata.quality ?? "mixed";
  const responseBody = {
    ...result.value,
    metadata: {
      ...result.value.metadata,
      quality,
      cache: {
        fromCache: result.fromCache,
        storedAt: result.cacheStoredAt,
        warning: result.warning
      },
      disclaimer:
        "News können gecached, delayed, unvollständig oder Demo-Daten sein. Sentiment und Impact sind modellbasierte Einschätzungen."
    }
  };

  return jsonOk(responseBody, {
    headers: {
      ...cacheControlHeaders(costControls.newsTtlMs, costControls.newsStaleTtlMs),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.newsTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
      "X-StockPilot-Data-Quality": responseBody.metadata.quality
    }
  });
}
