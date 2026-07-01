import { describe, expect, it } from "vitest";
import { assessDataQuality } from "./data-quality";
import { getMockAsset } from "./mock/market";
import { buildRiskReport } from "./risk-engine";

type MockDetail = NonNullable<ReturnType<typeof getMockAsset>>;

describe("risk engine branch coverage", () => {
  it("returns a low-risk report when no model warning is triggered", () => {
    const detail = cloneDetail("VOO");
    detail.quote.quality = "realtime";
    detail.quote.provider = "Unit Test Realtime Provider";
    detail.quote.volume = 50_000_000;
    detail.quote.changePercent = 0.2;
    detail.indicators.rsi = 50;
    detail.indicators.support = [400, 380];
    detail.quote.price = 560;
    detail.news = [{ ...detail.news[0], sentiment: "neutral", relevance: 50 }];
    detail.earningsDate = null;
    detail.professionalScores.volatilityRisk = 10;
    detail.analysisLayers = detail.analysisLayers.map((layer) =>
      layer.label === "Sektortrend" ? { ...layer, status: "positive" } : layer
    );
    detail.macroFactors = detail.macroFactors.map((factor) => ({ ...factor, impact: "positive" }));
    detail.candles["1M"] = Array.from({ length: 20 }, (_, index) => ({
      symbol: "VOO",
      range: "1M",
      timestamp: new Date(Date.UTC(2026, 5, index + 1)).toISOString(),
      time: "",
      open: 100,
      high: 101,
      low: 99,
      close: 100 + index * 0.02,
      volume: 5_000_000
    }));

    const dataQuality = {
      ...assessDataQuality(detail),
      sufficientForAnalysis: true,
      score: 90,
      issues: [],
      warnings: []
    };
    const report = buildRiskReport(detail, dataQuality, new Date(detail.quote.asOf));

    expect(report.level).toBe("niedrig");
    expect(report.score).toBe(0);
    expect(report.blockedAnalysis).toBe(false);
    expect(report.summary).toContain("Keine kritischen Warnungen");
    expect(report.findings).toEqual([]);
  });

  it("detects severe volatility, liquidity, news, event, technical, macro and data-quality risks", () => {
    const detail = cloneDetail("AAPL");
    detail.asset.type = "stock";
    detail.quote.price = 80;
    detail.quote.volume = 500_000;
    detail.quote.changePercent = 9.4;
    detail.indicators.rsi = 88;
    detail.indicators.support = [90, 82];
    detail.earningsDate = "2026-07-02";
    detail.news = [
      {
        id: "bad-news",
        symbol: "AAPL",
        title: "Regulatory pressure rises",
        source: "test",
        publishedAt: "2026-06-30T09:00:00+02:00",
        relevance: 92,
        sentiment: "negative",
        impactScore: -80,
        summary: "test",
        url: "#"
      }
    ];
    detail.professionalScores.volatilityRisk = 90;
    detail.analysisLayers = detail.analysisLayers.map((layer) =>
      layer.label === "Sektortrend" ? { ...layer, status: "negative", detail: "Sector weak" } : layer
    );
    detail.macroFactors = [{ label: "Zinsniveau", impact: "negative", detail: "test", source: "test" }];
    detail.candles["1M"] = Array.from({ length: 20 }, (_, index) => ({
      symbol: "AAPL",
      range: "1M",
      timestamp: new Date(Date.UTC(2026, 5, index + 1)).toISOString(),
      time: "",
      open: 100 + index * 3,
      high: 105 + index * 3,
      low: 95 + index * 3,
      close: 100 + index * 3,
      volume: index < 12 ? 10_000_000 : 1_000_000
    }));

    const dataQuality = {
      ...assessDataQuality(detail),
      sufficientForAnalysis: false,
      score: 35,
      issues: ["Quote invalid"],
      warnings: ["Mock warning"]
    };
    const report = buildRiskReport(detail, dataQuality, new Date("2026-06-30T10:00:00Z"));
    const ids = report.findings.map((finding) => finding.id);

    expect(report.level).toBe("extrem");
    expect(report.blockedAnalysis).toBe(true);
    expect(ids).toEqual(
      expect.arrayContaining([
        "volatility-high",
        "liquidity-low",
        "negative-news",
        "earnings-upcoming",
        "pump-dump-suspected",
        "volume-falling",
        "rsi-overbought",
        "support-broken",
        "macro-risk",
        "sector-weakness",
        "data-quality-low"
      ])
    );
    expect(report.findings.find((finding) => finding.id === "data-quality-low")?.severity).toBe("extrem");
  });

  it("covers medium-severity earnings, oversold RSI and relevant negative news", () => {
    const detail = cloneDetail("MSFT");
    detail.quote.volume = 3_000_000;
    detail.quote.changePercent = -2;
    detail.indicators.rsi = 24;
    detail.indicators.support = [100, 90];
    detail.quote.price = 120;
    detail.earningsDate = "2026-07-10";
    detail.news = [
      {
        id: "medium-bad-news",
        symbol: "MSFT",
        title: "Cloud checks soften",
        source: "test",
        publishedAt: "2026-06-30T09:00:00+02:00",
        relevance: 72,
        sentiment: "negative",
        impactScore: -30,
        summary: "test",
        url: "#"
      }
    ];
    detail.professionalScores.volatilityRisk = 20;
    detail.analysisLayers = detail.analysisLayers.map((layer) =>
      layer.label === "Sektortrend" ? { ...layer, status: "positive" } : layer
    );
    detail.macroFactors = detail.macroFactors.map((factor) => ({ ...factor, impact: "positive" }));
    detail.candles["1M"] = Array.from({ length: 20 }, (_, index) => ({
      symbol: "MSFT",
      range: "1M",
      timestamp: new Date(Date.UTC(2026, 5, index + 1)).toISOString(),
      time: "",
      open: 100,
      high: 101,
      low: 99,
      close: 100 - index * 0.1,
      volume: 5_000_000
    }));

    const report = buildRiskReport(detail, assessDataQuality(detail), new Date("2026-06-30T10:00:00Z"));

    expect(report.findings.find((finding) => finding.id === "negative-news")?.severity).toBe("mittel");
    expect(report.findings.find((finding) => finding.id === "earnings-upcoming")?.severity).toBe("mittel");
    expect(report.findings.find((finding) => finding.id === "rsi-oversold")?.severity).toBe("mittel");
  });
});

function cloneDetail(symbol: string) {
  const detail = getMockAsset(symbol);
  if (!detail) throw new Error(`Missing mock asset ${symbol}`);
  return structuredClone(detail) as MockDetail;
}
