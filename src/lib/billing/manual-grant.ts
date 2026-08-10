import { normalizePlanId, type EntitlementRow } from "@/lib/billing/entitlements";
import type { PlanId } from "@/lib/feature-gates";

/**
 * Was eine Freischaltung von Hand tun darf — und was nicht.
 *
 * Getrennt von der Route, damit sich die Regeln prüfen lassen, ohne eine
 * Datenbank zu stellen. Die Regeln selbst sind der eigentliche Inhalt:
 *
 * **Eine manuelle Vergabe fasst ein Stripe-Abo nie an.** Sie schreibt
 * ausschließlich die Zeile mit `provider = 'manual'`. Der Grund ist nicht
 * Vorsicht, sondern Zuständigkeit: die Stripe-Zeile ist eine Kopie dessen, was
 * bei Stripe steht. Wer sie hier überschreibt, hat sie beim nächsten Webhook
 * wieder verloren — und in der Zwischenzeit zeigt die Anwendung etwas an, das
 * mit der Abrechnung nicht übereinstimmt.
 *
 * **Ein Entzug entzieht deshalb auch nur die manuelle Zeile.** Wer ein
 * laufendes Stripe-Abo hat, behält seinen Zugang. Das ist richtig so — gekauft
 * ist gekauft —, aber es widerspricht dem, was der Knopf verspricht. Deshalb
 * sagt das Ergebnis es ausdrücklich, statt den Betreiber im Glauben zu lassen,
 * er habe den Zugang beendet.
 */

export const MIN_GRANT_MONTHS = 1;
export const MAX_GRANT_MONTHS = 36;
export const DEFAULT_GRANT_MONTHS = 12;

export type ManualGrantInput = {
  plan: unknown;
  months?: unknown;
  reason?: unknown;
};

export type ManualGrantPlan = {
  plan: PlanId;
  months: number;
  reason: string | null;
};

export type ManualGrantRejection = { ok: false; message: string };

export function parseManualGrant(input: ManualGrantInput): ({ ok: true } & ManualGrantPlan) | ManualGrantRejection {
  if (typeof input.plan !== "string") {
    return { ok: false, message: "Es fehlt der Tarif." };
  }

  // `normalizePlanId` bildet Unbekanntes auf `free` ab. Das ist beim Lesen
  // richtig und hier falsch: ein Tippfehler wuerde stillschweigend zum Entzug.
  const plan = normalizePlanId(input.plan);
  if (plan !== input.plan) {
    return { ok: false, message: "Diesen Tarif gibt es nicht." };
  }

  const rawMonths = input.months === undefined || input.months === null ? DEFAULT_GRANT_MONTHS : Number(input.months);

  if (!Number.isInteger(rawMonths) || rawMonths < MIN_GRANT_MONTHS || rawMonths > MAX_GRANT_MONTHS) {
    return { ok: false, message: `Die Laufzeit muss zwischen ${MIN_GRANT_MONTHS} und ${MAX_GRANT_MONTHS} Monaten liegen.` };
  }

  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";

  // Eine Freischaltung ohne Begruendung ist im Nachhinein nicht mehr
  // aufzuklaeren -- weder fuer den Betreiber noch fuer eine Pruefung.
  if (plan !== "free" && reason.length < 3) {
    return { ok: false, message: "Bitte einen Grund angeben — er steht später im Protokoll." };
  }

  return { ok: true, plan, months: rawMonths, reason: reason.length > 0 ? reason : null };
}

/** Bis wann eine Freischaltung gilt. Unbefristet gibt es bewusst nicht. */
export function grantValidUntil(months: number, now = Date.now()) {
  const until = new Date(now);
  until.setUTCMonth(until.getUTCMonth() + months);
  return until.toISOString();
}

export type GrantOutcome = {
  /** Was in die Zeile `provider = 'manual'` geschrieben wird. */
  row: { plan: PlanId; status: "active" | "canceled"; valid_until: string };
  /** Behält das Konto trotz Entzug Zugang, weil ein Stripe-Abo läuft? */
  stripeSubscriptionRemains: boolean;
  message: string;
};

export function planManualGrant(
  grant: ManualGrantPlan,
  existingRows: readonly EntitlementRow[],
  now = Date.now()
): GrantOutcome {
  const stripeStillPaying = existingRows.some((row) => {
    if (row.provider !== "stripe") return false;
    const status = typeof row.status === "string" ? row.status : "";
    if (status !== "active" && status !== "trialing") return false;
    const validUntil = typeof row.valid_until === "string" ? Date.parse(row.valid_until) : Number.NaN;
    return Number.isFinite(validUntil) ? validUntil > now : true;
  });

  if (grant.plan === "free") {
    return {
      row: { plan: "free", status: "canceled", valid_until: new Date(now).toISOString() },
      stripeSubscriptionRemains: stripeStillPaying,
      message: stripeStillPaying
        ? "Die manuelle Freischaltung ist entzogen. Das Konto behält seinen Zugang, weil ein bezahltes Stripe-Abo weiterläuft — beendet wird das über Stripe, nicht hier."
        : "Die manuelle Freischaltung ist entzogen. Das Konto fällt auf FREE zurück."
    };
  }

  return {
    row: { plan: grant.plan, status: "active", valid_until: grantValidUntil(grant.months, now) },
    stripeSubscriptionRemains: stripeStillPaying,
    message: stripeStillPaying
      ? `${grant.plan.toUpperCase()} ist für ${grant.months} Monate freigeschaltet. Das bestehende Stripe-Abo bleibt unberührt; es gilt der stärkere der beiden Ansprüche.`
      : `${grant.plan.toUpperCase()} ist für ${grant.months} Monate freigeschaltet.`
  };
}
