import { describe, expect, it } from "vitest";
import { analyzePortfolio, applyPortfolioTrade } from "@/lib/portfolio-analytics";
import { getMockPortfolio } from "@/lib/mock/market";

describe("portfolio analytics", () => {
  it("calculates allocation, risk and scenarios", () => {
    const portfolio = getMockPortfolio();

    expect(portfolio.scenarios).toHaveLength(5);
    expect(portfolio.assetAllocation.length).toBeGreaterThan(0);
    expect(portfolio.totalRisk).toBeGreaterThanOrEqual(0);
  });

  it("applies buys and sells without negative quantities", () => {
    const initial = getMockPortfolio().positions;
    const withBuy = applyPortfolioTrade(initial, {
      symbol: "MSFT",
      side: "buy",
      assetType: "stock",
      sector: "Software / Cloud",
      quantity: 2,
      price: 500,
      currency: "USD",
      riskScore: 45
    });
    const withSell = applyPortfolioTrade(withBuy, {
      symbol: "MSFT",
      side: "sell",
      assetType: "stock",
      sector: "Software / Cloud",
      quantity: 10,
      price: 500,
      currency: "USD",
      riskScore: 45
    });

    expect(analyzePortfolio(withBuy).positions.some((item) => item.symbol === "MSFT")).toBe(true);
    expect(withSell.find((item) => item.symbol === "MSFT")?.quantity).toBe(2);
  });
});
