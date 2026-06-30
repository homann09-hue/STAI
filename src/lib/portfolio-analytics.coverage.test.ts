import { describe, expect, it, vi } from "vitest";
import { analyzePortfolio, applyPortfolioTrade } from "./portfolio-analytics";

describe("portfolio analytics branch coverage", () => {
  it("handles empty portfolios without divide-by-zero warnings", () => {
    const summary = analyzePortfolio([]);

    expect(summary.totalValue).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.totalPnLPercent).toBe(0);
    expect(summary.totalRisk).toBe(0);
    expect(summary.maxPositionWeight).toBe(0);
    expect(summary.cryptoWeight).toBe(0);
    expect(summary.warnings).toEqual([]);
    expect(summary.scenarios).toHaveLength(5);
  });

  it("raises concentration, crypto, risk and diversification warnings at severity bands", () => {
    const highRisk = analyzePortfolio([
      position("AI1", "stock", "AI", 60, 100, 60, 100, 92),
      position("BTC", "crypto", "Digital Assets", 35, 100, 35, 100, 95),
      position("BOND", "etf", "Bonds", 5, 100, 5, 100, 20)
    ]);

    expect(highRisk.warnings.map((warning) => warning.id)).toEqual(
      expect.arrayContaining(["concentration", "crypto-weight", "portfolio-risk", "diversification"])
    );
    expect(highRisk.warnings.find((warning) => warning.id === "concentration")?.severity).toBe("hoch");
    expect(highRisk.warnings.find((warning) => warning.id === "crypto-weight")?.severity).toBe("mittel");
    expect(highRisk.warnings.find((warning) => warning.id === "portfolio-risk")?.severity).toBe("hoch");
    expect(highRisk.diversificationScore).toBeLessThan(55);
    expect(highRisk.sectorAllocation[0].weight).toBeGreaterThanOrEqual(highRisk.sectorAllocation[1].weight);
    expect(highRisk.assetAllocation[0].weight).toBeGreaterThanOrEqual(highRisk.assetAllocation[1].weight);

    const mediumConcentration = analyzePortfolio([
      position("A", "stock", "Tech", 40, 100, 40, 100, 40),
      position("B", "etf", "World", 60, 100, 60, 100, 40)
    ]);

    expect(mediumConcentration.warnings.find((warning) => warning.id === "concentration")?.severity).toBe("hoch");
  });

  it("applies buy and sell trades including local creation and zero-quantity cleanup", () => {
    vi.setSystemTime(new Date("2026-06-30T10:00:00.000Z"));

    const initial = [position("NVDA", "stock", "AI", 10, 100, 10, 120, 70)];
    expect(applyPortfolioTrade(initial, trade("MSFT", "sell", 1, 200))).toBe(initial);

    const withNew = applyPortfolioTrade(initial, trade("MSFT", "buy", 2, 200, undefined));
    expect(withNew).toHaveLength(2);
    expect(withNew[1]).toMatchObject({
      id: "local-1782813600000",
      name: "MSFT Position",
      quantity: 2,
      averagePrice: 200,
      currentPrice: 200
    });

    const averaged = applyPortfolioTrade(withNew, trade("NVDA", "buy", 10, 140, "NVIDIA"));
    expect(averaged.find((item) => item.symbol === "NVDA")).toMatchObject({
      quantity: 20,
      averagePrice: 120,
      currentPrice: 140,
      riskScore: 55
    });

    const reduced = applyPortfolioTrade(averaged, trade("NVDA", "sell", 5, 130));
    expect(reduced.find((item) => item.symbol === "NVDA")?.quantity).toBe(15);

    const removed = applyPortfolioTrade(reduced, trade("NVDA", "sell", 99, 130));
    expect(removed.some((item) => item.symbol === "NVDA")).toBe(false);

    vi.useRealTimers();
  });
});

function position(
  symbol: string,
  assetType: "stock" | "etf" | "crypto",
  sector: string,
  quantity: number,
  averagePrice: number,
  currentQuantity: number,
  currentPrice: number,
  riskScore: number
) {
  return {
    id: symbol,
    symbol,
    name: `${symbol} Corp`,
    assetType,
    sector,
    quantity: currentQuantity || quantity,
    averagePrice,
    currentPrice,
    currency: "USD",
    riskScore
  };
}

function trade(symbol: string, side: "buy" | "sell", quantity: number, price: number, name?: string) {
  return {
    symbol,
    name,
    side,
    assetType: "stock" as const,
    sector: "Software",
    quantity,
    price,
    currency: "USD",
    riskScore: 55
  };
}
