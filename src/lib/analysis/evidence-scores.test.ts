import { describe, expect, it } from "vitest";
import { NO_INDICATORS, buildTechnicalIndicators } from "@/lib/analysis/technical";
import {
  buildEvidenceBoundScores,
  buildQuoteOnlyScoreEvidence,
  professionalScoresFromEvidence
} from "@/lib/analysis/evidence-scores";
import type { AssetDetail, Candle, FundamentalsEvidence, Quote } from "@/lib/types";

const quote: Quote = {
  price: 150,
  change: 1,
  changePercent: 0.67,
  dayHigh: 151,
  dayLow: 148,
  volume: 2_000_000,
  delayedByMinutes: 15,
  asOf: "2026-08-10T20:00:00.000Z",
  provider: "FMP",
  quality: "delayed",
  marketStatus: "closed"
};

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.25 + Math.sin(index / 5);
    const timestamp = new Date(Date.UTC(2025, 0, index + 1)).toISOString();
    return { symbol: "AAPL", range: "1Y", timestamp, time: timestamp, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1_000_000 + index * 1000 };
  });
}

const fundamentalsEvidence: FundamentalsEvidence = {
  provider: "FMP Fundamentals",
  quality: "delayed",
  fetchedAt: "2026-08-10T19:00:00.000Z",
  fields: { revenueGrowth: "provider", earningsGrowth: "provider", debtToEquity: "provider", cashflow: "provider" },
  verifiedFields: ["revenueGrowth", "earningsGrowth", "debtToEquity", "cashflow"],
  excludedMockFields: [],
  unavailableFields: ["peRatio", "dividendYield", "marketCap"],
  verifiedCount: 4,
  totalFields: 7,
  coveragePercent: 57,
  caveat: null,
  warning: null
};

describe("evidence-bound scores", () => {
  it("verweigert sämtliche Scores aus einem Einzelquote", () => {
    const evidence = buildQuoteOnlyScoreEvidence(quote);
    for (const dimension of Object.values(evidence.dimensions)) {
      expect(dimension.value).toBeNull();
      expect(dimension.availability).toBe("unavailable");
    }
  });

  it("berechnet einen partiellen Gesamtscore nur aus belegten Dimensionen", () => {
    const history = candles(220);
    const evidence = buildEvidenceBoundScores({
      quote,
      candles: history,
      indicators: buildTechnicalIndicators(history),
      fundamentals: { peRatio: null, revenueGrowth: 8, earningsGrowth: 12, debtToEquity: 0.8, cashflow: 10_000_000, dividendYield: null, marketCap: 0 },
      fundamentalsEvidence,
      news: [{ id: "aapl-1", symbol: "AAPL", title: "Unternehmen meldet Zahlen", summary: "Externe Meldung", source: "Reuters", url: "https://example.com/aapl", publishedAt: "2026-08-10T18:00:00.000Z", sentiment: "positive", relevance: 80 }] as unknown as AssetDetail["news"],
      historyProvider: "FMP Historical"
    });
    expect(evidence.dimensions.trend.value).not.toBeNull();
    expect(evidence.dimensions.fundamental.availability).toBe("partial");
    expect(evidence.dimensions.news.sources).toContain("Reuters");
    expect(evidence.dimensions.total.value).not.toBeNull();
    expect(evidence.dimensions.total.availability).toBe("partial");
    expect(evidence.dimensions.total.sources).toEqual(expect.arrayContaining(["FMP Historical", "FMP Fundamentals", "Reuters"]));
    expect(professionalScoresFromEvidence(evidence).probabilityUp).toBe(0);
  });

  it("setzt fehlende News und Fundamentals nicht auf neutrale 50 Punkte", () => {
    const history = candles(90);
    const evidence = buildEvidenceBoundScores({
      quote,
      candles: history,
      indicators: NO_INDICATORS,
      fundamentals: { peRatio: null, revenueGrowth: 0, earningsGrowth: 0, debtToEquity: 0, cashflow: 0, dividendYield: null, marketCap: 0 },
      news: [],
      historyProvider: "FMP Historical"
    });
    expect(evidence.dimensions.news.value).toBeNull();
    expect(evidence.dimensions.fundamental.value).toBeNull();
    expect(evidence.dimensions.technical.value).toBeNull();
    expect(evidence.dimensions.total.value).toBeNull();
  });
});
