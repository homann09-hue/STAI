import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";
import type { AssetDetail } from "@/lib/types";
import { buildForecastPassport } from "./forecast-passport";

function cloneDetail(symbol: string): AssetDetail {
  const detail = getMockAsset(symbol);
  if (!detail) throw new Error(`Missing mock asset ${symbol}`);
  return structuredClone(detail) as AssetDetail;
}

describe("forecast passport", () => {
  it("blocks forecasts when the detail only has weak provider data", () => {
    const detail = cloneDetail("NVDA");
    detail.news = [];
    detail.fundamentals = {
      peRatio: null,
      revenueGrowth: 0,
      earningsGrowth: 0,
      debtToEquity: 0,
      cashflow: 0,
      dividendYield: null,
      marketCap: 0
    };
    detail.candles = {
      ...detail.candles,
      "1M": detail.candles["1M"].slice(0, 3)
    };
    detail.dataQuality = {
      ...detail.dataQuality,
      confidence: 18,
      score: 28,
      sufficientForAnalysis: false,
      issues: ["Nur Quote-Daten vorhanden."]
    };
    detail.quote.quality = "near_realtime";

    const passport = buildForecastPassport(detail, new Date("2026-08-06T12:00:00.000Z"));

    expect(passport.status).toBe("blocked");
    expect(passport.probabilityUp + passport.probabilityDown + passport.probabilitySideways).toBe(0);
    expect(passport.scenarios.every((scenario) => scenario.projectedPrice === null)).toBe(true);
    expect(passport.userMessage).toContain("nicht genügend verifizierte Daten");
  });

  it("normalizes probabilities and includes model provenance for usable data", () => {
    const detail = cloneDetail("AAPL");
    detail.quote.quality = "near_realtime";
    detail.quote.provider = "Unit Test Market Provider";
    detail.professionalScores = {
      ...detail.professionalScores,
      probabilityUp: 78,
      probabilityDown: 28,
      probabilitySideways: 14
    };

    const passport = buildForecastPassport(detail, new Date("2026-08-06T12:00:00.000Z"));

    expect(passport.status).not.toBe("blocked");
    expect(passport.probabilityUp + passport.probabilityDown + passport.probabilitySideways).toBe(100);
    expect(passport.sources.some((source) => source.includes("stockpilot-forecast-v1.0-deterministic"))).toBe(true);
    expect(passport.sources.some((source) => source.includes("Unit Test Market Provider"))).toBe(true);
  });

  it("caps confidence and widens the label for delayed or stale data", () => {
    const detail = cloneDetail("MSFT");
    detail.quote.quality = "delayed";
    detail.dataQuality = {
      ...detail.dataQuality,
      confidence: 92,
      score: 88,
      stale: true
    };

    const passport = buildForecastPassport(detail, new Date("2026-08-06T12:00:00.000Z"));

    expect(passport.status).toBe("limited");
    expect(passport.confidence).toBeLessThanOrEqual(65);
    expect(passport.userMessage).toContain("eingeschränkte");
    expect(passport.bands.some((band) => band.lowerReturnPercent !== null && band.upperReturnPercent !== null)).toBe(true);
  });
});
