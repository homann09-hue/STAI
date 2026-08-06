import { describe, expect, it } from "vitest";
import type { MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";
import { buildMarketOperationsReport } from "./market-operations";

function instrument(overrides: Partial<MarketUniverseInstrument> = {}): MarketUniverseInstrument {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetClass: "stock",
    exchange: "NASDAQ",
    country: "USA",
    currency: "USD",
    provider: "Test Provider",
    quality: "near_realtime",
    quoteQuality: "near_realtime",
    coverage: "available",
    subscribable: true,
    lastUpdatedAt: "2026-08-06T12:00:00.000Z",
    note: "Test",
    resolutionStatus: "resolved",
    analysisReadiness: "ready",
    ...overrides
  };
}

const coverage: MarketUniverseCoverage[] = [
  {
    label: "Crypto",
    assetClasses: ["crypto"],
    exchanges: ["Binance"],
    providerCandidates: ["Binance"],
    status: "connected",
    note: "Connected test coverage."
  },
  {
    label: "Options",
    assetClasses: ["option"],
    exchanges: ["OPRA"],
    providerCandidates: ["OPRA"],
    status: "license_required",
    note: "License required."
  }
];

describe("market operations report", () => {
  it("summarizes tradable, streamable and analysis-ready coverage", () => {
    const report = buildMarketOperationsReport(
      [
        instrument({ symbol: "BTC-USD", assetClass: "crypto", exchange: "Binance" }),
        instrument({
          symbol: "ES",
          assetClass: "future",
          exchange: "CME",
          quoteQuality: "unavailable",
          quality: "unavailable",
          coverage: "license_required",
          subscribable: false,
          analysisReadiness: "blocked"
        })
      ],
      coverage,
      "Unit Provider",
      new Date("2026-08-06T12:00:00.000Z")
    );

    expect(report.total).toBe(2);
    expect(report.tradableNow).toBe(1);
    expect(report.streamable).toBe(1);
    expect(report.analysisReady).toBe(1);
    expect(report.licenseRequired).toBe(1);
    expect(report.activationSteps.some((step) => step.id === "quote-rights" && step.status === "done")).toBe(true);
  });

  it("does not count mock rows as tradable live coverage", () => {
    const report = buildMarketOperationsReport(
      [
        instrument({
          quoteQuality: "mock",
          quality: "mock",
          coverage: "available",
          subscribable: true,
          analysisReadiness: "limited"
        })
      ],
      coverage,
      "Mock Provider",
      new Date("2026-08-06T12:00:00.000Z")
    );

    expect(report.tradableNow).toBe(0);
    expect(report.streamable).toBe(0);
    expect(report.mockRows).toBe(1);
    expect(report.operationalRisk).toBe("extrem");
    expect(report.userMessage).toContain("Mock/Demo");
  });

  it("handles empty provider results without inventing coverage", () => {
    const report = buildMarketOperationsReport([], coverage, "Empty Provider", new Date("2026-08-06T12:00:00.000Z"));

    expect(report.total).toBe(0);
    expect(report.tradableNow).toBe(0);
    expect(report.activationSteps.every((step) => step.status !== "done")).toBe(true);
    expect(report.userMessage).toContain("keine Instrumente");
  });
});
