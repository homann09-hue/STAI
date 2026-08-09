import { describe, expect, it } from "vitest";
import { getMockAsset } from "@/lib/mock/market";
import type { AssetDetail } from "@/lib/types";
import { buildAssetReadiness, buildFundamentalMetrics } from "./asset-readiness";

function providerOnlyClone(): AssetDetail {
  const base = getMockAsset("NVDA");
  if (!base) throw new Error("Missing NVDA mock asset");

  return {
    ...base,
    news: [],
    fundamentals: {
      peRatio: null,
      revenueGrowth: 0,
      earningsGrowth: 0,
      debtToEquity: 0,
      cashflow: 0,
      dividendYield: null,
      marketCap: 0
    },
    dataQuality: {
      ...base.dataQuality,
      isMock: false,
      sufficientForAnalysis: false,
      confidence: 18,
      score: 31,
      issues: ["Fundamentaldaten fehlen."]
    },
    riskReport: {
      ...base.riskReport,
      blockedAnalysis: true
    },
    quote: {
      ...base.quote,
      provider: "Provider Quote Only",
      quality: "near_realtime"
    }
  };
}

describe("asset readiness", () => {
  it("blocks provider-only assets and does not show fake zero fundamentals", () => {
    const detail = providerOnlyClone();
    const readiness = buildAssetReadiness(detail);
    const fundamentals = buildFundamentalMetrics(detail);

    expect(readiness.status).toBe("blocked");
    expect(readiness.missingAreas).toContain("verifizierte Fundamentaldaten");
    expect(readiness.missingAreas).toContain("echte News/Events");
    expect(fundamentals.filter((item) => item.label !== "Aktueller Kurs").every((item) => item.value === "nicht geliefert")).toBe(true);
  });

  it("keeps usable mock fixtures visible but still quality-labeled elsewhere", () => {
    const detail = getMockAsset("NVDA");
    if (!detail) throw new Error("Missing NVDA mock asset");

    const readiness = buildAssetReadiness(detail);
    const fundamentals = buildFundamentalMetrics(detail);

    expect(readiness.status).not.toBe("blocked");
    expect(fundamentals.find((item) => item.label === "KGV")?.available).toBe(true);
    expect(fundamentals.find((item) => item.label === "Marktkapitalisierung")?.value).not.toBe("nicht geliefert");
  });
});
