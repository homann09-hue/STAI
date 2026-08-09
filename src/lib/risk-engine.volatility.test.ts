import { describe, expect, it } from "vitest";
import { buildRiskReport } from "@/lib/risk-engine";
import { calculateVolatility } from "@/lib/scoring";
import { NO_INDICATORS } from "@/lib/analysis/technical";
import type { Candle } from "@/lib/types";

/**
 * Die Volatilitätsschwelle stand auf `4.5` und konnte **nie** auslösen.
 *
 * `calculateVolatility` liefert die durchschnittliche absolute Tagesbewegung in
 * Prozent. Am 2026-08-09 über je ein Jahr gemessen: S&P-500-ETF 0,62 %, Apple
 * 1,12 %, Bitcoin 1,61 %, Tesla 2,26 %, Dogecoin 2,72 %, Coinbase 3,24 %. Eine
 * Schwelle bei 4,5 hätte selbst Dogecoin für ruhig gehalten.
 *
 * Derselbe Fehler wie bei `relevance >= 70`: gegen die erzeugten Sinus-Kerzen
 * kalibriert, gestorben in dem Moment, in dem echte Kurse kamen.
 *
 * Der wichtigste Test hier ist deshalb nicht „löst bei X aus", sondern
 * **„ist überhaupt erreichbar"**.
 */

/** Kerzen, die sich jeden Tag um `movePercent` bewegen — abwechselnd auf und ab. */
function candlesWithDailyMove(movePercent: number, count = 30): Candle[] {
  let close = 100;

  return Array.from({ length: count }, (_, index) => {
    if (index > 0) close *= 1 + (index % 2 === 0 ? movePercent : -movePercent) / 100;
    return {
      symbol: "TEST",
      range: "1M" as const,
      timestamp: new Date(Date.UTC(2026, 0, 1) + index * 86_400_000).toISOString(),
      time: `2026-01-${String(index + 1).padStart(2, "0")}`,
      open: close,
      high: close,
      low: close,
      close,
      volume: 50_000_000
    };
  });
}

function report(movePercent: number, volatilityRisk = 50) {
  const candles = candlesWithDailyMove(movePercent);

  return buildRiskReport(
    {
      asset: { symbol: "TEST", name: "Test", type: "stock", sector: "Tech", currency: "USD", exchange: "X" },
      quote: {
        symbol: "TEST",
        price: candles[candles.length - 1].close,
        change: 0,
        changePercent: 0,
        volume: 50_000_000,
        marketCap: 1_000_000_000,
        dayHigh: 0,
        dayLow: 0,
        previousClose: 0,
        asOf: "2026-01-30T00:00:00.000Z",
        provider: "Test",
        quality: "delayed",
        marketStatus: "closed"
      },
      candles: { "1M": candles } as never,
      // NO_INDICATORS statt eines leeren Objekts: die Engine liest
      // `indicators.support[0]`, und ein Fixture ohne dieses Feld prueft nur
      // meinen eigenen Tippfehler.
      indicators: NO_INDICATORS,
      news: [],
      earningsDate: null,
      professionalScores: { volatilityRisk } as never,
      analysisLayers: [],
      macroFactors: []
    } as never,
    { score: 80, sufficientForAnalysis: true, issues: [], warnings: [] } as never
  );
}

const volatilityFinding = (movePercent: number, volatilityRisk = 50) =>
  report(movePercent, volatilityRisk).findings.find((entry) => entry.id === "volatility-high");

describe("Die Schwelle ist erreichbar", () => {
  it("löst bei einem real vorkommenden Wert aus", () => {
    // Coinbase lag am 2026-08-09 bei 3,24 % -- ein Wert, den es wirklich gibt.
    // Mit der alten Schwelle 4,5 waere hier nichts passiert.
    expect(volatilityFinding(3.24)).toBeDefined();
  });

  it("löst bei Dogecoin-Niveau aus", () => {
    expect(volatilityFinding(2.72)).toBeDefined();
  });

  it("bleibt bei einem breiten Index still", () => {
    // Ein S&P-500-ETF ist nicht volatil. Wuerde er ausloesen, waere die Warnung
    // wertlos, weil sie ueberall stuende.
    expect(volatilityFinding(0.62)).toBeUndefined();
  });

  it("bleibt bei Apple und Bitcoin still", () => {
    expect(volatilityFinding(1.12)).toBeUndefined();
    expect(volatilityFinding(1.61)).toBeUndefined();
  });

  it("bleibt bei Tesla still — knapp, und das ist Absicht", () => {
    // Tesla lag bei 2,26 %. Die Schwelle liegt oberhalb des dritten Quartils
    // der Messung; Tesla ist volatil, aber nicht auffaellig fuer eine Aktie.
    expect(volatilityFinding(2.26)).toBeUndefined();
  });
});

describe("Die Eskalation trennt hoch von extrem", () => {
  it("nennt 3 % hoch, nicht extrem", () => {
    expect(volatilityFinding(3)?.severity).toBe("hoch");
    expect(volatilityFinding(3)?.title).toMatch(/Erhöhte Volatilität/);
  });

  it("nennt 6 % extrem", () => {
    expect(volatilityFinding(6)?.severity).toBe("extrem");
    expect(volatilityFinding(6)?.title).toMatch(/Außergewöhnlich/);
  });

  it("sperrt bei extrem die Analyse", () => {
    expect(report(6).blockedAnalysis).toBe(true);
  });
});

describe("Der Befund trägt seinen Maßstab", () => {
  it("nennt den gemessenen Wert und Vergleichswerte", () => {
    // "Erhoehte Volatilitaet" ohne Vergleich ist eine Behauptung ohne Massstab.
    const evidence = volatilityFinding(3.24)?.evidence ?? "";

    expect(evidence).toMatch(/3,24|3\.24/);
    expect(evidence).toMatch(/Apple/);
    expect(evidence).toMatch(/Bitcoin/);
  });
});

describe("Der zweite Auslöser bleibt bestehen", () => {
  it("löst auch über den Volatilitätsscore aus", () => {
    // Ein ruhiges Instrument mit hohem Score aus anderer Quelle soll weiter
    // ausloesen -- die Kursbewegung ist nicht der einzige Weg.
    expect(volatilityFinding(0.5, 85)).toBeDefined();
    expect(volatilityFinding(0.5, 50)).toBeUndefined();
  });
});

describe("Die Messfunktion selbst", () => {
  it("liefert die durchschnittliche Tagesbewegung in Prozent", () => {
    // Die Zusicherung, auf der alle Schwellen oben ruhen. Ohne sie waere die
    // naechste Kalibrierung wieder Raten.
    expect(calculateVolatility(candlesWithDailyMove(2))).toBeCloseTo(2, 1);
    expect(calculateVolatility(candlesWithDailyMove(0.5))).toBeCloseTo(0.5, 1);
  });
});
