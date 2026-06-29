import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";
import { calculateProfessionalScores, calculateTotalScore, calculateVolatility } from "@/lib/scoring";

describe("score model", () => {
  it("keeps legacy scores bounded", () => {
    expect(calculateTotalScore({ trend: 100, news: 100, fundamental: 100, technical: 100, risk: 0 })).toBeLessThanOrEqual(100);
    expect(calculateTotalScore({ trend: 0, news: 0, fundamental: 0, technical: 0, risk: 100 })).toBeGreaterThanOrEqual(0);
  });

  it("creates transparent probabilities that sum to 100", () => {
    const asset = getMockAsset("NVDA");
    expect(asset).toBeTruthy();

    const scores = calculateProfessionalScores({
      baseScores: asset!.scores,
      quote: asset!.quote,
      candles: asset!.candles["1M"],
      indicators: asset!.indicators,
      fundamentals: asset!.fundamentals,
      news: asset!.news,
      earningsDate: asset!.earningsDate
    });

    expect(scores.probabilityUp + scores.probabilityDown + scores.probabilitySideways).toBe(100);
    expect(scores.explanation.join(" ")).toContain("keine Garantie");
  });

  it("calculates non-negative volatility", () => {
    const asset = getMockAsset("BTC-USD");
    expect(calculateVolatility(asset!.candles["1M"])).toBeGreaterThanOrEqual(0);
  });
});
