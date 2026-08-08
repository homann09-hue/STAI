import { describe, expect, it } from "vitest";
import { resolveEntitlements } from "@/lib/billing/entitlements";
import {
  evaluateFeatureAccess,
  featureDenialStatus,
  isFeatureSellable,
  planThatUnlocks
} from "@/lib/billing/feature-access";
import { pricingTiers } from "@/lib/feature-gates";

/**
 * Diese Tests sichern die Stelle, an der StockPilot Geld verdient oder es
 * verschenkt. Sie prüfen weniger den Erfolgsfall als die Ablehnungen: eine
 * Paywall, die dem Nutzer den falschen Grund nennt, ist schlimmer als gar keine.
 */

const inOneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();

function paidEntitlements(plan: "starter" | "pro" | "elite", overrides: Record<string, unknown> = {}) {
  return resolveEntitlements(
    {
      plan,
      status: "active",
      provider: "stripe",
      provider_customer_id: "cus_00000000000000",
      provider_subscription_id: "sub_00000000000000",
      valid_until: inOneMonth,
      ...overrides
    },
    { billingConfigured: true }
  );
}

function freeEntitlements() {
  return resolveEntitlements({ plan: "free", status: "demo", provider: "none" }, { billingConfigured: true });
}

describe("planThatUnlocks", () => {
  it("nennt den günstigsten Tarif, der die Funktion wirklich enthält", () => {
    expect(planThatUnlocks("pro_terminal")).toBe("pro");
    expect(planThatUnlocks("watchlist_extended")).toBe("starter");
    expect(planThatUnlocks("asset_analysis")).toBe("free");
  });

  it("wertet eine angekündigte Funktion nicht als verkaufte Funktion", () => {
    // `exports` steht in Pro und Elite auf "demo". Eine Paywall darf dafür kein
    // Upgrade verkaufen, denn auch nach dem Upgrade gibt es die Funktion nicht.
    expect(planThatUnlocks("exports")).toBeNull();
    expect(isFeatureSellable("exports")).toBe(false);
  });

  it("bleibt an die Preisseite gebunden statt an eine zweite Liste", () => {
    // Wenn die Preisseite den freischaltenden Tarif ändert, muss die Paywall
    // mitziehen. Genau das prüft dieser Test: die Ableitung, nicht ein Wert.
    for (const feature of ["pro_terminal", "watchlist_extended", "alerts"] as const) {
      const plan = planThatUnlocks(feature);
      if (plan === null) continue;
      const tier = pricingTiers.find((candidate) => candidate.id === plan);
      expect(tier?.featureStatus[feature]).toBe("included");
      const cheaperTiers = pricingTiers.slice(0, pricingTiers.findIndex((candidate) => candidate.id === plan));
      expect(cheaperTiers.every((candidate) => candidate.featureStatus[feature] !== "included")).toBe(true);
    }
  });
});

