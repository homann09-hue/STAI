import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { getPublicIntelligenceFeed } from "@/lib/intelligence/repository";
import { intelligenceFeedQuerySchema } from "@/lib/intelligence/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const url = new URL(request.url);
  const parsed = intelligenceFeedQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return jsonError("Ungültige Intelligence-Filter.", 400);
  const result = await getPublicIntelligenceFeed(parsed.data);
  return jsonOk(result, {
    status: result.configured ? 200 : 503,
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      "X-StockPilot-Data-Quality": result.configured ? "source-backed" : "unavailable"
    }
  });
}
