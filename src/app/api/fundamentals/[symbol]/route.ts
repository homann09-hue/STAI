import { getFundamentalsProvider } from "@/lib/providers/fundamentals-provider";
import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { withCacheFallback } from "@/lib/provider-cache";
import { validateSymbol } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const limited = rateLimit(request);
  if (limited) return limited;

  const { symbol } = await params;
  const parsed = validateSymbol(symbol);

  if (!parsed.success) {
    return jsonError("Ungueltiges Symbol.", 400);
  }

  const result = await withCacheFallback(`fundamentals:${parsed.data}`, () =>
    getFundamentalsProvider().getFundamentals(parsed.data)
  );
  const fundamentals = result.value;

  if (!fundamentals) {
    return jsonError("Fundamentaldaten nicht gefunden.", 404);
  }

  return jsonOk({ fundamentals }, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=900",
      "X-StockPilot-Cache": result.fromCache ? "fallback" : "fresh"
    }
  });
}