describe("evaluateFeatureAccess", () => {
  it("lässt einen bezahlten Tarif zu seiner Funktion", () => {
    const decision = evaluateFeatureAccess("pro_terminal", {
      entitlements: paidEntitlements("pro"),
      authenticated: true
    });

    expect(decision.allowed).toBe(true);
  });

  it("gibt eine Free-Funktion ohne Umweg frei", () => {
    const decision = evaluateFeatureAccess("asset_analysis", {
      entitlements: freeEntitlements(),
      authenticated: true
    });

    expect(decision.allowed).toBe(true);
  });

  it("verlangt bei fehlendem Konto eine Anmeldung statt eine Zahlung", () => {
    const decision = evaluateFeatureAccess("pro_terminal", { entitlements: null, authenticated: false });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("authentication_required");
    expect(featureDenialStatus(decision.reason)).toBe(401);
  });

  it("nennt dem Free-Konto Funktion, Tarif, Preis und Weg", () => {
    const decision = evaluateFeatureAccess("pro_terminal", {
      entitlements: freeEntitlements(),
      authenticated: true,
      checkoutAvailable: true
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("plan_upgrade_required");
    expect(featureDenialStatus(decision.reason)).toBe(402);
    // Die vier Angaben aus §6 des Masterprompts: was fehlt, welcher Tarif,
    // welcher Mehrwert, wohin.
    expect(decision.paywall.featureLabel).toBe("Profi-Terminal");
    expect(decision.paywall.requiredPlan).toBe("pro");
    expect(decision.paywall.requiredPlanPrice).toBe("29 € / Monat");
    expect(decision.paywall.benefit.length).toBeGreaterThan(0);
    expect(decision.paywall.upgradePath).toBe("/pricing");
    expect(decision.paywall.checkoutAvailable).toBe(true);
  });

  it("bietet kein Upgrade an, für das kein Checkout konfiguriert ist", () => {
    const decision = evaluateFeatureAccess("pro_terminal", {
      entitlements: freeEntitlements(),
      authenticated: true,
      checkoutAvailable: false
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    // Der Weg wird weiter genannt, der Knopf aber nicht als bedienbar
    // ausgewiesen. Ein Upgrade-Knopf ohne Checkout wäre eine Attrappe.
    expect(decision.paywall.checkoutAvailable).toBe(false);
  });

  it("unterstellt bei unlesbarem Billingstatus keinen zu kleinen Tarif", () => {
    const degraded = resolveEntitlements(null, {
      billingConfigured: true,
      degraded: true,
      reason: "entitlements_unavailable"
    });
    const decision = evaluateFeatureAccess("pro_terminal", { entitlements: degraded, authenticated: true });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("billing_unverifiable");
    expect(featureDenialStatus(decision.reason)).toBe(503);
    // Entscheidend: kein Upgrade-Weg. Wir wissen nicht, ob Zahlen hilft.
    expect(decision.paywall.upgradePath).toBeNull();
    expect(decision.paywall.currentPlan).toBeNull();
  });

  it("gibt bei fehlender Billing-Anbindung nichts frei", () => {
    // Fail closed: ein unfertig konfiguriertes Deployment darf kein Gratistarif
    // sein.
    const decision = evaluateFeatureAccess("pro_terminal", {
      entitlements: null,
      authenticated: false,
      billingReadable: false
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("billing_unverifiable");
  });

  it("trennt eine abgeschaltete Funktion von einem zu kleinen Tarif", () => {
    const revoked = paidEntitlements("pro", { features: { pro_terminal: false } });
    const decision = evaluateFeatureAccess("pro_terminal", { entitlements: revoked, authenticated: true });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("feature_revoked");
    expect(featureDenialStatus(decision.reason)).toBe(403);
    // Ein Upgrade würde hier nichts ändern, also wird auch keines angeboten.
    expect(decision.paywall.upgradePath).toBeNull();
  });

  it("verkauft keine Funktion, die es noch nicht gibt", () => {
    const decision = evaluateFeatureAccess("exports", { entitlements: paidEntitlements("elite"), authenticated: true });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("feature_not_available");
    expect(featureDenialStatus(decision.reason)).toBe(501);
    expect(decision.paywall.upgradePath).toBeNull();
  });

  it("behandelt ein abgelaufenes Abo wie Free, nicht wie bezahlt", () => {
    const expired = resolveEntitlements(
      {
        plan: "pro",
        status: "active",
        provider: "stripe",
        provider_customer_id: "cus_00000000000000",
        valid_until: new Date(Date.now() - 1_000).toISOString()
      },
      { billingConfigured: true }
    );
    const decision = evaluateFeatureAccess("pro_terminal", { entitlements: expired, authenticated: true });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("plan_upgrade_required");
    expect(decision.paywall.currentPlan).toBe("free");
  });

  it("nennt in jeder Ablehnung einen Grund im Klartext", () => {
    const cases = [
      evaluateFeatureAccess("pro_terminal", { entitlements: null, authenticated: false }),
      evaluateFeatureAccess("pro_terminal", { entitlements: freeEntitlements(), authenticated: true }),
      evaluateFeatureAccess("exports", { entitlements: freeEntitlements(), authenticated: true })
    ];

    for (const decision of cases) {
      expect(decision.allowed).toBe(false);
      if (decision.allowed) continue;
      expect(decision.paywall.message.length).toBeGreaterThan(20);
      // Keine Schlüssel, kein Fachjargon in der Nutzeransprache.
      expect(decision.paywall.message).not.toMatch(/pro_terminal|feature_|401|402|undefined|null/);
    }
  });
});
