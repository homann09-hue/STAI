import { z } from "zod";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { deleteUserAccount, getSupabaseAuth } from "@/lib/supabase/user-data";

const deletionSchema = z.object({ confirmation: z.literal("KONTO LÖSCHEN") }).strict();

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;
  const parsed = await parseJsonBody(request, deletionSchema);
  if (!parsed.ok) return parsed.response;
  const auth = await getSupabaseAuth(request);
  if (!auth.ok) return jsonError("Anmeldung für die Kontolöschung erforderlich.", 401, { "X-StockPilot-Auth-Reason": auth.reason });

  try {
    await deleteUserAccount(auth);
    return jsonOk({ deleted: true, deletedAt: new Date().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return jsonError("Konto konnte nicht vollständig gelöscht werden.", 503);
  }
}
