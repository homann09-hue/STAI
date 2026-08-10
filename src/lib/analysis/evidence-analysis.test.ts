import { describe, expect, it } from "vitest";
import { buildEvidenceBoundAnalysis } from "@/lib/analysis/evidence-analysis";
import type { AssetDetail, Candle } from "@/lib/types";

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.35 + Math.sin(index / 3) * 1.5;
    const time = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
    return {
      symbol: "SAP.DE",
      range: "1Y",
      time,
      timestamp: time,
      open: close - 0.4,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1_000_000 + index
    };
  });
}

function detail(overrides: Partial<AssetDetail> = {}) {
  return {
    candles: { "1Y": candles(120) },
    quote: {
      quality: "delayed",
      asOf: "2026-08-10T10:00:00.000Z",
      provider: "FMP"
    },
    news: [],
    riskReport: { level: "mittel" },
    dataQuality: {
      sufficientForAnalysis: true,
      stale: false,
      confidence: 65,
      issues: ["Keine verifizierten Fundamentaldaten im aktiven Analysepfad."],
      warnings: [],
      sources: [
        {
          name: "FMP Historical",
          fetchedAt: "2026-08-10T10:00:00.000Z",
          type: "provider",
          rank: 1,
          status: "delayed",
          note: "120 Kerzen"
        }
      ]
    },
    ...overrides
  } as unknown as AssetDetail;
}

describe("buildEvidenceBoundAnalysis", () => {
  it("erzeugt eine quellengebundene, normalisierte Wahrscheinlichkeitsanalyse", () => {
    const analysis = buildEvidenceBoundAnalysis(detail());

    expect(analysis).not.toBeNull();
    expect(
      analysis!.probabilities.up +
        analysis!.probabilities.down +
        analysis!.probabilities.sideways
    ).toBe(100);
    expect(analysis!.sources).toEqual([
      "FMP Historical, Stand 2026-08-10T10:00:00.000Z"
    ]);
    expect(analysis!.modelNote).toContain("stockpilot-evidence-analysis-v1");
    expect(analysis!.longTerm).toContain("keine belastbare Aussage");
  });

  it("verweigert bei unzureichender Datenqualität eine scheinpräzise Prognose", () => {
    const blocked = detail({
      dataQuality: {
        ...detail().dataQuality,
        sufficientForAnalysis: false
      }
    });

    expect(buildEvidenceBoundAnalysis(blocked)).toBeNull();
  });

  it("verweigert Mock-Kurse auch bei vorhandenen Kerzen", () => {
    const mock = detail({
      quote: {
        ...detail().quote,
        quality: "mock"
      }
    });

    expect(buildEvidenceBoundAnalysis(mock)).toBeNull();
  });
});
