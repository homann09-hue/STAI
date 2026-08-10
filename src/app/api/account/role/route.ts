import { jsonOk, rateLimit } from "@/lib/api-guard";
import { isAdminUser } from "@/lib/billing/admin-guard";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ob das angemeldete Konto Adminrechte hat — **nur für die Anzeige**.
 *
 * Die Navigation braucht die Auskunft, um den Punkt „Verwaltung" ein- oder
 * auszublenden. Sie erteilt damit keine Berechtigung: wer den Punkt sieht,
 * läuft in `/admin` trotzdem in die Prüfung jeder einzelnen Route, und wer ihn
 * nicht sieht, kommt durch Eintippen der Adresse keinen Schritt weiter.
 *
 * Zwei Entscheidungen, die auf den ersten Blick nachlässig aussehen und es
 * nicht sind:
 *
 * **Immer 200, nie ein Fehlerstatus.** Diese Route wird auf *jeder* Seite
 * aufgerufen, auch von nicht angemeldeten Besuchern. Ein 401 dafür wäre kein
 * Sicherheitsgewinn, würde aber auf jeder Seite einen fehlgeschlagenen Abruf in
 * der Browserkonsole hinterlassen — und damit echte Fehler unter Rauschen
 * begraben.
 *
 * **`false` im Zweifel.** Kein Konto, ungültiges Token, Datenbank nicht
 * erreichbar: in allen Fällen `false`. Die Antwort schließt, sie öffnet nicht.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const headers = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };
  const auth = await getSupabaseAuth(request);

  if (!auth.ok) return jsonOk({ isAdmin: false }, { headers });

  return jsonOk({ isAdmin: await isAdminUser(auth.userId) }, { headers });
}
