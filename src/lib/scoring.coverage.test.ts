import { describe, expect, it } from "vitest";
import {
  calculateProfessionalScores,
  calculateTotalScore,
  calculateVolatility,
  clamp,
  formatCompact,
  formatCurrency,
  formatPercent,
  legalDisclaimer,
  mockDataDisclaimer,
  probabilityDisclaimer,
  riskTone,
  scoreLabel,
  scoreTone,
  sentimentTone
} from "./scoring";

describe("scoring helpers coverage", () => {
  it("formats labels, tones and disclaimers across all threshold bands", () => {
    expect(legalDisclaimer).toContain("Keine Anlageberatung");
    expect(probabilityDisclaimer).toContain("keine Garantie");
    expect(mockDataDisclaimer).toContain("Mock-Daten");

    expect(clamp(-4)).toBe(0);
    expect(clamp(104)).toBe(100);
    expect(clamp(42, 10, 50)).toBe(42);
    expect(formatCurrency(148.42, "USD")).toContain("148,42");
    expect(formatCurrency(14200, "EUR")).toContain("14.200");
    expect(formatCompact(1_250_000)).toMatch(/1,3|1,2/);
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-1.234)).toBe("-1.23%");

    expect(scoreLabel(92)).toBe("Mögliche Chance hoch, Risiko streng prüfen");
    expect(scoreLabel(70)).toBe("Mögliche Chance erhöht");
    expect(scoreLabel(50)).toBe("Unklar / neutral");
    expect(scoreLabel(30)).toBe("Schwaches Chancenprofil");
    expect(scoreLabel(10)).toBe("Sehr schwaches Chancenprofil");

    expect(scoreTone(71)).toBe("text-profit");
    expect(scoreTone(55)).toBe("text-amber");
    expect(scoreTone(30)).toBe("text-loss");

    expect(riskTone("niedrig")).toContain("text-profit");
    expect(riskTone("mittel")).toContain("text-amber");
    expect(riskTone("hoch")).toContain("text-loss");
    expect(riskTone("extrem")).toContain("border-loss/50");

    expect(sentimentTone("positive")).toContain("text-profit");
    expect(sentimentTone("neutral")).toContain("text-amber");
    expect(sentimentTone("negative")).toContain("text-loss");
  });

  it("calculates total scores and volatility with edge-case guards", () => {
    expect(calculateTotalScore({ trend: 100, news: 100, fundamental: 100, technical: 100, risk: 100 })).toBe(86);
    expect(calculateTotalScore({ trend: 0, news: 0, fundamental: 0, technical: 0, risk: 0 })).toBe(14);
    expect(calculateVolatility([])).toBe(0);
    expect(
      calculateVolatility([
        candle(100, 100),
        candle(100, 110),
        candle(110, 99)
      ])
    ).toBe(10);
  });

  it("builds professional scores for positive, negative and event-risk scenarios", () => {
    const positive = calculateProfessionalScores({
      baseScores: { trend: 85, news: 78, fundamental: 82, technical: 80, risk: 74, total: 80 },
      quote: quote({ changePercent: 3.2, volume: 35_000_000 }),
      candles: [candle(100, 102), candle(102, 106), candle(106, 112)],
      indicators: indicators({ rsi: 64, histogram: 2.4 }),
      fundamentals: fundamentals({ revenueGrowth: 28, debtToEquity: 0.2 }),
      news: [
        {
          id: "n1",
          symbol: "NVDA",
          title: "positive",
          source: "test",
          publishedAt: "2026-06-30T09:00:00.000Z",
          relevance: 90,
          sentiment: "positive",
          impactScore: 64,
          summary: "test",
          url: "#"
        }
      ],
      earningsDate: "2026-07-20",
      now: new Date("2026-06-30T10:00:00.000Z")
    });

    expect(positive.opportunityTotal).toBeGreaterThan(positive.riskTotal);
    expect(positive.probabilityUp + positive.probabilityDown + positive.probabilitySideways).toBe(100);

    const negative = calculateProfessionalScores({
      baseScores: { trend: 25, news: 28, fundamental: 32, technical: 24, risk: 18, total: 25 },
      quote: quote({ changePercent: -8.5, volume: 500_000 }),
      candles: [candle(100, 98), candle(98, 84), candle(84, 75)],
      indicators: indicators({ rsi: 24, histogram: -3.8 }),
      fundamentals: fundamentals({ revenueGrowth: -18, debtToEquity: 1.8 }),
      news: [
        {
          id: "n2",
          symbol: "AAPL",
          title: "negative",
          source: "test",
          publishedAt: "2026-06-30T09:00:00.000Z",
          relevance: 82,
          sentiment: "negative",
          impactScore: -54,
          summary: "test",
          url: "#"
        }
      ],
      earningsDate: "2026-07-06",
      now: new Date("2026-06-30T10:00:00.000Z")
    });

    expect(negative.eventRisk).toBeGreaterThan(positive.eventRisk);
    expect(negative.liquidityRisk).toBeGreaterThan(positive.liquidityRisk);
    expect(negative.probabilityDown).toBeGreaterThanOrEqual(negative.probabilityUp);

    const neutral = calculateProfessionalScores({
      baseScores: { trend: 50, news: 50, fundamental: 50, technical: 50, risk: 50, total: 50 },
      quote: quote({ changePercent: 0, volume: 2_000_000 }),
      candles: [candle(100, 100), candle(100, 100.5), candle(100.5, 100.2)],
      indicators: indicators({ rsi: 72, histogram: 0 }),
      fundamentals: fundamentals({ revenueGrowth: 2, debtToEquity: 0.9 }),
      news: [],
      earningsDate: null,
      now: new Date("2026-06-30T10:00:00.000Z")
    });

    expect(neutral.sentiment).toBe(50);
    expect(neutral.explanation).toContain(probabilityDisclaimer);
  });
});

function candle(open: number, close: number) {
  return {
    symbol: "TEST",
    range: "1M",
    timestamp: "2026-06-30T10:00:00.000Z",
    time: "",
    open,
    high: Math.max(open, close) + 2,
    low: Math.min(open, close) - 2,
    close,
    volume: 1_000_000
  } as const;
}

function quote(overrides: { changePercent: number; volume: number }) {
  return {
    price: 100,
    change: overrides.changePercent,
    changePercent: overrides.changePercent,
    dayHigh: 104,
    dayLow: 96,
    volume: overrides.volume,
    delayedByMinutes: 15,
    asOf: "2026-06-30T10:00:00.000Z",
    bid: 99.9,
    ask: 100.1,
    spread: 0.2,
    open: 100 - overrides.changePercent,
    previousClose: 100 - overrides.changePercent,
    provider: "test",
    quality: "mock",
    latencyMs: 0,
    marketStatus: "unknown"
  } as const;
}

function indicators(overrides: { rsi: number; histogram: number }) {
  return {
    rsi: overrides.rsi,
    macd: { value: overrides.histogram, signal: 0, histogram: overrides.histogram },
    movingAverages: { ma20: 99, ma50: 97, ma200: 92 },
    bollingerBands: { upper: 110, middle: 100, lower: 90 },
    support: [95, 90],
    resistance: [105, 110]
  };
}

function fundamentals(overrides: { revenueGrowth: number; debtToEquity: number }) {
  return {
    peRatio: 24,
    revenueGrowth: overrides.revenueGrowth,
    earningsGrowth: 8,
    debtToEquity: overrides.debtToEquity,
    cashflow: 1_000_000_000,
    dividendYield: 1.2,
    marketCap: 10_000_000_000
  };
}
