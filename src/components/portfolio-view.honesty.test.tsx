// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzePortfolio } from "@/lib/portfolio-analytics";
import type { PortfolioPosition } from "@/lib/types";

/**
 * Zwei Zahlen auf der Portfolioseite sahen aus, als hätte StockPilot sie
 * berechnet:
 *
 * - **„Gesamtrisiko 55/100"** war die Summe der Zahlen, die der Nutzer selbst
 *   je Position eingetragen hatte — Vorgabewert 55.
 * - **„Szenarioanalyse"** war `Depotwert × (1 + Schock)` für feste
 *   Prozentsätze. Jede Position bewegt sich dabei gleich.
 *
 * Beide sind brauchbar. Beide trugen einen Namen, der mehr versprach als die
 * Rechnung leistet.
 */

const portfolioSource = readFileSync(join(process.cwd(), "src/components/portfolio-view.tsx"), "utf8");
const panelsSource = readFileSync(join(process.cwd(), "src/components/analysis-panels.tsx"), "utf8");

function position(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    id: "p1",
    symbol: "AAPL",
    name: "Apple",
    assetType: "stock",
    sector: "Technology",
    quantity: 10,
    averagePrice: 100,
    currentPrice: 120,
    currency: "EUR",
    riskScore: 55,
    ...overrides
  };
}

describe("Die Risikozahl gibt sich als Selbsteinschätzung zu erkennen", () => {
  it("heißt nicht mehr schlicht „Gesamtrisiko“", () => {
    expect(portfolioSource).not.toMatch(/>Gesamtrisiko</);
    expect(portfolioSource).toMatch(/Ihre Risikoeinschätzung, gewichtet/);
  });

  it("sagt darunter, woher der Wert kommt", () => {
    expect(portfolioSource).toMatch(/Aus Ihren eigenen Angaben je Position/);
  });

  it("nennt auch das Eingabefeld als Einschätzung", () => {
    expect(portfolioSource).toMatch(/Ihre Risikoeinschätzung 0-100/);
  });
});

describe("Der Schock heißt nicht mehr Szenarioanalyse", () => {
  it("trägt den Namen seiner Rechnung", () => {
    expect(panelsSource).not.toMatch(/>Szenarioanalyse</);
    expect(panelsSource).toMatch(/Gleichmäßiger Schock auf das Depot/);
  });

  it("nennt die Annahme, die er macht", () => {
    // Ohne diesen Satz haelt ein Nutzer die Zeile fuer eine Aussage ueber
    // *sein* Depot statt ueber jedes beliebige.
    expect(panelsSource).toMatch(/Korrelationen, Beta und Assetklassen bleiben unberücksichtigt/);
  });

  it("rechnet nachweislich für jedes Depot gleich", () => {
    // Der Beleg fuer den Satz oben: zwei voellig verschiedene Depots gleichen
    // Werts ergeben dieselbe Zeile. Genau deshalb ist "Szenarioanalyse" der
    // falsche Name.
    const anleihen = analyzePortfolio([position({ symbol: "AGGH", assetType: "etf", riskScore: 12 })]);
    const krypto = analyzePortfolio([position({ symbol: "BTC-USD", assetType: "crypto", riskScore: 95 })]);

    const shock = (summary: ReturnType<typeof analyzePortfolio>) =>
      summary.scenarios.find((entry) => entry.shockPercent === -20)?.estimatedValue;

    expect(shock(anleihen)).toBe(shock(krypto));
  });
});
