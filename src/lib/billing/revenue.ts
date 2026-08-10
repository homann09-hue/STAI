import { getMonthlyRevenueCents, type BillingInterval, type PlanId } from "@/lib/feature-gates";

/**
 * Wiederkehrender Umsatz aus den Abo-Einträgen.
 *
 * Die Zahl ist für den Betreiber, nicht für eine Verkaufsseite. Sie ist deshalb
 * bewusst **aufgeteilt statt zusammengefasst**, denn eine einzelne MRR-Zahl
 * verschweigt genau die Unterschiede, auf die es ankommt:
 *
 * - Eine **manuelle Freischaltung** bringt null Euro. Sie ist trotzdem Nutzung
 *   und verursacht Providerkosten. Wer sie in die MRR rechnet, meldet Umsatz,
 *   den es nicht gibt.
 * - Ein **Testzeitraum** bringt heute null Euro und vielleicht morgen etwas.
 *   Ihn mitzuzählen nimmt eine Zahlung vorweg, die noch aussteht.
 * - **Offene Zahlungen** (`past_due`, `unpaid`) sind Abos, die noch bestehen,
 *   aber gerade nicht bezahlt werden. Sie gehören sichtbar gemacht, nicht in
 *   die Summe.
 * - Ein Abo mit **unbekanntem Preis** — etwa aus einer alten Preis-ID, die
 *   keine Umgebungsvariable mehr nennt — ist nicht bezifferbar. Es als
 *   Monatsabo zu schätzen wäre eine erfundene Zahl.
 *
 * Was übrig bleibt, ist die einzige Zahl, die man einem Steuerberater oder
 * Investor zeigen kann: bezahlte, laufende Abos.
 */

export type SubscriptionRecord = {
  plan: PlanId;
  status: string;
  provider: string;
  interval: BillingInterval | null;
};

export type RevenueBreakdown = {
  /** Bezahlte, laufende Abos — die belastbare Zahl. */
  mrrCents: number;
  arrCents: number;
  payingAccounts: number;
  /** Zahlt gerade nicht, Abo besteht aber. */
  atRiskAccounts: number;
  atRiskCents: number;
  /** Kostenlos freigeschaltet: Nutzung ohne Umsatz. */
  compedAccounts: number;
  /** Im Testzeitraum: noch kein Umsatz. */
  trialingAccounts: number;
  /** Abo vorhanden, Betrag nicht zuzuordnen. Muss auffallen. */
  unpricedAccounts: number;
};

const PAYING = new Set(["active"]);
const AT_RISK = new Set(["past_due", "unpaid"]);

export function summarizeRecurringRevenue(records: readonly SubscriptionRecord[]): RevenueBreakdown {
  const breakdown: RevenueBreakdown = {
    mrrCents: 0,
    arrCents: 0,
    payingAccounts: 0,
    atRiskAccounts: 0,
    atRiskCents: 0,
    compedAccounts: 0,
    trialingAccounts: 0,
    unpricedAccounts: 0
  };

  for (const record of records) {
    if (record.plan === "free") continue;

    if (record.status === "trialing") {
      breakdown.trialingAccounts += 1;
      continue;
    }

    const paying = PAYING.has(record.status);
    const atRisk = AT_RISK.has(record.status);
    if (!paying && !atRisk) continue;

    // Eine manuelle Freischaltung ist ein Zugang, keine Zahlung. Der Tarif ist
    // echt, der Umsatz ist null.
    if (record.provider !== "stripe") {
      breakdown.compedAccounts += 1;
      continue;
    }

    const monthly = record.interval === null ? null : getMonthlyRevenueCents(record.plan, record.interval);

    if (monthly === null) {
      breakdown.unpricedAccounts += 1;
      continue;
    }

    if (paying) {
      breakdown.mrrCents += monthly;
      breakdown.payingAccounts += 1;
    } else {
      breakdown.atRiskCents += monthly;
      breakdown.atRiskAccounts += 1;
    }
  }

  // ARR ist die Hochrechnung des laufenden Monats, keine Messung des Jahres.
  // Sie ist eine Fortschreibung und gilt nur, solange sich nichts ändert.
  breakdown.arrCents = breakdown.mrrCents * 12;

  return breakdown;
}

/** Cent-Betrag als deutscher Eurobetrag. */
export function formatEuroCents(cents: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
}
