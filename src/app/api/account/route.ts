import { z } from "zod";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { isFreshAccountAuthentication } from "@/lib/account-deletion-policy";
import { AccountDeletionError, runAccountDeletion } from "@/lib/account-deletion";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

const deletionSchema = z.object({ confirmation: z.literal("KONTO LÖSCHEN") }).strict();

export async function DELETE(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;
  const auth = await getSupabaseAuth(request);
  if (!auth.ok) return jsonError("Anmeldung für die Kontolöschung erforderlich.", 401, { "X-StockPilot-Auth-Reason": auth.reason });
  const parsed = await parseJsonBody(request, deletionSchema);
  if (!parsed.ok) return parsed.response;

  const currentUser = await auth.supabase.auth.getUser();
  if (currentUser.error || !currentUser.data.user) {
    return jsonError("Session konnte für die Kontolöschung nicht bestätigt werden.", 401);
  }
  if (!isFreshAccountAuthentication(currentUser.data.user.last_sign_in_at)) {
    return jsonError(
      "Bitte abmelden und erneut anmelden. Kontolöschung erfordert eine Anmeldung innerhalb der letzten zehn Minuten.",
      428,
      { "X-StockPilot-Reauthentication": "required" }
    );
  }

  try {
    const result = await runAccountDeletion(auth);
    return jsonOk(
      { ...result, deletedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AccountDeletionError) return jsonError(error.message, error.status);
    return jsonError("Konto konnte nicht vollständig gelöscht werden.", 503);
  }
}
