import type { BillingInterval, PaidPlanId, PlanId } from "@/lib/feature-gates";

/**
 * Ist ein Tarif tatsächlich buchbar?
 *
 * Die Frage klingt trivial und ist es nicht. Ein Tarif steht auf der
 * Verkaufsseite, sobald er in `pricingTiers` steht. Kaufen lässt er sich aber
 * erst, wenn drei Dinge zusammenkommen: ein Stripe-Schlüssel, ein
 * Webhook-Geheimnis und eine Preis-ID für **genau dieses Intervall**.
 *
 * Fehlt eine der Umgebungsvariablen, passiert das Unangenehmste, was an dieser
 * Stelle passieren kann: die Seite bewirbt einen Tarif, der Knopf führt ins
 * Leere, und niemand erfährt davon — am wenigsten der Betreiber. Der Kunde
 * merkt es als Erster.
 *
 * Deshalb ist das hier eine eigene, geprüfte Auskunft und keine Nebenbemerkung
 * in der Oberfläche.
 */

export type PlanBookability = {
  plan: PaidPlanId;
  interval: BillingInterval;
  bookable: boolean;
  /** Welche Umgebungsvariable fehlt — leer, wenn alles da ist. */
  missing: string[];
};

export type PlanReadiness = {
  stripeConfigured: boolean;
  /** Fehlt der Schlüssel oder das Webhook-Geheimnis, ist gar nichts buchbar. */
  blockingGaps: string[];
  intervals: PlanBookability[];
  /** Tarife, die beworben werden, aber in keinem Intervall buchbar sind. */
  advertisedButUnbookable: PaidPlanId[];
};

export type PlanReadinessInput = {
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  priceIds: Record<PaidPlanId, Record<BillingInterval, string | null>>;
  paidPlans: readonly PaidPlanId[];
  priceEnvNames: Record<PaidPlanId, Record<BillingInterval, string>>;
};

export function assessPlanReadiness(input: PlanReadinessInput): PlanReadiness {
  const blockingGaps: string[] = [];
  if (!input.hasSecretKey) blockingGaps.push("STRIPE_SECRET_KEY");
  if (!input.hasWebhookSecret) blockingGaps.push("STRIPE_WEBHOOK_SECRET");

  const stripeConfigured = blockingGaps.length === 0;
  const intervals: PlanBookability[] = [];

  for (const plan of input.paidPlans) {
    for (const interval of ["month", "year"] as BillingInterval[]) {
      const priceId = input.priceIds[plan]?.[interval] ?? null;
      const missing = [...blockingGaps];
      if (!priceId) missing.push(input.priceEnvNames[plan][interval]);

      intervals.push({ plan, interval, bookable: missing.length === 0, missing });
    }
  }

  const advertisedButUnbookable = input.paidPlans.filter((plan) =>
    intervals.filter((entry) => entry.plan === plan).every((entry) => !entry.bookable)
  );

  return { stripeConfigured, blockingGaps, intervals, advertisedButUnbookable };
}

/** Ob ein Tarif überhaupt Geld kostet — FREE braucht keine Stripe-Konfiguration. */
export function isBillablePlan(plan: PlanId): plan is PaidPlanId {
  return plan !== "free";
}
