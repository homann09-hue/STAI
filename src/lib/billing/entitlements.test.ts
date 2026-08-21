import { describe, expect, it } from "vitest";
import { pricingTiers } from "@/lib/feature-gates";
import {
  evaluateResourceLimit,
  normalizePlanId,
  resolveEntitlements,
  toPublicEntitlements
} from "@/lib/billing/entitlements";

const future = "2030-01-01T00:00:00.000Z";

describe("billing entitlements", () => {
  it("returns a usable but limited free entitlement without a provider record", () => {
    const entitlement = resolveEntitlements(null, { billingConfigured: false, now: 1_800_000_000_000 });

    expect(entitlement.plan).toBe("free");
    expect(entitlement.billingActive).toBe(false);
    expect(entitlement.features.asset_analysis).toBe(true);
    expect(entitlement.features.pro_terminal).toBe(false);
    expect(entitlement.limits.maxWatchlistItems).toBe(15);
  });

  it("activates a paid Stripe plan only with provider configuration and a future period end", () => {
    const record = {
      plan: "pro",
      status: "active",
      provider: "stripe",
      provider_customer_id: "cus_verified123456",
      provider_subscription_id: "sub_verified123456",
      provider_price_id: "price_verified123456",
      valid_until: future
    };

    expect(resolveEntitlements(record, { billingConfigured: false, now: 1_800_000_000_000 }).plan).toBe("free");

    const active = resolveEntitlements(record, { billingConfigured: true, now: 1_800_000_000_000 });
    expect(active.plan).toBe("pro");
    expect(active.billingActive).toBe(true);
    expect(active.canManageBilling).toBe(true);
    expect(active.features.pro_terminal).toBe(true);
  });

  it("fails closed for expired, past-due and incomplete subscriptions", () => {
    for (const status of ["past_due", "incomplete", "unpaid"]) {
      const entitlement = resolveEntitlements(
        { plan: "pro", status, provider: "stripe", valid_until: future },
        { billingConfigured: true, now: 1_800_000_000_000 }
      );
      expect(entitlement.plan).toBe("free");
      expect(entitlement.billingActive).toBe(false);
    }

    const expired = resolveEntitlements(
      { plan: "pro", status: "active", provider: "stripe", valid_until: "2020-01-01T00:00:00Z" },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );
    expect(expired.status).toBe("expired");
    expect(expired.plan).toBe("free");
  });

  it("routes recoverable Stripe states to billing management instead of a second checkout", () => {
    for (const status of ["past_due", "incomplete", "unpaid", "paused"] as const) {
      const entitlement = resolveEntitlements(
        {
          plan: "pro",
          status,
          provider: "stripe",
          provider_customer_id: "cus_verified123456",
          provider_subscription_id: "sub_verified123456",
          valid_until: future
        },
        { billingConfigured: true, now: 1_800_000_000_000 }
      );
      expect(entitlement.billingActive).toBe(false);
      expect(entitlement.paymentRecoveryRequired).toBe(true);
      expect(entitlement.canManageBilling).toBe(true);
      expect(entitlement.canStartCheckout).toBe(false);
    }
  });

  it("allows a new checkout after terminal history but not during active or manual access", () => {
    const canceled = resolveEntitlements(
      {
        plan: "pro",
        status: "canceled",
        provider: "stripe",
        provider_customer_id: "cus_verified123456",
        valid_until: future
      },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );
    const active = resolveEntitlements(
      {
        plan: "pro",
        status: "active",
        provider: "stripe",
        provider_customer_id: "cus_verified123456",
        valid_until: future
      },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );
    const manual = resolveEntitlements(
      { plan: "pro", status: "active", provider: "manual", valid_until: future },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );

    expect(canceled.canStartCheckout).toBe(true);
    expect(active.canStartCheckout).toBe(false);
    expect(manual.canStartCheckout).toBe(false);
  });

  it("allows feature overrides to disable access but never elevate unfinished features", () => {
    const entitlement = resolveEntitlements(
      {
        plan: "pro",
        status: "active",
        provider: "manual",
        valid_until: future,
        features: { pro_terminal: false, team: true }
      },
      { billingConfigured: false, now: 1_800_000_000_000 }
    );

    expect(entitlement.features.pro_terminal).toBe(false);
    expect(entitlement.features.exports).toBe(false);
  });

  it("applies limits while preserving idempotent updates of existing resources", () => {
    const entitlement = resolveEntitlements(null, { billingConfigured: false });
    expect(evaluateResourceLimit(entitlement, "maxWatchlistItems", 15).allowed).toBe(false);
    expect(evaluateResourceLimit(entitlement, "maxWatchlistItems", 10, true).allowed).toBe(true);
    expect(evaluateResourceLimit(entitlement, "maxAlerts", Number.NaN)).toEqual({
      allowed: true,
      current: 0,
      limit: 3,
      remaining: 3
    });
  });

  it("redacts provider identifiers from the public entitlement response", () => {
    const entitlement = resolveEntitlements(
      {
        plan: "pro",
        status: "active",
        provider: "stripe",
        provider_customer_id: "cus_verified123456",
        provider_subscription_id: "sub_verified123456",
        provider_price_id: "price_verified123456",
        valid_until: future
      },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );

    const publicValue = toPublicEntitlements(entitlement) as Record<string, unknown>;
    expect(publicValue.providerCustomerId).toBeUndefined();
    expect(publicValue.providerSubscriptionId).toBeUndefined();
    expect(publicValue.providerPriceId).toBeUndefined();
    expect(publicValue.canStartCheckout).toBe(false);
    expect(publicValue.paymentRecoveryRequired).toBe(false);
  });
});

