import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { getPublicIntelligenceEvent } from "@/lib/intelligence/repository";
import { intelligenceIdSchema } from "@/lib/intelligence/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const parsed = intelligenceIdSchema.safeParse((await params).id);
  if (!parsed.success) return jsonError("Ungültige Ereignis-ID.", 400);
  const result = await getPublicIntelligenceEvent(parsed.data);
  if (!result.configured) return jsonOk(result, { status: 503 });
  if (!result.event) return jsonError("Intelligence-Ereignis nicht gefunden.", 404);
  return jsonOk(result, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
}
