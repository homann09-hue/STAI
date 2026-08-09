import { describe, expect, it } from "vitest";
import { formatEuroCents, summarizeRecurringRevenue, type SubscriptionRecord } from "@/lib/billing/revenue";
import { getMonthlyRevenueCents, getPricingTier, pricingTiers } from "@/lib/feature-gates";

/**
 * Die Tests halten die Umsatzzahl an der Stelle fest, an der sie am leichtesten
 * zu schön wird: bei allem, was nach Abo aussieht, aber kein Geld bringt.
 */

const stripe = (plan: "pro" | "premium", status: string, interval: "month" | "year" | null = "month") =>
  ({ plan, status, provider: "stripe", interval }) satisfies SubscriptionRecord;

describe("Was in die MRR gehört", () => {
  it("zählt bezahlte Monatsabos", () => {
    const result = summarizeRecurringRevenue([stripe("pro", "active"), stripe("premium", "active")]);

    expect(result.mrrCents).toBe(2999 + 6999);
    expect(result.payingAccounts).toBe(2);
  });

  it("rechnet ein Jahresabo auf den Monat herunter", () => {
    // Der Fehler, der hier naheliegt: 299,90 € in den Monat schreiben. Das
    // waere das Zwoelffache des tatsaechlichen Monatsbeitrags.
    const result = summarizeRecurringRevenue([stripe("pro", "active", "year")]);

    expect(result.mrrCents).toBe(Math.round(29990 / 12));
    expect(result.mrrCents).toBeLessThan(2999);
  });

  it("schreibt ARR als Zwölffaches der MRR fort", () => {
    const result = summarizeRecurringRevenue([stripe("premium", "active")]);

    expect(result.arrCents).toBe(result.mrrCents * 12);
  });
});

describe("Was nicht in die MRR gehört", () => {
  it("lässt manuelle Freischaltungen draußen", () => {
    // Der wichtigste Test hier. Eine Kulanz-Freischaltung ist echter Zugang und
    // echte Providerkosten -- aber null Euro Umsatz. Sie mitzuzaehlen hiesse,
    // sich die eigenen Zahlen zu faelschen.
    const result = summarizeRecurringRevenue([
      { plan: "premium", status: "active", provider: "manual", interval: null }
    ]);

    expect(result.mrrCents).toBe(0);
    expect(result.payingAccounts).toBe(0);
    expect(result.compedAccounts).toBe(1);
  });

  it("lässt Testzeiträume draußen", () => {
    const result = summarizeRecurringRevenue([stripe("pro", "trialing")]);

    expect(result.mrrCents).toBe(0);
    expect(result.trialingAccounts).toBe(1);
  });

  it("lässt offene Zahlungen draußen, weist sie aber aus", () => {
    // `past_due` heisst: das Abo besteht, das Geld kam nicht. In der MRR waere
    // es eine Einnahme, die niemand erhalten hat.
    const result = summarizeRecurringRevenue([stripe("pro", "past_due"), stripe("premium", "unpaid")]);

    expect(result.mrrCents).toBe(0);
    expect(result.atRiskAccounts).toBe(2);
    expect(result.atRiskCents).toBe(2999 + 6999);
  });

  it("lässt gekündigte und abgelaufene Abos draußen", () => {
    const result = summarizeRecurringRevenue([stripe("pro", "canceled"), stripe("premium", "expired")]);

    expect(result.mrrCents).toBe(0);
    expect(result.payingAccounts).toBe(0);
    expect(result.atRiskAccounts).toBe(0);
  });

  it("lässt FREE-Konten draußen", () => {
    const result = summarizeRecurringRevenue([
      { plan: "free", status: "active", provider: "stripe", interval: "month" }
    ]);

    expect(result.mrrCents).toBe(0);
  });
});

describe("Abos ohne zuzuordnenden Preis", () => {
  it("werden nicht geschätzt, sondern ausgewiesen", () => {
    // Eine alte Preis-ID, die keine Umgebungsvariable mehr nennt. Sie als
    // Monatsabo zu zaehlen waere eine erfundene Zahl; sie stillschweigend zu
    // verwerfen waere ein verschwundener Kunde. Also: gezaehlt, aber getrennt.
    const result = summarizeRecurringRevenue([stripe("pro", "active", null)]);

    expect(result.mrrCents).toBe(0);
    expect(result.payingAccounts).toBe(0);
    expect(result.unpricedAccounts).toBe(1);
  });
});

describe("Anzeigepreis und Betrag dürfen nicht auseinanderlaufen", () => {
  it.each(pricingTiers.map((tier) => tier.id))("stimmen bei %s überein", (planId) => {
    // Der Anzeigetext gehoert der Oberflaeche, der Betrag der Rechnung. Genau
    // deshalb koennen sie auseinanderlaufen -- eine Preisaenderung im Marketing
    // ohne Nachziehen der Cent-Zahl faellt sonst niemandem auf, und die MRR
    // waere ab da still falsch.
    const { pricing } = getPricingTier(planId);
    const fromText = (text: string | null) => {
      const match = text?.match(/([\d.]+),(\d{2})\s*€/);
      if (!match) return null;
      return Number(match[1].replace(/\./g, "")) * 100 + Number(match[2]);
    };

    if (pricing.monthlyCents && pricing.monthlyCents > 0) {
      expect(fromText(pricing.monthly)).toBe(pricing.monthlyCents);
    }
    if (pricing.yearlyCents !== null) {
      expect(fromText(pricing.yearly)).toBe(pricing.yearlyCents);
    }
  });

  it("nennt für das Jahresabo wirklich zehn Monatsbeiträge", () => {
    // Die Verkaufsseite verspricht „zwei Monate guenstiger". Wenn der Betrag
    // das nicht hergibt, ist die Aussage falsch -- und zwar in einem Text, der
    // zum Kaufvertrag gehoert.
    for (const planId of ["pro", "premium"] as const) {
      const { monthlyCents, yearlyCents } = getPricingTier(planId).pricing;
      expect(yearlyCents).toBe(monthlyCents! * 10);
    }
  });
});

describe("Der Monatsbetrag je Tarif", () => {
  it("gibt für FREE null zurück, nicht null-und-unbekannt", () => {
    expect(getMonthlyRevenueCents("free", "month")).toBe(0);
  });

  it("meldet ein fehlendes Jahresabo als nicht bezifferbar", () => {
    expect(getMonthlyRevenueCents("free", "year")).toBeNull();
  });
});

describe("Darstellung", () => {
  it("schreibt Beträge in Euro mit deutschem Format", () => {
    expect(formatEuroCents(2999)).toMatch(/29,99/);
    expect(formatEuroCents(0)).toMatch(/0,00/);
  });
});
