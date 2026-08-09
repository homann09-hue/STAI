import { describe, expect, it } from "vitest";
import { assessPlanReadiness, type PlanReadinessInput } from "@/lib/billing/plan-readiness";

/**
 * Die Zusicherung, die dieser Prüfung ihren Wert gibt: ein Tarif, der auf der
 * Verkaufsseite steht, aber keine Preis-ID hat, muss auffallen. Sonst führt der
 * Kaufknopf ins Leere, und der Kunde merkt es vor dem Betreiber.
 */

const envNames = {
  pro: { month: "STRIPE_PRO_PRICE_ID", year: "STRIPE_PRO_YEARLY_PRICE_ID" },
  premium: { month: "STRIPE_PREMIUM_PRICE_ID", year: "STRIPE_PREMIUM_YEARLY_PRICE_ID" }
} as const;

function input(overrides: Partial<PlanReadinessInput> = {}): PlanReadinessInput {
  return {
    hasSecretKey: true,
    hasWebhookSecret: true,
    priceIds: {
      pro: { month: "price_pro_month", year: "price_pro_year" },
      premium: { month: "price_premium_month", year: "price_premium_year" }
    },
    paidPlans: ["pro", "premium"],
    priceEnvNames: envNames,
    ...overrides
  };
}

describe("vollständig konfiguriert", () => {
  it("meldet alle Intervalle als buchbar", () => {
    const result = assessPlanReadiness(input());

    expect(result.stripeConfigured).toBe(true);
    expect(result.intervals.every((entry) => entry.bookable)).toBe(true);
    expect(result.advertisedButUnbookable).toEqual([]);
  });
});

describe("fehlende Preis-ID", () => {
  it("meldet genau dieses Intervall als nicht buchbar", () => {
    const result = assessPlanReadiness(
      input({
        priceIds: {
          pro: { month: "price_pro_month", year: null },
          premium: { month: "price_premium_month", year: "price_premium_year" }
        }
      })
    );

    const proYear = result.intervals.find((entry) => entry.plan === "pro" && entry.interval === "year");

    expect(proYear?.bookable).toBe(false);
    expect(proYear?.missing).toContain("STRIPE_PRO_YEARLY_PRICE_ID");
  });

  it("lässt die übrigen Intervalle buchbar", () => {
    // Sonst waere die Meldung unbrauchbar: „irgendetwas fehlt" hilft niemandem.
    const result = assessPlanReadiness(
      input({
        priceIds: {
          pro: { month: "price_pro_month", year: null },
          premium: { month: "price_premium_month", year: "price_premium_year" }
        }
      })
    );

    expect(result.intervals.find((entry) => entry.plan === "pro" && entry.interval === "month")?.bookable).toBe(true);
    expect(result.advertisedButUnbookable).toEqual([]);
  });

  it("nennt einen Tarif, der in keinem Intervall buchbar ist", () => {
    // Der schlimmste Fall: der Tarif steht auf der Verkaufsseite und laesst
    // sich ueberhaupt nicht kaufen.
    const result = assessPlanReadiness(
      input({
        priceIds: {
          pro: { month: "price_pro_month", year: "price_pro_year" },
          premium: { month: null, year: null }
        }
      })
    );

    expect(result.advertisedButUnbookable).toEqual(["premium"]);
  });
});

describe("fehlende Stripe-Grundkonfiguration", () => {
  it("macht jeden Tarif unbuchbar und nennt den Grund", () => {
    const result = assessPlanReadiness(input({ hasSecretKey: false }));

    expect(result.stripeConfigured).toBe(false);
    expect(result.blockingGaps).toContain("STRIPE_SECRET_KEY");
    expect(result.intervals.every((entry) => !entry.bookable)).toBe(true);
    expect(result.advertisedButUnbookable).toEqual(["pro", "premium"]);
  });

  it("nennt das fehlende Webhook-Geheimnis eigens", () => {
    // Ohne Webhook laeuft der Checkout, aber die Freischaltung kommt nie an --
    // der Kunde zahlt und bekommt nichts. Das ist der teuerste Einzelfehler in
    // dieser Kette und darf nicht unter "Stripe nicht konfiguriert" verschwinden.
    const result = assessPlanReadiness(input({ hasWebhookSecret: false }));

    expect(result.blockingGaps).toEqual(["STRIPE_WEBHOOK_SECRET"]);
  });

  it("nennt beide Lücken, wenn beide fehlen", () => {
    const result = assessPlanReadiness(input({ hasSecretKey: false, hasWebhookSecret: false }));

    expect(result.blockingGaps).toEqual(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]);
  });
});
