import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";
import type { AssetDetail } from "@/lib/types";
import { buildAssetProvenancePassport } from "./asset-provenance";

function cloneDetail(symbol: string): AssetDetail {
  const detail = getMockAsset(symbol);
  if (!detail) throw new Error(`Missing mock asset ${symbol}`);
  return structuredClone(detail) as AssetDetail;
}

describe("asset provenance passport", () => {
  it("builds a data passport with source references and no fake live claim", () => {
    const detail = cloneDetail("NVDA");
    detail.quote.quality = "delayed";
    detail.quote.provider = "Unit Test Provider";
    detail.quote.asOf = "2026-08-06T10:00:00.000Z";

    const passport = buildAssetProvenancePassport(detail, new Date("2026-08-06T10:10:00.000Z"));

    expect(passport.symbol).toBe("NVDA");
    expect(passport.primaryProvider).toBe("Unit Test Provider");
    expect(passport.entries.some((entry) => entry.id === "quote" && entry.quality === "delayed")).toBe(true);
    expect(passport.entries.every((entry) => entry.sourceReference.includes("NVDA"))).toBe(true);
    expect(passport.decision).not.toBe("analysis_allowed");
  });

  it("blocks analysis when only provider quote data is present", () => {
    const detail = cloneDetail("AAPL");
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
    detail.dataQuality = {
      ...detail.dataQuality,
      sufficientForAnalysis: false,
      confidence: 18,
      score: 31,
      issues: ["Fundamentaldaten fehlen."]
    };
    detail.riskReport = {
      ...detail.riskReport,
      blockedAnalysis: true
    };
    detail.quote.quality = "near_realtime";

    const passport = buildAssetProvenancePassport(detail, new Date(detail.quote.asOf));

    expect(passport.decision).toBe("analysis_blocked");
    expect(passport.missingSources).toBeGreaterThanOrEqual(2);
    expect(passport.blockers.join(" ")).toContain("Fundamentaldaten");
    expect(passport.userMessage).toContain("nicht genügend verifizierte Daten");
  });
});