/**
 * Regressionstest zur Tarifumstellung vom 2026-08-08.
 *
 * Vor der Umstellung hiessen die Tarife free/starter/pro/elite. `entitlements`
 * enthielt zu dem Zeitpunkt null Zeilen, die Abbildung ist also Vorsorge — aber
 * eine, die zaehlt: ohne sie wuerde `normalizePlanId` einen Altbestand still auf
 * `free` zurueckstufen und einem zahlenden Konto seinen Tarif nehmen.
 */
describe("legacy plan names after the FREE/PRO/PREMIUM change", () => {
  it("ordnet alte Tarifnamen nach oben zu, nie nach unten", () => {
    expect(normalizePlanId("starter")).toBe("pro");
    expect(normalizePlanId("elite")).toBe("premium");
  });

  it("laesst die aktuellen Namen unveraendert", () => {
    expect(normalizePlanId("free")).toBe("free");
    expect(normalizePlanId("pro")).toBe("pro");
    expect(normalizePlanId("premium")).toBe("premium");
  });

  it("stuft einen erfundenen Tarifnamen auf free zurueck", () => {
    // Ein unbekannter Name darf niemals Zugriff eroeffnen.
    expect(normalizePlanId("enterprise_gold")).toBe("free");
    expect(normalizePlanId(null)).toBe("free");
    expect(normalizePlanId(42)).toBe("free");
  });
});

describe("keine Limits ohne Funktion", () => {
  it("kennt nur Limits, die etwas begrenzen", () => {
    // `maxWatchlists` und `maxSavedScreeners` standen lange im Tarifmodell und
    // begrenzten Funktionen, die es nicht gibt: das Datenmodell kennt genau
    // eine Watchlist je Nutzer, und einen gespeicherten Screener gibt es
    // nirgends. Nach §90 ist auch Konfiguration eine Fassade, wenn sie
    // Faehigkeiten verspricht, die nicht bestehen.
    //
    // Sie duerfen zurueckkommen -- aber zusammen mit der Funktion und einer
    // Route, die sie durchsetzt.
    const limits = pricingTiers[0].limits as Record<string, unknown>;

    expect(limits).not.toHaveProperty("maxWatchlists");
    expect(limits).not.toHaveProperty("maxSavedScreeners");
  });

  it("hat für jedes verbliebene Limit einen Durchsetzungsort", () => {
    // Die vier echten Limits: Watchlist-Werte, Alerts, Portfolios und
    // Historienjahre. Alle vier werden serverseitig durchgesetzt und stehen
    // auch auf der Preisseite.
    expect(Object.keys(pricingTiers[0].limits).sort()).toEqual(
      ["aiAnalysesPerDay", "apiRequestsPerDay", "historicalDataYears", "maxAlerts", "maxWatchlistItems", "portfolios"].sort()
    );
  });
});
