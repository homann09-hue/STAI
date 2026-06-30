import { getFundamentalsProvider } from "@/lib/providers/fundamentals-provider";
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
    return jsonError("Ungueltiges Symbol.", 400);
  }

  const costControls = getCostControls();
  const result = await withCacheFallback(`fundamentals:${parsed.data}`, () =>
    getFundamentalsProvider().getFundamentals(parsed.data)
  , {
    staleTtlMs: costControls.fundamentalsStaleTtlMs,
    ttlMs: costControls.fundamentalsTtlMs
  }
  );
  const fundamentals = result.value;

  if (!fundamentals) {
    return jsonError("Fundamentaldaten nicht gefunden.", 404);
  }

  return jsonOk({ fundamentals }, {
    headers: {
      ...cacheControlHeaders(costControls.fundamentalsTtlMs, costControls.fundamentalsStaleTtlMs),
      "X-StockPilot-Cost-Ttl-Ms": `${costControls.fundamentalsTtlMs}`,
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
