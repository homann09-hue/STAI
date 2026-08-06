import { describe, expect, it } from "vitest";
import { buildMarketCoverageIntelligenceReport } from "./market-coverage-intelligence";
import type { MarketUniverseCoverage, MarketUniverseInstrument } from "./types";

const coverage: MarketUniverseCoverage[] = [
  {
    label: "Krypto Spot",
    assetClasses: ["crypto"],
    exchanges: ["Binance", "Coinbase"],
    providerCandidates: ["Binance", "Coinbase"],
    status: "connected",
    note: "Krypto Public Provider vorbereitet."
  },
  {
    label: "US Aktien & ETFs",
    assetClasses: ["stock", "etf"],
    exchanges: ["NYSE", "NASDAQ"],
    providerCandidates: ["FMP", "Finnhub"],
    status: "license_required",
    note: "Lizenz erforderlich."
  }
];

function instrument(input: Partial<MarketUniverseInstrument> & Pick<MarketUniverseInstrument, "symbol" | "assetClass">): MarketUniverseInstrument {
  return {
    symbol: input.symbol,
    name: input.name ?? input.symbol,
    assetClass: input.assetClass,
    exchange: input.exchange ?? "NASDAQ",
    country: input.country ?? "USA",
    currency: input.currency ?? "USD",
    provider: input.provider ?? "Test Provider",
    quality: input.quality ?? "near_realtime",
    quoteQuality: input.quoteQuality ?? "near_realtime",
    coverage: input.coverage ?? "available",
    subscribable: input.subscribable ?? true,
    lastUpdatedAt: input.lastUpdatedAt ?? "2026-08-06T12:00:00.000Z",
    note: input.note ?? "Testinstrument",
    resolutionStatus: input.resolutionStatus ?? "resolved",
    analysisReadiness: input.analysisReadiness ?? "ready",
    identityConfidence: input.identityConfidence ?? 94
  };
}

describe("market coverage intelligence", () => {
  it("treats mock instruments as blocked for truth and priorities", () => {
    const report = buildMarketCoverageIntelligenceReport([
      instrument({ symbol: "AAPL", assetClass: "stock", quoteQuality: "mock", quality: "mock", coverage: "available" }),
      instrument({ symbol: "BTC-USD", assetClass: "crypto" })
    ], coverage, new Date("2026-08-06T12:00:00.000Z"));

    const truthLane = report.lanes.find((lane) => lane.id === "truth");

    expect(truthLane?.blocked).toBe(1);
    expect(report.truthScore).toBeLessThan(100);
    expect(report.riskFlags.join(" ")).toContain("Mock-Instrumente");
    expect(report.priorities.map((item) => item.id)).toContain("mock-quarantine");
  });

  it("surfaces provider and license blockers instead of claiming production readiness", () => {
    const report = buildMarketCoverageIntelligenceReport([
      instrument({
        symbol: "SPX",
        assetClass: "index",
        quoteQuality: "unavailable",
        quality: "unavailable",
        coverage: "license_required",
        subscribable: false,
        analysisReadiness: "blocked"
      })
    ], coverage, new Date("2026-08-06T12:00:00.000Z"));

    expect(report.status).toBe("blocked");
    expect(report.conclusion).toContain("nicht genügend verifizierte Daten");
    expect(report.priorities.map((item) => item.id)).toContain("quote-coverage");
    expect(report.providerCapabilities.some((item) => item.blocker?.includes("Lizenz"))).toBe(true);
  });

  it("scores broad clean universes higher than limited universes", () => {
    const broad = buildMarketCoverageIntelligenceReport([
      instrument({ symbol: "AAPL", assetClass: "stock" }),
      instrument({ symbol: "SPY", assetClass: "etf" }),
      instrument({ symbol: "BTC-USD", assetClass: "crypto" }),
      instrument({ symbol: "EURUSD", assetClass: "forex" })
    ], coverage, new Date("2026-08-06T12:00:00.000Z"));
    const limited = buildMarketCoverageIntelligenceReport([
      instrument({ symbol: "DAX", assetClass: "index", coverage: "prepared", quoteQuality: "unavailable", subscribable: false, analysisReadiness: "limited" })
    ], coverage, new Date("2026-08-06T12:00:00.000Z"));

    expect(broad.professionalDepthScore).toBeGreaterThan(limited.professionalDepthScore);
    expect(broad.coverageScore).toBeGreaterThan(limited.coverageScore);
  });
});
