import { describe, expect, it } from "vitest";

import { calculateHistoricalRiskMetrics } from "@/lib/analysis/historical-risk";
import type { Candle } from "@/lib/types";

function candles(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    symbol: "TEST",
    range: "1Y",
    timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    time: "",
    open: close,
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume: 1000
  }));
}

describe("calculateHistoricalRiskMetrics", () => {
  it("berechnet reproduzierbare Risiko- und Renditekennzahlen aus Provider-Kerzen", () => {
    const closes = Array.from({ length: 90 }, (_, index) => 100 + index * 0.35 + Math.sin(index / 3) * 2);
    const result = calculateHistoricalRiskMetrics({ candles: candles(closes), provider: "Verified History" });

    expect(result.status).toBe("available");
    expect(result.quality).toBe("historical");
    expect(result.sampleSize).toBe(89);
    expect(result.metrics.totalReturnPercent).toBeGreaterThan(20);
    expect(result.metrics.annualizedVolatilityPercent).toBeGreaterThan(0);
    expect(result.metrics.sharpeRatio).not.toBeNull();
    expect(result.metrics.valueAtRisk95Percent).toBeGreaterThanOrEqual(0);
    expect(result.metrics.conditionalValueAtRisk95Percent).toBeGreaterThanOrEqual(result.metrics.valueAtRisk95Percent ?? 0);
  });

  it("hält alle Kennzahlen bei zu kurzer Historie zurück", () => {
    const result = calculateHistoricalRiskMetrics({ candles: candles([100, 101, 99, 102]), provider: "Verified History" });

    expect(result.status).toBe("insufficient_data");
    expect(Object.values(result.metrics).every((value) => value === null)).toBe(true);
    expect(result.warnings[0]).toContain("mindestens 60");
  });

  it("blockiert Kennzahlen bei fehlendem Provider oder gescheiterter Integrität", () => {
    const closes = Array.from({ length: 90 }, (_, index) => 100 + index);

    expect(calculateHistoricalRiskMetrics({ candles: candles(closes), provider: null }).status).toBe("unavailable");
    expect(calculateHistoricalRiskMetrics({ candles: candles(closes), provider: "Provider", integrityBlocked: true }).status).toBe("unavailable");
  });

  it("dedupliziert Zeitstempel und ignoriert unbrauchbare Schlusskurse", () => {
    const input = candles(Array.from({ length: 70 }, (_, index) => 100 + index));
    input.push({ ...input[0], close: 0 });
    input.push({ ...input[1] });
    const result = calculateHistoricalRiskMetrics({ candles: input, provider: "Provider" });

    expect(result.status).toBe("available");
    expect(result.sampleSize).toBe(69);
  });
});
