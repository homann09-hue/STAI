import { getFundamentalsWithMetadata } from "@/lib/providers/fundamentals-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { cacheControlHeaders, getCostControls } from "@/lib/cost-controls";
import { validateSymbol } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { symbol } = await params;
  const parsed = validateSymbol(symbol);

  if (!parsed.success) {
    return jsonError("Ungültiges Symbol.", 400);
  }

  const costControls = getCostControls();
  const result = await withCacheFallback(`fundamentals:${parsed.data}`, () =>
    getFundamentalsWithMetadata(parsed.data)
  , {
    staleTtlMs: costControls.fundamentalsStaleTtlMs,
    ttlMs: costControls.fundamentalsTtlMs
  }
  );
  const fundamentals = result.value.fundamentals;
  const responseHeaders = {
    ...cacheControlHeaders(costControls.fundamentalsTtlMs, costControls.fundamentalsStaleTtlMs),
    "X-StockPilot-Cost-Ttl-Ms": `${costControls.fundamentalsTtlMs}`,
    "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh",
    "X-StockPilot-Data-Quality": result.fromCache ? "cached" : result.value.metadata.quality
  };
  const responseBody = {
    ...result.value,
    metadata: {
      ...result.value.metadata,
      quality: result.fromCache ? "cached" : result.value.metadata.quality,
      cache: {
        fromCache: result.fromCache,
        storedAt: result.cacheStoredAt,
        warning: result.warning
      },
      disclaimer:
        "Fundamentaldaten können je nach Anbieter verzögert, gecached, unvollständig oder Mock-Daten sein."
    }
  };

  if (!fundamentals) {
    return jsonOk(
      {
        ...responseBody,
        error: "Fundamentaldaten nicht gefunden."
      },
      {
        status: 404,
        headers: responseHeaders
      }
    );
  }

  return jsonOk(responseBody, {
    headers: responseHeaders
  });
}
