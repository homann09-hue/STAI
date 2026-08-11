import { describe, expect, it } from "vitest";

import { getProfessionalDataProvider } from "@/lib/providers/professional-data-provider";

describe("professional data honesty", () => {
  it("liefert ohne authentifiziertes Nutzerportfolio keine Demo-Kennzahlen", async () => {
    const portfolio = await getProfessionalDataProvider().getProfessionalPortfolio();
    const points = [
      portfolio.totalValue,
      portfolio.dayPnL,
      portfolio.totalPnL,
      portfolio.performanceSincePurchase,
      portfolio.costBasis,
      portfolio.currencyRisk,
      portfolio.dividendForecast,
      portfolio.riskScore,
      portfolio.volatility,
      portfolio.drawdown,
      portfolio.concentrationRisk
    ];

    expect(portfolio.quality).toBe("unavailable");
    expect(portfolio.scenarioAnalysis).toEqual([]);
    expect(points.every((point) => point.value === null && point.quality === "unavailable")).toBe(true);
  });
});
