import "server-only";
import { jsonError } from "@/lib/api-guard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSupabaseAuth } from "@/lib/supabase/user-data";
import { logEvent } from "@/lib/observability";

/**
 * Adminprüfung für Routen.
 *
 * **Die Rolle wird in der Datenbank gelesen, nie aus dem Token.** Das ist keine
 * Vorsicht um ihrer selbst willen:
 *
 * - JWT-Claims sind bis zur nächsten Token-Erneuerung veraltet. Wer heute die
 *   Adminrechte entzieht, hätte sie sonst bis zum Ablauf des Tokens nicht
 *   entzogen.
 * - `user_metadata` ist vom Nutzer selbst beschreibbar und in einer
 *   Rechteentscheidung nichts wert.
 * - Alles, was der Client mitschickt, ist eine Behauptung.
 *
 * Der Service-Client ist hier nötig und begründet: `profiles` gibt dem Nutzer
 * Lesezugriff auf die eigene Zeile, aber die Prüfung darf nicht davon abhängen,
 * dass der Anfragende sie ehrlich weiterreicht.
 *
 * Die Spalte selbst ist gegen Selbsterhebung geschützt — nicht per Policy,
 * sondern über Spalten-Grants. Siehe
 * `supabase/migrations/20260809120000_add_admin_flag_to_profiles.sql`.
 */

export type AdminGuardResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; response: Response };

/** Antwort bei fehlenden Rechten. */
function deny(reason: string, status: 401 | 403 | 503) {
  return jsonError(reason, status);
}

export async function requireAdmin(request: Request): Promise<AdminGuardResult> {
  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    // `missing_client` heisst: Supabase ist nicht vollstaendig konfiguriert.
    // Das ist ein Betriebsfehler und kein Rechtefehler -- ohne die
    // Unterscheidung wuerde ein halbfertiges Deployment wie ein Angriff
    // aussehen.
    if (auth.reason === "missing_client") {
      logEvent("error", "admin.guard_unverifiable", { reason: auth.reason });
      return { ok: false, response: deny("Adminrechte sind derzeit nicht prüfbar.", 503) };
    }

    return { ok: false, response: deny("Für diesen Bereich ist eine Anmeldung nötig.", 401) };
  }

  const service = createSupabaseServiceClient();

  if (!service) {
    logEvent("error", "admin.guard_unverifiable", { reason: "missing_service_client" });
    return { ok: false, response: deny("Adminrechte sind derzeit nicht prüfbar.", 503) };
  }

  const { data, error } = await service
    .from("profiles")
    .select("is_admin, email")
    .eq("id", auth.userId)
    .maybeSingle();

  if (error) {
    // Fail closed. Ein Lesefehler darf nicht in Adminrechte umschlagen.
    logEvent("error", "admin.guard_lookup_failed", { userId: auth.userId, code: error.code });
    return { ok: false, response: deny("Adminrechte sind derzeit nicht prüfbar.", 503) };
  }

  if (!data?.is_admin) {
    logEvent("info", "admin.denied", { userId: auth.userId });
    // Bewusst 404-nah formuliert: dass es einen Adminbereich gibt, muss ein
    // fremdes Konto nicht bestaetigt bekommen.
    return { ok: false, response: deny("Dieser Bereich ist nicht verfügbar.", 403) };
  }

  logEvent("info", "admin.granted", { userId: auth.userId });

  return { ok: true, userId: auth.userId, email: typeof data.email === "string" ? data.email : null };
}

/**
 * Ob ein Konto Admin ist — für Anzeigezwecke.
 *
 * Getrennt von `requireAdmin`, weil eine Navigation, die den Adminpunkt
 * einblendet, keine Berechtigung erteilt. Wer den Punkt sieht, aber keine
 * Rechte hat, läuft trotzdem in die Prüfung der Route.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const service = createSupabaseServiceClient();
  if (!service) return false;

  const { data, error } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  return !error && Boolean(data?.is_admin);
}
