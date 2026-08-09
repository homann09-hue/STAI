import { describe, expect, it } from "vitest";
import { assessQuality, buildQualityScores } from "@/lib/analysis/quality-scores";

/**
 * §25 verlangt erklärbare Teilnoten statt einer magischen Zahl. Die Tests
 * prüfen deshalb weniger die Formeln als die Ehrlichkeitsregeln: dass eine
 * fehlende Kennzahl nicht zu einer Null wird, dass eine dünne Datenlage als
 * solche erscheint, und dass am Ende keine Gesamtnote steht, die die Teilnoten
 * verdeckt.
 */

const strong = {
  grossMargin: 0.62,
  operatingMargin: 0.31,
  netMargin: 0.25,
  revenueGrowth: 0.18,
  earningsGrowth: 0.22,
  currentRatio: 2.1,
  quickRatio: 1.4,
  equityRatio: 0.55,
  operatingCashFlow: 120,
  freeCashFlow: 90,
  netIncome: 100,
  debtToEquity: 0.3,
  netDebtToEbitda: 0.4,
  peRatio: 14,
  priceToSales: 2.5,
  evToEbitda: 9,
  returnOnEquity: 0.27,
  returnOnAssets: 0.13,
  returnOnInvestedCapital: 0.18
};

describe("fehlende Kennzahlen", () => {
  it("macht aus einer fehlenden Zahl keine Null", () => {
    // Der wichtigste Test der Datei: eine Null waere eine Wertung, kein Fehlen.
    const [profitability] = buildQualityScores({ grossMargin: 0.5 });
    const missing = profitability.components.filter((entry) => entry.value === null);

    expect(missing).toHaveLength(2);
    for (const entry of missing) {
      expect(entry.points).toBeNull();
      expect(entry.reason).toMatch(/liegt nicht vor/);
    }
  });

  it("bildet ohne jede Kennzahl gar keine Note", () => {
    const [profitability] = buildQualityScores({});

    expect(profitability.score).toBeNull();
    expect(profitability.reportable).toBe(false);
    expect(profitability.note).toMatch(/keine einzige Kennzahl/);
  });

  it("kennzeichnet eine Note aus zu wenigen Kennzahlen als nicht belastbar", () => {
    // Eine von drei ist ein Fragment, kein Urteil.
    const [profitability] = buildQualityScores({ grossMargin: 0.5 });

    expect(profitability.score).not.toBeNull();
    expect(profitability.reportable).toBe(false);
    expect(profitability.note).toMatch(/nicht belastbar/);
  });

  it("mittelt nur über die tatsächlich vorhandenen Kennzahlen", () => {
    // Wuerde ueber alle drei gemittelt, zoege eine fehlende Zahl die Note nach
    // unten -- und Datenmangel saehe aus wie ein schwaches Unternehmen.
    const [full] = buildQualityScores({ grossMargin: 0.62, operatingMargin: 0.31, netMargin: 0.25 });
    const [partial] = buildQualityScores({ grossMargin: 0.62 });

    expect(partial.coverage).toEqual({ available: 1, expected: 3 });
    expect(partial.score).toBeGreaterThan(50);
    expect(full.coverage.available).toBe(3);
  });
});

describe("Bewertung der Dimensionen", () => {
  it("gibt einem starken Unternehmen durchgehend hohe Teilnoten", () => {
    const dimensions = buildQualityScores(strong);

    for (const dimension of dimensions) {
      expect(dimension.reportable).toBe(true);
      expect(dimension.score).toBeGreaterThanOrEqual(60);
    }
  });

  it("dreht die Skala bei Verschuldung um", () => {
    // Weniger Schulden ist besser -- eine gerade Skala wuerde das Gegenteil
    // bewerten.
    const low = buildQualityScores({ debtToEquity: 0.2, netDebtToEbitda: 0.3 })[4];
    const high = buildQualityScores({ debtToEquity: 2.8, netDebtToEbitda: 4.5 })[4];

    expect(low.score).toBeGreaterThan(high.score ?? 100);
  });

  it("bewertet ein teures Unternehmen schlechter als ein günstiges", () => {
    const cheap = buildQualityScores({ peRatio: 9, priceToSales: 1.2, evToEbitda: 7 })[5];
    const pricey = buildQualityScores({ peRatio: 44, priceToSales: 11, evToEbitda: 24 })[5];

    expect(cheap.score).toBeGreaterThan(pricey.score ?? 100);
  });

  it("erkennt, wenn der Cashflow den ausgewiesenen Gewinn nicht deckt", () => {
    // Der Test der Ergebnisqualitaet: verdient das Unternehmen, was es
    // ausweist?
    const weak = buildQualityScores({ operatingCashFlow: 40, netIncome: 100, freeCashFlow: 5 })[3];
    const coverage = weak.components.find((entry) => entry.label === "Cashflow-Deckung des Gewinns");

    expect(coverage?.value).toBeCloseTo(0.4, 5);
    expect(coverage?.reason).toMatch(/nur zu/);
  });

  it("rechnet nicht mit einem Gewinn von null", () => {
    // Division durch null waere hier ein stiller Unendlichkeitswert.
    const noProfit = buildQualityScores({ operatingCashFlow: 40, netIncome: 0 })[3];
    const coverage = noProfit.components.find((entry) => entry.label === "Cashflow-Deckung des Gewinns");

    expect(coverage?.value).toBeNull();
  });

  it("nennt ein negatives KGV beim Namen statt es zu bewerten", () => {
    const valuation = buildQualityScores({ peRatio: -12 })[5];
    const pe = valuation.components.find((entry) => entry.label === "KGV");

    expect(pe?.reason).toMatch(/nicht profitabel/);
  });

  it("beschreibt schrumpfenden Umsatz als Schrumpfen", () => {
    const growth = buildQualityScores({ revenueGrowth: -0.12 })[1];
    expect(growth.components[0].reason).toMatch(/geschrumpft/);
  });
});

describe("assessQuality", () => {
  it("bildet keine Gesamtnote", () => {
    // Der Kern von §25: eine Gesamtnote wuerde die Teilnoten verstecken, und
    // genau die sind die Aussage.
    const assessment = assessQuality(strong);

    expect(assessment).not.toHaveProperty("overallScore");
    expect(assessment).not.toHaveProperty("score");
    expect(assessment.dimensions).toHaveLength(7);
  });

  it("nennt fehlende Kennzahlen namentlich", () => {
    const assessment = assessQuality({ grossMargin: 0.5 });

    expect(assessment.missing).toContain("Nettomarge");
    expect(assessment.missing).toContain("ROIC");
    expect(assessment.reportable).toBe(false);
  });

  it("erlaubt eine Aussage erst ab genug belastbaren Teilnoten", () => {
    expect(assessQuality(strong).reportable).toBe(true);
    expect(assessQuality({ grossMargin: 0.5, peRatio: 12 }).reportable).toBe(false);
  });

  it("weist auf die fehlende Branchenkalibrierung hin", () => {
    // Die Grenzwerte taugen fuer "auffaellig gut gegen auffaellig schwach",
    // nicht fuer eine Rangfolge auf zwei Nachkommastellen.
    expect(assessQuality(strong).disclaimer).toMatch(/ohne Branchenkalibrierung/);
    expect(assessQuality(strong).disclaimer).toMatch(/nicht geschätzt/);
  });
});
