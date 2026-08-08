import "server-only";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { summarizeCost, type ProviderId, type ProviderUsageRecord } from "@/lib/cost/provider-costs";
import type { PlanId } from "@/lib/feature-gates";

/**
 * Zählung der Anbieterabrufe.
 *
 * Ohne diese Zählung war das Kostenmodell Theorie: es konnte rechnen, hatte
 * aber keine Zahlen. Hier entsteht die Brücke von einem Abruf zu Konto und
 * Tarif.
 *
 * Zwei Eigenschaften sind für den heißen Pfad entscheidend:
 *
 *  1. **Die Zählung verzögert nie eine Antwort.** Sie läuft nebenher und wird
 *     nicht abgewartet. Ein Nutzer soll nicht länger auf seine Kurse warten,
 *     weil eine Statistik geschrieben wird.
 *  2. **Ein Fehler beim Zählen bricht nichts ab.** Buchhaltung darf niemals
 *     die Funktion beschädigen, über die sie Buch führt. Fehler werden
 *     protokolliert, nicht geworfen.
 *
 * Abrufe ohne angemeldetes Konto werden mit `user_id = null` gezählt. Sie
 * verschwinden nicht — sie sind Teil der Gesamtkosten, nur eben keinem Konto
 * zurechenbar.
 */

export type UsageContext = {
  userId: string | null;
  plan: PlanId;
};

/**
 * Zählt einen Abruf, ohne den Aufrufer zu blockieren.
 *
 * Bewusst ohne `await` gedacht: der Aufrufer ruft die Funktion auf und geht
 * weiter. Sie gibt trotzdem ein Promise zurück, damit Tests darauf warten
 * können.
 */
export async function recordProviderUsage(
  context: UsageContext,
  provider: ProviderId,
  fromCache: boolean
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.rpc("record_provider_usage", {
      p_user_id: context.userId,
      p_plan: context.plan,
      p_provider: provider,
      p_from_cache: fromCache
    });

    if (error) {
      logEvent("warn", "cost.usage_record_failed", {
        provider,
        code: error.code,
        message: error.message
      });
    }
  } catch (error) {
    logEvent("warn", "cost.usage_record_threw", {
      provider,
      message: error instanceof Error ? error.message : "unknown"
    });
  }
}

/**
 * Startet die Zählung, ohne auf sie zu warten.
 *
 * Der eigentliche Aufrufpfad in den Routen. Das explizite Wegwerfen des
 * Promise ist Absicht und keine vergessene Await-Anweisung.
 */
export function trackProviderUsage(context: UsageContext, provider: ProviderId, fromCache: boolean) {
  void recordProviderUsage(context, provider, fromCache);
}

export type UsageRow = {
  user_id: string | null;
  plan: string;
  provider: string;
  fetches: number;
  cache_hits: number;
};

export type AccountCost = {
  userId: string | null;
  plan: PlanId;
  costTenthCents: number;
  fetches: number;
  cacheHits: number;
};

const knownPlans = new Set<PlanId>(["free", "pro", "premium"]);

function normalizePlan(value: string): PlanId {
  return knownPlans.has(value as PlanId) ? (value as PlanId) : "free";
}

/**
 * Fasst gezählte Zeilen je Konto zusammen.
 *
 * Reine Umformung, damit sie ohne Datenbank testbar bleibt. Unbekannte
 * Anbieternamen fallen mit Kosten null durch — sie zu raten wäre schlimmer,
 * als sie sichtbar mit null zu führen.
 */
export function aggregateByAccount(rows: readonly UsageRow[]): AccountCost[] {
  const byAccount = new Map<string, { userId: string | null; plan: PlanId; records: ProviderUsageRecord[] }>();

  for (const row of rows) {
    const key = row.user_id ?? "__anonymous__";
    const existing = byAccount.get(key) ?? {
      userId: row.user_id,
      plan: normalizePlan(row.plan),
      records: []
    };

    existing.records.push({
      provider: row.provider as ProviderId,
      fetches: Number(row.fetches ?? 0),
      cacheHits: Number(row.cache_hits ?? 0)
    });
    byAccount.set(key, existing);
  }

  return Array.from(byAccount.values())
    .map((account) => {
      const summary = summarizeCost(account.records);
      return {
        userId: account.userId,
        plan: account.plan,
        costTenthCents: summary.totalTenthCents,
        fetches: summary.fetches,
        cacheHits: summary.cacheHits
      };
    })
    // Teuerste zuerst: die Liste soll die Frage „wer kostet am meisten"
    // beantworten, nicht alphabetisch sortieren.
    .sort((left, right) => right.costTenthCents - left.costTenthCents);
}
