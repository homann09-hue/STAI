import { describe, expect, it } from "vitest";
import { selectDashboardTickerItems } from "@/lib/dashboard-market-items";
import type { AssetSummary } from "@/lib/types";

function item(symbol: string): AssetSummary {
  return {
    asset: {
      symbol,
      name: symbol,
      type: "stock",
      exchange: "NASDAQ",
      currency: "USD",
      sector: "Test",
      description: "Provider fixture"
    },
    quote: {
      price: 100,
      change: 1,
      changePercent: 1,
      dayHigh: 101,
      dayLow: 99,
      volume: 1_000,
      delayedByMinutes: 15,
      asOf: "2026-08-10T12:00:00.000Z",
      provider: "Test Provider",
      quality: "delayed",
      latencyMs: 100,
      marketStatus: "unknown"
    },
    scores: { trend: 50, news: 50, fundamental: 50, technical: 50, risk: 50, total: 50 },
    aiRisk: "mittel"
  };
}

describe("selectDashboardTickerItems", () => {
  it("liefert nur Symbole aus Providerlisten und ergänzt keine statischen Indizes", () => {
    const result = selectDashboardTickerItems({
      watchlist: [item("AAPL")],
      mostActive: [item("MSFT")],
      trendingAssets: [],
      gainers: [],
      losers: []
    });

    expect(result.map((entry) => entry.asset.symbol)).toEqual(["AAPL", "MSFT"]);
    expect(result.map((entry) => entry.asset.symbol)).not.toContain("DAX");
    expect(result.map((entry) => entry.asset.symbol)).not.toContain("SPX");
  });

  it("dedupliziert Symbole stabil und respektiert das Limit", () => {
    const result = selectDashboardTickerItems({
      watchlist: [item("AAPL")],
      mostActive: [item("AAPL"), item("MSFT")],
      trendingAssets: [item("NVDA")],
      gainers: [],
      losers: []
    }, 2);

    expect(result.map((entry) => entry.asset.symbol)).toEqual(["AAPL", "MSFT"]);
  });

  it("bleibt leer, wenn der Provider keine Marktlisten liefert", () => {
    expect(selectDashboardTickerItems({
      watchlist: [],
      mostActive: [],
      trendingAssets: [],
      gainers: [],
      losers: []
    })).toEqual([]);
  });
});
