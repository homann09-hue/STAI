import {
  featureDefinitions,
  getPricingTier,
  pricingTiers,
  type FeatureId,
  type PlanId
} from "@/lib/feature-gates";
import type { ResolvedEntitlements } from "@/lib/billing/entitlements";

/**
 * Zentrale Zugriffsentscheidung für kostenpflichtige Funktionen.
 *
 * Diese Datei enthält bewusst keine Ein-/Ausgabe. Sie ist der einzige Ort, an
 * dem beantwortet wird, ob ein Konto eine Funktion nutzen darf — und wenn nicht,
 * warum nicht und was der nächste Schritt ist.
 *
 * Zwei Eigenschaften sind nicht verhandelbar:
 *
 *  1. **Fail closed.** Wenn der Tarif nicht sicher gelesen werden kann, wird
 *     nicht freigegeben. Ein unklarer Billingstatus darf niemals zu Zugriff
 *     führen, sonst wäre eine Störung im Billing ein Gratistarif.
 *  2. **Keine falsche Auskunft.** „Upgrade nötig" wird nur gesagt, wenn der
 *     Tarif bekannt ist und tatsächlich nicht reicht. Ist er unbekannt, sagt die
 *     Antwort genau das — und nicht, der Nutzer müsse zahlen.
 */

export type FeatureDenialReason =
  /** Kein gültiges Konto. Der Nutzer muss sich anmelden. */
  | "authentication_required"
  /** Konto bekannt, Tarif reicht nicht. Ein höherer Tarif enthält die Funktion. */
  | "plan_upgrade_required"
  /** Tarif enthielte die Funktion, sie ist für dieses Konto aber abgeschaltet. */
  | "feature_revoked"
  /** Der Tarif konnte nicht sicher gelesen werden. Weder Zugriff noch Vorwurf. */
  | "billing_unverifiable"
  /** Kein Tarif enthält diese Funktion. Sie existiert noch nicht als Leistung. */
  | "feature_not_available";

export type FeaturePaywall = {
  feature: FeatureId;
  /** Was fehlt — in der Sprache des Nutzers, nicht als Feature-Schlüssel. */
  featureLabel: string;
  /** Welchen Mehrwert die Funktion hat. */
  benefit: string;
  reason: FeatureDenialReason;
  /** Erklärung des Grundes, ohne Schuldzuweisung und ohne Fachjargon. */
  message: string;
  currentPlan: PlanId | null;
  currentPlanName: string | null;
  /** Der günstigste Tarif, der die Funktion enthält. Null, wenn es keinen gibt. */
  requiredPlan: PlanId | null;
  requiredPlanName: string | null;
  requiredPlanPrice: string | null;
  /** Wohin der Nutzer gehen kann. Null, wenn ein Upgrade nicht weiterhilft. */
  upgradePath: string | null;
  /**
   * Wohin sich der Nutzer anmelden kann. Getrennt vom Upgrade-Weg, weil beides
   * an verschiedenen Stellen liegt: die Anmeldung sitzt in den Einstellungen,
   * die Tarife auf der Preisseite. Ein „bitte anmelden" ohne Weg dorthin ist
   * eine Sackgasse.
   */
  signInPath: string | null;
  /**
   * Ob der Weg zum höheren Tarif technisch offen ist. Ein Upgrade-Knopf, hinter
   * dem kein konfigurierter Checkout liegt, wäre eine Funktionsattrappe.
   */
  checkoutAvailable: boolean;
};

export type FeatureAccessDecision =
  | { allowed: true; feature: FeatureId; plan: PlanId }
  | { allowed: false; feature: FeatureId; reason: FeatureDenialReason; paywall: FeaturePaywall };

export type FeatureAccessInput = {
  /** Aufgelöste Entitlements, oder null wenn kein Konto ermittelt werden konnte. */
  entitlements: ResolvedEntitlements | null;
  /** True, wenn ein gültiges Konto existiert. Trennt „nicht angemeldet" von „Tarif zu klein". */
  authenticated: boolean;
  /**
   * False, wenn der Tarif technisch gar nicht gelesen werden konnte — etwa weil
   * Supabase nicht konfiguriert ist. Das ist ein Konfigurationsfehler und darf
   * weder Zugriff geben noch als „bitte anmelden" erscheinen, weil Anmelden das
   * Problem nicht löst. Standard ist true.
   */
  billingReadable?: boolean;
  /** True, wenn für den nötigen Tarif ein Checkout konfiguriert ist. */
  checkoutAvailable?: boolean;
};

const featureLabels = new Map(featureDefinitions.map((feature) => [feature.id, feature.label]));
const featureBenefits = new Map(featureDefinitions.map((feature) => [feature.id, feature.description]));

/**
 * Der günstigste Tarif, der die Funktion tatsächlich enthält.
 *
 * Bewusst aus `pricingTiers` abgeleitet statt danebengeschrieben: eine zweite
 * Liste würde irgendwann von der Preisseite abweichen, und dann würde die
 * Paywall einen Tarif empfehlen, der die Funktion gar nicht freischaltet.
 *
 * `demo` zählt hier nicht als enthalten. Eine angekündigte Funktion ist keine
 * verkaufte Funktion.
 */
export function planThatUnlocks(featureId: FeatureId): PlanId | null {
  const tier = pricingTiers.find((candidate) => candidate.featureStatus[featureId] === "included");
  return tier?.id ?? null;
}

/** Ob überhaupt ein Tarif die Funktion als Leistung enthält. */
export function isFeatureSellable(featureId: FeatureId) {
  return planThatUnlocks(featureId) !== null;
}

function planName(plan: PlanId | null) {
  return plan ? getPricingTier(plan).name : null;
}

