import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRANT_MONTHS,
  MAX_GRANT_MONTHS,
  grantValidUntil,
  parseManualGrant,
  planManualGrant
} from "@/lib/billing/manual-grant";
import type { EntitlementRow } from "@/lib/billing/entitlements";

const now = Date.UTC(2026, 7, 9);
const future = new Date(Date.UTC(2027, 0, 1)).toISOString();
const past = new Date(Date.UTC(2026, 0, 1)).toISOString();

const activeStripe: EntitlementRow = { plan: "pro", status: "active", provider: "stripe", valid_until: future };

describe("Was angenommen wird", () => {
  it("nimmt einen gültigen Tarif mit Grund an", () => {
    const result = parseManualGrant({ plan: "premium", months: 3, reason: "Support-Fall #12" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("sollte annehmen");
    expect(result.plan).toBe("premium");
    expect(result.months).toBe(3);
  });

  it("setzt eine Standardlaufzeit, wenn keine angegeben ist", () => {
    const result = parseManualGrant({ plan: "pro", reason: "Beta-Tester" });

    expect(result.ok && result.months).toBe(DEFAULT_GRANT_MONTHS);
  });
});

describe("Was abgelehnt wird", () => {
  it("lehnt einen unbekannten Tarif ab, statt ihn auf FREE abzubilden", () => {
    // Der gefaehrliche Fall. `normalizePlanId` bildet Unbekanntes auf `free`
    // ab -- beim Lesen richtig, hier fatal: aus einem Tippfehler („premuim")
    // wuerde stillschweigend ein **Entzug**.
    const result = parseManualGrant({ plan: "premuim", reason: "Kulanz" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("hätte ablehnen müssen");
    expect(result.message).toMatch(/gibt es nicht/);
  });

  it("lehnt eine Freischaltung ohne Grund ab", () => {
    expect(parseManualGrant({ plan: "pro", reason: "" }).ok).toBe(false);
    expect(parseManualGrant({ plan: "pro" }).ok).toBe(false);
  });

  it("lehnt unmögliche Laufzeiten ab", () => {
    expect(parseManualGrant({ plan: "pro", months: 0, reason: "x-y-z" }).ok).toBe(false);
    expect(parseManualGrant({ plan: "pro", months: MAX_GRANT_MONTHS + 1, reason: "x-y-z" }).ok).toBe(false);
    expect(parseManualGrant({ plan: "pro", months: 1.5, reason: "x-y-z" }).ok).toBe(false);
  });

  it("verlangt für den Entzug keinen Grund", () => {
    // Ein Entzug nimmt nichts weg, was bezahlt wurde -- er beendet eine
    // Zuwendung. Eine Pflichtbegruendung wuerde hier nur dazu fuehren, dass
    // „x" eingetippt wird.
    expect(parseManualGrant({ plan: "free" }).ok).toBe(true);
  });
});

describe("Die Laufzeit", () => {
  it("endet in der Zukunft", () => {
    expect(Date.parse(grantValidUntil(1, now))).toBeGreaterThan(now);
  });

  it("rechnet in Monaten, nicht in 30-Tage-Schritten", () => {
    // Zwoelf Monate ab dem 9. August sind der 9. August des Folgejahres, nicht
    // der 4. August.
    expect(grantValidUntil(12, now).slice(0, 10)).toBe("2027-08-09");
  });
});

describe("Eine Vergabe fasst Stripe nicht an", () => {
  it("schreibt ausschließlich die manuelle Zeile", () => {
    const outcome = planManualGrant({ plan: "premium", months: 6, reason: "Kulanz" }, [activeStripe], now);

    expect(outcome.row.plan).toBe("premium");
    expect(outcome.row.status).toBe("active");
  });

  it("sagt es, wenn daneben ein bezahltes Abo läuft", () => {
    const outcome = planManualGrant({ plan: "premium", months: 6, reason: "Kulanz" }, [activeStripe], now);

    expect(outcome.stripeSubscriptionRemains).toBe(true);
    expect(outcome.message).toMatch(/Stripe-Abo bleibt unberührt/);
  });
});

describe("Ein Entzug", () => {
  it("beendet die manuelle Zeile", () => {
    const outcome = planManualGrant({ plan: "free", months: 1, reason: null }, [], now);

    expect(outcome.row.status).toBe("canceled");
    expect(outcome.message).toMatch(/fällt auf FREE/);
  });

  it("warnt, dass ein bezahltes Abo weiterläuft", () => {
    // Der Knopf heisst „entziehen", und das Konto behaelt trotzdem Zugang.
    // Beides ist richtig -- gekauft ist gekauft --, aber der Betreiber darf
    // nicht im Glauben bleiben, er haette den Zugang beendet.
    const outcome = planManualGrant({ plan: "free", months: 1, reason: null }, [activeStripe], now);

    expect(outcome.stripeSubscriptionRemains).toBe(true);
    expect(outcome.message).toMatch(/behält seinen Zugang/);
    expect(outcome.message).toMatch(/über Stripe/);
  });

  it("warnt nicht bei einem abgelaufenen Stripe-Abo", () => {
    const expiredStripe: EntitlementRow = { plan: "pro", status: "active", provider: "stripe", valid_until: past };
    const outcome = planManualGrant({ plan: "free", months: 1, reason: null }, [expiredStripe], now);

    expect(outcome.stripeSubscriptionRemains).toBe(false);
  });

  it("warnt nicht bei einem gekündigten Stripe-Abo", () => {
    const canceled: EntitlementRow = { plan: "pro", status: "canceled", provider: "stripe", valid_until: future };

    expect(planManualGrant({ plan: "free", months: 1, reason: null }, [canceled], now).stripeSubscriptionRemains).toBe(
      false
    );
  });
});
