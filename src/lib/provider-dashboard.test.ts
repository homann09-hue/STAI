import { describe, expect, it } from "vitest";
import { buildVerifiedProviderDashboard } from "@/lib/provider-dashboard";
import type { AssetSummary } from "@/lib/types";

function summary(symbol: string, changePercent: number, quality: AssetSummary["quote"]["quality"]): AssetSummary {
  return {
    asset: {
      symbol,
      name: symbol,
      type: "stock",
      exchange: "NASDAQ",
      currency: "USD",
      sector: "Technologie",
      description: "Providerdaten"
    },
    quote: {
      price: 100,
      change: changePercent,
      changePercent,
      dayHigh: 101,
      dayLow: 99,
      volume: 1_000_000,
      delayedByMinutes: quality === "delayed" ? 15 : 0,
      asOf: new Date().toISOString(),
      provider: "FMP",
      quality,
      marketStatus: "open"
    },
    scores: { trend: 50, news: 50, fundamental: 50, technical: 50, risk: 50, total: 50 },
    aiRisk: "mittel"
  };
}

describe("Provider-Dashboard ohne Demo-Leak", () => {
  it("entfernt Mock- und nicht verfuegbare Kurse vollstaendig", () => {
    const dashboard = buildVerifiedProviderDashboard([
      summary("REAL", 1.2, "delayed"),
      summary("DEMO", 8, "mock"),
      summary("NONE", -4, "unavailable")
    ], "FMP");

    expect(dashboard.gainers.map((item) => item.asset.symbol)).toEqual(["REAL"]);
    expect(dashboard.dataQualitySummary.mockSources).toBe(0);
    expect(JSON.stringify(dashboard)).not.toContain("DEMO");
  });

  it("erzeugt ohne verifizierte Kurse einen ehrlichen Leerzustand", () => {
    const dashboard = buildVerifiedProviderDashboard([], "Kein Provider");
    expect(dashboard.gainers).toEqual([]);
    expect(dashboard.marketOverview).toEqual([]);
    expect(dashboard.aiSentiment.score).toBe(0);
    expect(dashboard.trends[0]).toMatch(/keine verifizierten/i);
  });
});
