import { z } from "zod";
import { hasPrivilegedAccess } from "@/lib/admin-access";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { reproduceIntelligenceAnalysis } from "@/lib/institutional/reproduction";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const reproductionRequestSchema = z.object({
  analysisId: z.string().uuid()
}).strict();

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!hasPrivilegedAccess(request, "analysis_reproduction")) {
    return jsonError("Reproduction Runs sind nur für autorisierte Admin-Jobs verfügbar.", 401);
  }
  const parsed = await parseJsonBody(request, reproductionRequestSchema);
  if (!parsed.ok) return parsed.response;

  try {
    return jsonOk(await reproduceIntelligenceAnalysis(parsed.data.analysisId), {
      headers: { "X-StockPilot-Control": "analysis-reproduction" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reproduction Run fehlgeschlagen.";
    if (message.includes("nicht gefunden")) return jsonError("Analyse wurde nicht gefunden.", 404);
    if (message.includes("legacy_unverified")) return jsonError(message, 409);
    return jsonError("Reproduction Run ist vorübergehend nicht verfügbar.", 503);
  }
}
