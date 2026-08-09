import { getPricingTier, pricingTiers, type PlanId, type PlanLimits } from "@/lib/feature-gates";

/**
 * Tagesquoten.
 *
 * Die Tarife versprechen `aiAnalysesPerDay` und `apiRequestsPerDay`, seit
 * Beginn. Geprüft wurde davon nichts — ein Free-Konto konnte beliebig viele
 * kostenpflichtige Analysen auslösen. Das ist zweierlei zugleich: ein
 * Kostenproblem (§7) und eine unwahre Zusage im Tarif (§4).
 *
 * Diese Datei entscheidet, sie zählt nicht. Gezählt wird in der Datenbank, in
 * einer einzigen atomaren Anweisung — sonst könnten zwei gleichzeitige Anfragen
 * beide die letzte freie Einheit sehen.
 */

export type QuotaKey = "aiAnalysesPerDay" | "apiRequestsPerDay";

/** Der Name, unter dem der Verbrauch in der Datenbank steht. */
export const quotaFeatureNames: Record<QuotaKey, string> = {
  aiAnalysesPerDay: "ai_analysis",
  apiRequestsPerDay: "api_request"
};

export type QuotaStatus = {
  quota: QuotaKey;
  label: string;
  plan: PlanId;
  used: number;
  limit: number;
  remaining: number;
  /** Wann der Zähler wieder bei null steht, in UTC. */
  resetsAt: string;
  /** Der günstigste Tarif mit einer höheren Grenze. Null, wenn keiner höher liegt. */
  upgradePlan: PlanId | null;
  upgradeLimit: number | null;
  message: string;
};

const quotaLabels: Record<QuotaKey, string> = {
  aiAnalysesPerDay: "KI-Analysen",
  apiRequestsPerDay: "API-Abrufe"
};

export function quotaLimitFor(plan: PlanId, quota: QuotaKey) {
  const limits: PlanLimits = getPricingTier(plan).limits;
  return limits[quota];
}

/**
 * Der günstigste Tarif mit einer echt höheren Grenze.
 *
 * Aus `pricingTiers` abgeleitet statt danebengepflegt: eine zweite Liste würde
 * irgendwann einen Tarif empfehlen, der dieselbe Grenze hat.
 */
export function planWithHigherQuota(currentPlan: PlanId, quota: QuotaKey): PlanId | null {
  const currentLimit = quotaLimitFor(currentPlan, quota);
  const better = pricingTiers.find((tier) => tier.limits[quota] > currentLimit);
  return better?.id ?? null;
}

/**
 * Beginn des nächsten UTC-Tages.
 *
 * Bewusst UTC und nicht die Zeitzone des Aufrufers: eine Quote, die sich mit
 * der Zeitzone verschiebt, lässt sich durch eine geänderte Systemzeit umgehen.
 */
export function nextQuotaReset(now: Date = new Date()) {
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return reset.toISOString();
}

export function secondsUntilReset(now: Date = new Date()) {
  return Math.max(1, Math.ceil((Date.parse(nextQuotaReset(now)) - now.getTime()) / 1000));
}

function quotaMessage(quota: QuotaKey, plan: PlanId, limit: number, upgradePlan: PlanId | null, upgradeLimit: number | null) {
  const label = quotaLabels[quota];

  if (limit <= 0) {
    return upgradePlan
      ? `${label} sind im Tarif ${getPricingTier(plan).name} nicht enthalten. Der Tarif ${getPricingTier(upgradePlan).name} enthält ${upgradeLimit} pro Tag.`
      : `${label} sind in deinem Tarif nicht enthalten.`;
  }

  const base = `Das Tageslimit von ${limit} ${label} für den Tarif ${getPricingTier(plan).name} ist erreicht.`;

  return upgradePlan && upgradeLimit !== null
    ? `${base} Der Tarif ${getPricingTier(upgradePlan).name} erlaubt ${upgradeLimit} pro Tag. Morgen steht das Kontingent wieder zur Verfügung.`
    : `${base} Morgen steht das Kontingent wieder zur Verfügung.`;
}

/**
 * Baut den Statusbericht zu einer Quote.
 *
 * `used` und `limit` stammen aus der Datenbank, damit die Antwort denselben
 * Stand nennt, gegen den tatsächlich geprüft wurde. Ein hier neu berechneter
 * Wert könnte davon abweichen.
 */
export function buildQuotaStatus(
  quota: QuotaKey,
  plan: PlanId,
  used: number,
  limit: number,
  now: Date = new Date()
): QuotaStatus {
  const upgradePlan = planWithHigherQuota(plan, quota);
  const upgradeLimit = upgradePlan ? quotaLimitFor(upgradePlan, quota) : null;
  const safeUsed = Math.max(0, Math.floor(used));
  const safeLimit = Math.max(0, Math.floor(limit));

  return {
    quota,
    label: quotaLabels[quota],
    plan,
    used: safeUsed,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - safeUsed),
    resetsAt: nextQuotaReset(now),
    upgradePlan,
    upgradeLimit,
    message: quotaMessage(quota, plan, safeLimit, upgradePlan, upgradeLimit)
  };
}

/** Kopfzeilen, die den Stand auch ohne Auswertung des Bodys sichtbar machen. */
export function quotaHeaders(status: QuotaStatus) {
  return {
    "X-StockPilot-Quota": status.quota,
    "X-StockPilot-Quota-Limit": `${status.limit}`,
    "X-StockPilot-Quota-Remaining": `${status.remaining}`,
    "X-StockPilot-Quota-Reset": status.resetsAt
  };
}
