import { describe, expect, it } from "vitest";
import {
  assetSummaries,
  getMockAsset,
  getMockDashboard,
  getMockNews,
  getMockPortfolio,
  mockAlerts
} from "./market";

describe("mock market data coverage", () => {
  it("builds complete details for every supported mock asset", () => {
    expect(assetSummaries.map((summary) => summary.asset.symbol)).toEqual([
      "NVDA",
      "AAPL",
      "MSFT",
      "VOO",
      "BTC-USD",
      "ETH-USD"
    ]);

    for (const summary of assetSummaries) {
      const detail = getMockAsset(summary.asset.symbol.toLowerCase());
      expect(detail).not.toBeNull();
      if (!detail) throw new Error(`Missing mock detail for ${summary.asset.symbol}`);

      expect(detail.quote.quality).toBe("mock");
      expect(detail.dataQuality.score).toBeGreaterThan(0);
      expect(detail.professionalScores.probabilityUp).toBeGreaterThanOrEqual(5);
      expect(
        detail.professionalScores.probabilityUp +
          detail.professionalScores.probabilityDown +
          detail.professionalScores.probabilitySideways
      ).toBe(100);
      expect(Object.keys(detail.candles)).toEqual(
        expect.arrayContaining(["1D", "5D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"])
      );
      expect(detail.riskReport).toBeTruthy();
      expect(detail.analysisLayers.length).toBe(4);
      expect(detail.macroFactors.length).toBe(2);
      expect(detail.aiAnalysis.sources).toContain("StockPilot Mock Market Feed");
    }
  });

  it("separates stocks, ETFs, crypto and unknown symbols safely", () => {
    expect(getMockAsset("unknown")).toBeNull();

    const stock = getMockAsset("NVDA");
    const etf = getMockAsset("VOO");
    const crypto = getMockAsset("BTC-USD");

    expect(stock?.analystOpinion?.count).toBe(34);
    expect(stock?.insiderActivity).toHaveLength(1);
    expect(stock?.earningsDate).toBe("2026-07-29");
    expect(etf?.analystOpinion?.count).toBe(8);
    expect(etf?.insiderActivity).toHaveLength(0);
    expect(crypto?.analystOpinion).toBeNull();
    expect(crypto?.earningsDate).toBeNull();
  });

  it("returns sorted dashboard, news, portfolio and alert mock surfaces", () => {
    const dashboard = getMockDashboard();

    expect(dashboard.watchlist).toHaveLength(5);
    expect(dashboard.gainers[0].asset.symbol).toBe("NVDA");
    expect(dashboard.losers.map((item) => item.asset.symbol)).toEqual(["ETH-USD", "AAPL"]);
    expect(dashboard.mostActive[0]?.quote.volume ?? 0).toBeGreaterThanOrEqual(
      dashboard.mostActive[1]?.quote.volume ?? 0
    );
    expect(dashboard.trendingAssets[0]?.professionalScores?.momentum ?? 0).toBeGreaterThanOrEqual(
      dashboard.trendingAssets[1]?.professionalScores?.momentum ?? 0
    );
    expect(dashboard.dataQualitySummary.mockSources).toBeGreaterThan(0);
    expect(dashboard.aiSentiment.summary).toContain("Momentum");
    expect(dashboard.riskWarnings).toHaveLength(2);

    expect(getMockNews()).toHaveLength(5);
    const nvdaNews = getMockNews("nvda")[0];
    expect(nvdaNews).toBeDefined();
    if (!nvdaNews) throw new Error("Missing NVDA news");
    expect(nvdaNews).toMatchObject({ symbol: "NVDA", sentiment: "positive" });
    expect(getMockNews("unknown")).toEqual([]);

    const portfolio = getMockPortfolio();
    expect(portfolio.positions.map((position) => position.symbol)).toEqual(["NVDA", "VOO", "BTC-USD"]);
    expect(portfolio.totalValue).toBeGreaterThan(0);
    expect(portfolio.positions.every((position) => position.riskScore > 0)).toBe(true);

    expect(mockAlerts.map((alert) => alert.type)).toEqual([
      "price",
      "volume",
      "ai-risk",
      "earnings",
      "ai-shift",
      "portfolio-risk"
    ]);
  });
});
