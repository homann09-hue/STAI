import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { hasPrivilegedAccess } from "@/lib/admin-access";
import { requireAdmin } from "@/lib/billing/admin-guard";
import { entitledCacheHeaders } from "@/lib/billing/feature-guard";
import { assessMargin, formatTenthCents, summarizeCost, type ProviderId } from "@/lib/cost/provider-costs";
import { aggregateByAccount, type UsageRow } from "@/lib/cost/usage-recorder";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { PlanId } from "@/lib/feature-gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;
const MAX_ACCOUNTS_REPORTED = 25;

/**
 * Kostenkennzahlen nach §7.
 *
 * Beantwortet vier Fragen mit gemessenen Zahlen: Was kosten die externen Daten?
 * Wie viel spart der Cache? Was kostet ein aktives Konto? Und trägt sein Tarif
 * diese Kosten?
 *
 * Bewusst hinter der Adminprüfung und nicht hinter einem Tarif: das sind
 * Betriebszahlen des Unternehmens, keine Produktfunktion. Die Antwort enthält
 * Konto-IDs — sie gehört niemandem außer dem Betreiber.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  // Zwei Wege hierher, und beide werden gebraucht:
  //
  //   - das Betriebsgeheimnis, fuer Cronjobs und Ueberwachung ohne Konto
  //   - ein angemeldetes Adminkonto, fuer den Adminbereich im Browser
  //
  // Der Adminbereich kann den zweiten Weg nicht umgehen: ein Geheimnis, das
  // JavaScript im Browser mitschickt, ist kein Geheimnis mehr. Ohne diese
  // zweite Tuer haette die Seite entweder keine Kostenzahlen -- oder das
  // Geheimnis staende im ausgelieferten Code.
  //
  // Die Reihenfolge ist Absicht: die Geheimnispruefung ist ein
  // Zeichenkettenvergleich, die Kontopruefung kostet eine Datenbankabfrage.
  if (!hasPrivilegedAccess(request, "admin")) {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return jsonError("Kostenkennzahlen sind ohne Datenbankanbindung nicht ermittelbar.", 503, entitledCacheHeaders);
  }

  const days = Math.min(
    MAX_DAYS,
    Math.max(1, Math.floor(Number(new URL(request.url).searchParams.get("days")) || DEFAULT_DAYS))
  );
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase
      .from("provider_usage")
      .select("user_id,plan,provider,fetches,cache_hits")
      .gte("usage_date", since);

    if (error) throw error;

    const rows = (data ?? []) as UsageRow[];

    const overall = summarizeCost(
      rows.map((row) => ({
        provider: row.provider as ProviderId,
        fetches: Number(row.fetches ?? 0),
        cacheHits: Number(row.cache_hits ?? 0)
      }))
    );

    const accounts = aggregateByAccount(rows);
    const identifiedAccounts = accounts.filter((account) => account.userId !== null);

    // Je Tarif zusammengefasst, damit die Frage "traegt Pro seine Kosten"
    // beantwortbar wird.
    const byPlan = (["free", "pro", "premium"] as PlanId[]).map((plan) => {
      const planAccounts = identifiedAccounts.filter((account) => account.plan === plan);
      const costTenthCents = planAccounts.reduce((sum, account) => sum + account.costTenthCents, 0);
      const averagePerAccount = planAccounts.length === 0 ? 0 : Math.round(costTenthCents / planAccounts.length);

      return {
        plan,
        accounts: planAccounts.length,
        costTenthCents,
        cost: formatTenthCents(costTenthCents),
        averagePerAccountTenthCents: averagePerAccount,
        // Die Margenbewertung gilt dem Durchschnittskonto. Ein einzelner
        // Vielnutzer taucht darunter in `costliestAccounts` auf.
        margin: assessMargin(plan, averagePerAccount)
      };
    });

    return jsonOk(
      {
        window: { days, since },
        totals: {
          ...overall,
          cost: formatTenthCents(overall.totalTenthCents),
          savedByCache: formatTenthCents(overall.savedByCacheTenthCents),
          // Ohne eine einzige Anfrage gibt es keine Quote. Null statt 100 %.
          cacheHitRatePercent: overall.cacheHitRate === null ? null : Math.round(overall.cacheHitRate * 1000) / 10
        },
        byPlan,
        activeAccounts: identifiedAccounts.length,
        anonymousCostTenthCents: accounts
          .filter((account) => account.userId === null)
          .reduce((sum, account) => sum + account.costTenthCents, 0),
        costliestAccounts: identifiedAccounts.slice(0, MAX_ACCOUNTS_REPORTED).map((account) => ({
          userId: account.userId,
          plan: account.plan,
          cost: formatTenthCents(account.costTenthCents),
          costTenthCents: account.costTenthCents,
          fetches: account.fetches,
          cacheHits: account.cacheHits,
          margin: assessMargin(account.plan, account.costTenthCents)
        })),
        disclaimer:
          "Kosten sind aus dokumentierten Anbietertarifen abgeleitet, nicht abgerechnet. Abrufe ohne angemeldetes Konto sind getrennt ausgewiesen und keinem Tarif zugerechnet."
      },
      { headers: entitledCacheHeaders }
    );
  } catch (error) {
    logEvent("error", "cost.metrics_failed", {
      message: error instanceof Error ? error.message : "unknown"
    });
    return jsonError("Kostenkennzahlen konnten nicht ermittelt werden.", 503, entitledCacheHeaders);
  }
}
