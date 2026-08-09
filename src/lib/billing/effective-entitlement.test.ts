import { describe, expect, it } from "vitest";
import { pickEffectiveEntitlement, type EntitlementRow } from "@/lib/billing/entitlements";

/**
 * Welcher Eintrag gilt, wenn ein Konto mehrere hat.
 *
 * Die Frage stellt sich, sobald es eine manuelle Freischaltung neben einem
 * Stripe-Abo gibt — also genau dann, wenn der Adminbereich seine Arbeit tut.
 * Vorher entschied `order by updated_at desc limit 1`: der zuletzt geschriebene
 * Eintrag gewann. Das ist kein Kriterium, sondern ein Zufall.
 */

const options = { billingConfigured: true, now: Date.UTC(2026, 7, 9) };

const future = new Date(Date.UTC(2026, 11, 31)).toISOString();
const past = new Date(Date.UTC(2026, 0, 31)).toISOString();

function stripeRow(plan: string, updatedAt: string, status = "active"): EntitlementRow {
  return {
    plan,
    status,
    provider: "stripe",
    provider_customer_id: "cus_00000000000001",
    provider_subscription_id: "sub_00000000000001",
    valid_until: future,
    updated_at: updatedAt
  };
}

function manualRow(plan: string, updatedAt: string, validUntil: string | null = future): EntitlementRow {
  return { plan, status: "active", provider: "manual", valid_until: validUntil, updated_at: updatedAt };
}

describe("ohne Eintrag", () => {
  it("bleibt bei FREE", () => {
    expect(pickEffectiveEntitlement([], options).plan).toBe("free");
    expect(pickEffectiveEntitlement([], options).billingActive).toBe(false);
  });
});

describe("Stripe-Abo und manuelle Freischaltung nebeneinander", () => {
  it("gibt dem Kunden den stärkeren Tarif — egal wer zuletzt geschrieben hat", () => {
    // Der eigentliche Fehlerfall. Kunde zahlt PRO, bekommt PREMIUM aus Kulanz.
    // Danach schickt Stripe irgendein Abo-Ereignis, und die Stripe-Zeile ist
    // die juengere. Mit `limit(1)` fiele der Kunde auf PRO zurueck, ohne dass
    // jemand etwas entzogen haette.
    const rows = [
      stripeRow("pro", "2026-08-09T12:00:00.000Z"),
      manualRow("premium", "2026-08-01T09:00:00.000Z")
    ];

    expect(pickEffectiveEntitlement(rows, options).plan).toBe("premium");
  });

  it("entscheidet unabhängig von der Reihenfolge der Zeilen", () => {
    const rows = [manualRow("premium", "2026-08-01T09:00:00.000Z"), stripeRow("pro", "2026-08-09T12:00:00.000Z")];

    expect(pickEffectiveEntitlement(rows, options).plan).toBe("premium");
    expect(pickEffectiveEntitlement([...rows].reverse(), options).plan).toBe("premium");
  });

  it("hält bei gleichem Tarif am Stripe-Eintrag fest", () => {
    // Sonst zeigte „Abo verwalten" auf eine manuelle Zeile ohne Kundenkonto bei
    // Stripe — der Kunde koennte sein eigenes Abo nicht mehr kuendigen.
    const rows = [stripeRow("pro", "2026-08-01T09:00:00.000Z"), manualRow("pro", "2026-08-09T12:00:00.000Z")];
    const resolved = pickEffectiveEntitlement(rows, options);

    expect(resolved.provider).toBe("stripe");
    expect(resolved.canManageBilling).toBe(true);
  });
});

describe("abgelaufene Einträge", () => {
  it("zählen nicht mit", () => {
    const rows = [stripeRow("pro", "2026-08-09T12:00:00.000Z"), manualRow("premium", "2026-08-01T09:00:00.000Z", past)];

    expect(pickEffectiveEntitlement(rows, options).plan).toBe("pro");
  });

  it("lassen ein Konto ohne gültigen Anspruch auf FREE fallen", () => {
    const rows = [manualRow("premium", "2026-08-01T09:00:00.000Z", past)];
    const resolved = pickEffectiveEntitlement(rows, options);

    expect(resolved.plan).toBe("free");
    expect(resolved.billingActive).toBe(false);
    expect(resolved.status).toBe("expired");
  });
});

describe("wenn nichts aktiv ist", () => {
  it("nennt den jüngsten Grund, nicht irgendeinen", () => {
    // Der Kunde bekommt eine Erklaerung zu sehen. „gekuendigt" statt
    // „Zahlung offen" waere die falsche und im Support die teurere Auskunft.
    const rows: EntitlementRow[] = [
      { plan: "pro", status: "canceled", provider: "manual", updated_at: "2026-07-01T09:00:00.000Z" },
      { plan: "pro", status: "past_due", provider: "stripe", updated_at: "2026-08-09T12:00:00.000Z" }
    ];

    expect(pickEffectiveEntitlement(rows, options).status).toBe("past_due");
  });
});

describe("Gegenprobe", () => {
  it("verschenkt keinen Tarif an ein Konto ohne aktiven Eintrag", () => {
    // Die Regel lautet „der staerkste **aktive** Anspruch". Ohne dieses Wort
    // wuerde eine gekuendigte PREMIUM-Zeile den Tarif weiter freihalten.
    const rows: EntitlementRow[] = [
      { plan: "premium", status: "canceled", provider: "stripe", valid_until: future, updated_at: "2026-08-01T09:00:00.000Z" },
      stripeRow("pro", "2026-08-09T12:00:00.000Z")
    ];

    expect(pickEffectiveEntitlement(rows, options).plan).toBe("pro");
  });
});
