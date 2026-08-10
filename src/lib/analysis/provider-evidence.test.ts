import { describe, expect, it } from "vitest";
import { assessHistoricalDataIntegrity } from "@/lib/analysis/history-integrity";
import { assessProviderEvidence } from "@/lib/analysis/provider-evidence";
import type { AssetDetail, Candle, DataQualityReport } from "@/lib/types";

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    symbol: "SAP.DE",
    range: "1Y",
    time: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    open: 200 + index,
    high: 202 + index,
    low: 198 + index,
    close: 201 + index,
    volume: 1_000_000 + index
  }));
}

function baseReport(): DataQualityReport {
  return {
    score: 35,
    freshness: "delayed",
    sourceLabel: "FMP",
    isMock: false,
    updatedAt: "2026-08-10T10:00:00.000Z",
    stale: false,
    sufficientForAnalysis: false,
    confidence: 35,
    issues: ["Fundamental-, News- und historische Kerzendaten fehlen."],
    warnings: [],
    contradictions: [],
    sources: [
      {
        name: "FMP",
        type: "provider",
        rank: 1,
        fetchedAt: "2026-08-10T10:00:00.000Z",
        status: "delayed",
        note: "Provider quote"
      },
      {
        name: "StockPilot Analysis Guard",
        type: "derived",
        rank: 4,
        fetchedAt: "2026-08-10T10:00:00.000Z",
        status: "missing",
        note: "Historie und News fehlen."
      }
    ]
  };
}

const quote = {
  symbol: "SAP.DE",
  price: 250,
  change: 2,
  changePercent: 0.8,
  currency: "EUR",
  asOf: "2026-08-10T10:00:00.000Z",
  provider: "FMP",
  quality: "delayed",
  marketStatus: "open"
} as const;

describe("assessProviderEvidence", () => {
  it("blockiert eine Analyse ohne belastbare Historie und nennt die Datenlücken", () => {
    const report = assessProviderEvidence({
      quote,
      history: { candles: [], provider: null, note: "nicht geliefert", integrity: null },
      news: [],
      base: baseReport()
    });

    expect(report.sufficientForAnalysis).toBe(false);
    expect(report.confidence).toBeLessThanOrEqual(35);
    expect(report.issues.join(" ")).toContain("Fundamentaldaten");
    expect(report.issues.join(" ")).toContain("60");
    expect(report.warnings.join(" ")).toContain("Keine verifizierten externen News");
  });

  it("erkennt echte Historie und externe News als begrenzte Analysebasis", () => {
    const historyCandles = candles(90);
    const report = assessProviderEvidence({
      quote,
      history: {
        candles: historyCandles,
        provider: "FMP Historical",
        note: "Daily history",
        integrity: assessHistoricalDataIntegrity(historyCandles)
      },
      news: [
        {
          id: "sap-1",
          title: "SAP veröffentlicht Quartalszahlen",
          summary: "Externe Meldung",
          source: "Reuters",
          url: "https://example.com/sap",
          publishedAt: "2026-08-10T09:30:00.000Z",
          sentiment: "neutral",
          relevance: 90,
        }
      ] as unknown as AssetDetail["news"],
      base: baseReport()
    });

    expect(report.sufficientForAnalysis).toBe(true);
    expect(report.isMock).toBe(false);
    expect(report.sourceLabel).toContain("FMP Historical");
    expect(report.sourceLabel).toContain("Reuters");
    expect(report.sources.some((source) => source.name === "FMP Historical")).toBe(true);
    expect(report.sources.some((source) => source.name === "Reuters")).toBe(true);
    expect(
      report.sources.find((source) => source.name === "StockPilot Analysis Guard")
        ?.note
    ).toContain("begrenzte technische Analyse");
    expect(
      report.sources.find((source) => source.name === "StockPilot Analysis Guard")
        ?.status
    ).toBe("fresh");
    expect(report.issues).toEqual(["Keine verifizierten Fundamentaldaten im aktiven Analysepfad."]);
  });

  it("gibt bei veralteter Kursbasis trotz Historie keine Analyse frei", () => {
    const historyCandles = candles(90);
    const base = baseReport();
    base.stale = true;

    const report = assessProviderEvidence({
      quote,
      history: {
        candles: historyCandles,
        provider: "FMP Historical",
        note: "Daily history",
        integrity: assessHistoricalDataIntegrity(historyCandles)
      },
      news: [],
      base
    });

    expect(report.sufficientForAnalysis).toBe(false);
    expect(report.confidence).toBeLessThanOrEqual(35);
  });
});
