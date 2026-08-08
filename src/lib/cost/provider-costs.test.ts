import { describe, expect, it } from "vitest";
import {
  assessMargin,
  formatTenthCents,
  monthlyRevenueTenthCents,
  providerCostModels,
  summarizeCost
} from "@/lib/cost/provider-costs";
import { pricingTiers } from "@/lib/feature-gates";

/**
 * §7 stellt eine wirtschaftliche Frage, keine technische: verdient ein Tarif
 * seine Datenkosten? Die Tests halten fest, dass die Antwort ehrlich bleibt —
 * besonders dort, wo eine geschönte Zahl bequem wäre.
 */

describe("providerCostModels", () => {
  it("nennt für jede Quelle eine Herleitung", () => {
    // Eine Kostenzahl ohne Beleg ist eine Behauptung.
    for (const model of Object.values(providerCostModels)) {
      expect(model.basis.length).toBeGreaterThan(30);
      expect(Number.isSafeInteger(model.costPerCallTenthCents)).toBe(true);
      expect(model.costPerCallTenthCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("führt die EZB mit null Kosten", () => {
    expect(providerCostModels.ecb.costPerCallTenthCents).toBe(0);
  });
});

describe("summarizeCost", () => {
  it("berechnet Kosten nur für Abrufe, die den Anbieter erreicht haben", () => {
    const summary = summarizeCost([{ provider: "fmp", fetches: 100, cacheHits: 900 }]);

    expect(summary.fetches).toBe(100);
    expect(summary.requests).toBe(1_000);
    expect(summary.totalTenthCents).toBe(100);
    expect(summary.cacheHitRate).toBeCloseTo(0.9, 5);
  });

  it("weist aus, was der Cache erspart hat", () => {
    const summary = summarizeCost([{ provider: "ai_model", fetches: 10, cacheHits: 40 }]);

    expect(summary.totalTenthCents).toBe(200);
    expect(summary.savedByCacheTenthCents).toBe(800);
  });

  it("meldet ohne Anfragen keine Trefferquote", () => {
    // 100 % waere hier Schoenfaerberei: gemessen wurde nichts.
    expect(summarizeCost([]).cacheHitRate).toBeNull();
    expect(summarizeCost([{ provider: "fmp", fetches: 0, cacheHits: 0 }]).cacheHitRate).toBeNull();
  });

  it("verrechnet kostenlose Quellen mit null", () => {
    const summary = summarizeCost([{ provider: "ecb", fetches: 5_000, cacheHits: 0 }]);
    expect(summary.totalTenthCents).toBe(0);
  });

  it("verträgt unsaubere Zahlen ohne negative Kosten", () => {
    const summary = summarizeCost([{ provider: "fmp", fetches: -20, cacheHits: -5 }]);
    expect(summary.totalTenthCents).toBe(0);
    expect(summary.requests).toBe(0);
  });
});

describe("monthlyRevenueTenthCents", () => {
  it("liest den Ertrag aus der Preisangabe des Tarifs", () => {
    expect(monthlyRevenueTenthCents("free")).toBe(0);
    expect(monthlyRevenueTenthCents("pro")).toBe(29_990);
    expect(monthlyRevenueTenthCents("premium")).toBe(69_990);
  });

  it("bleibt an die Preisseite gebunden", () => {
    // Wenn der Preis dort steigt, muss die Margenrechnung mitziehen.
    for (const tier of pricingTiers) {
      const revenue = monthlyRevenueTenthCents(tier.id);
      expect(Number.isSafeInteger(revenue)).toBe(true);
      expect(revenue).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("assessMargin", () => {
  it("nennt ein defizitäres Konto beim Namen", () => {
    // Pro bringt 29,99 EUR, also 29.990 Zehntel-Cent. 40 EUR Datenkosten sind
    // ein Verlust, und das muss die Antwort aussprechen -- nicht als "erhoehte
    // Auslastung" verpacken.
    const margin = assessMargin("pro", 40_000);

    expect(margin.verdict).toBe("loss_making");
    expect(margin.marginTenthCents).toBeLessThan(0);
    expect(margin.message).toMatch(/kostet mehr, als es einbringt/);
  });

  it("wertet den Free-Tarif nicht als verlustbringend", () => {
    // Free ist bewusst defizitaer. Wuerde es als Verlust gemeldet, waere die
    // Liste voller Eintraege, auf die niemand reagieren kann.
    const margin = assessMargin("free", 500);

    expect(margin.verdict).toBe("no_revenue");
    expect(margin.costRatio).toBeNull();
    expect(margin.message).toMatch(/bewusst defizitär/);
  });

  it("unterscheidet tragfähig von beobachtenswert", () => {
    expect(assessMargin("pro", 1_000).verdict).toBe("healthy");
    // Ein Drittel des Ertrags fuer Daten ist noch tragfaehig, aber kein
    // Zustand, den man unbeobachtet lassen sollte.
    expect(assessMargin("pro", 12_000).verdict).toBe("watch");
  });

  it("nennt bei gesunder Marge den Kostenanteil statt einer Beruhigung", () => {
    const margin = assessMargin("premium", 6_999);
    expect(margin.message).toMatch(/10 % des Ertrags/);
  });

  it("rechnet nicht mit negativen Kosten", () => {
    expect(assessMargin("pro", -500).costTenthCents).toBe(0);
  });
});

describe("formatTenthCents", () => {
  it("stellt Zehntel-Cent als Betrag dar", () => {
    expect(formatTenthCents(29_990)).toMatch(/29,99/);
    expect(formatTenthCents(1)).toMatch(/0,001/);
  });
});