function planPrice(plan: PlanId | null) {
  return plan ? getPricingTier(plan).price : null;
}

function denialMessage(reason: FeatureDenialReason, featureLabel: string, requiredPlanName: string | null) {
  switch (reason) {
    case "authentication_required":
      return `${featureLabel} ist an ein Konto gebunden. Bitte melde dich an.`;
    case "plan_upgrade_required":
      return requiredPlanName
        ? `${featureLabel} ist im Tarif ${requiredPlanName} enthalten. Dein aktueller Tarif enthält sie nicht.`
        : `${featureLabel} ist in deinem Tarif nicht enthalten.`;
    case "feature_revoked":
      return `${featureLabel} ist für dieses Konto abgeschaltet. Der Tarif würde die Funktion enthalten.`;
    case "billing_unverifiable":
      return `Dein Tarif lässt sich gerade nicht sicher prüfen. ${featureLabel} bleibt so lange gesperrt — es wird nichts abgerechnet und nichts freigeschaltet.`;
    case "feature_not_available":
      return `${featureLabel} ist noch nicht verfügbar. Kein Tarif enthält diese Funktion derzeit.`;
  }
}

function buildPaywall(
  featureId: FeatureId,
  reason: FeatureDenialReason,
  currentPlan: PlanId | null,
  checkoutAvailable: boolean
): FeaturePaywall {
  const featureLabel = featureLabels.get(featureId) ?? featureId;
  const requiredPlan = planThatUnlocks(featureId);
  const requiredPlanName = planName(requiredPlan);

  // Ein Upgrade hilft nur, wenn es einen Tarif gibt, der die Funktion enthält,
  // und der Grund tatsächlich der Tarif ist. Bei einem Lesefehler im Billing
  // oder bei einer abgeschalteten Funktion führt ein Upgrade-Knopf in die Irre.
  const upgradeHelps = requiredPlan !== null && reason === "plan_upgrade_required";

  // Ohne Konto ist der nächste Schritt die Anmeldung, nicht die Preisseite.
  // StockPilot hat keine eigene Loginseite; die Anmeldung sitzt in den
  // Einstellungen.
  const signInHelps = reason === "authentication_required";

  return {
    feature: featureId,
    featureLabel,
    benefit: featureBenefits.get(featureId) ?? "",
    reason,
    message: denialMessage(reason, featureLabel, requiredPlanName),
    currentPlan,
    currentPlanName: planName(currentPlan),
    requiredPlan,
    requiredPlanName,
    requiredPlanPrice: planPrice(requiredPlan),
    upgradePath: upgradeHelps ? "/pricing" : null,
    signInPath: signInHelps ? "/settings" : null,
    checkoutAvailable: upgradeHelps && checkoutAvailable
  };
}

/**
 * Entscheidet über den Zugriff auf eine kostenpflichtige Funktion.
 *
 * Reihenfolge der Prüfungen ist nicht beliebig: erst muss feststehen, dass die
 * Funktion überhaupt verkauft wird, dann ob ein Konto existiert, dann ob der
 * Tarif lesbar war, dann ob er reicht. Jede andere Reihenfolge erzeugt
 * irgendwann eine Antwort, die dem Nutzer etwas Falsches erzählt.
 */
export function evaluateFeatureAccess(featureId: FeatureId, input: FeatureAccessInput): FeatureAccessDecision {
  const checkoutAvailable = input.checkoutAvailable === true;

  const deny = (reason: FeatureDenialReason, currentPlan: PlanId | null): FeatureAccessDecision => ({
    allowed: false,
    feature: featureId,
    reason,
    paywall: buildPaywall(featureId, reason, currentPlan, checkoutAvailable)
  });

  if (!isFeatureSellable(featureId)) {
    return deny("feature_not_available", input.entitlements?.plan ?? null);
  }

  // Vor jeder Aussage über den Tarif steht die Frage, ob er überhaupt lesbar
  // war. Sonst hiesse es „bitte anmelden", obwohl Anmelden nichts ändert.
  if (input.billingReadable === false) {
    return deny("billing_unverifiable", null);
  }

  if (!input.authenticated || !input.entitlements) {
    return deny("authentication_required", null);
  }

  // Ein degradierter Billingstatus heißt: wir wissen es nicht. Fail closed, aber
  // ohne dem Nutzer zu unterstellen, er habe den falschen Tarif.
  if (input.entitlements.degraded) {
    return deny("billing_unverifiable", null);
  }

  const plan = input.entitlements.plan;

  if (input.entitlements.features[featureId] === true) {
    return { allowed: true, feature: featureId, plan };
  }

  // Der Tarif enthielte die Funktion, das Konto hat sie aber nicht. Das kann nur
  // aus einer expliziten Abschaltung stammen und ist etwas anderes als ein zu
  // kleiner Tarif — ein Upgrade würde hier nichts ändern.
  const includedInPlan = getPricingTier(plan).featureStatus[featureId] === "included";
  return deny(includedInPlan ? "feature_revoked" : "plan_upgrade_required", plan);
}

/**
 * HTTP-Status je Ablehnungsgrund.
 *
 * 402 statt 403 für den Tariffall ist Absicht: der Client muss eine Paywall von
 * einer echten Sperre unterscheiden können, ohne den Text zu interpretieren.
 * 501 für eine Funktion, die kein Tarif enthält — sie ist nicht verboten,
 * sondern schlicht noch nicht gebaut.
 */
export function featureDenialStatus(reason: FeatureDenialReason) {
  switch (reason) {
    case "authentication_required":
      return 401;
    case "plan_upgrade_required":
      return 402;
    case "feature_revoked":
      return 403;
    case "billing_unverifiable":
      return 503;
    case "feature_not_available":
      return 501;
  }
}
