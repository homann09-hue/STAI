import { describe, expect, it } from "vitest";
import { cleanCandles } from "@/lib/chart-data";
import type { Candle } from "@/lib/types";

const candle = (overrides: Partial<Candle> = {}): Candle => ({
  symbol: "AAPL",
  range: "1M",
  timestamp: "2024-01-02T00:00:00.000Z",
  time: "2024-01-02",
  open: 100,
  high: 105,
  low: 98,
  close: 103,
  volume: 1_000,
  ...overrides,
});

describe("chart candle boundary", () => {
  it("preserves valid OHLCV values and only canonicalizes the timestamp", () => {
    expect(cleanCandles([candle({ timestamp: "2024-01-02T00:00:00Z" })])).toEqual([
      candle(),
    ]);
  });

  it("rejects invalid rows instead of repairing their prices or volume", () => {
    expect(cleanCandles([
      candle({ high: 90 }),
      candle({ low: 110, timestamp: "2024-01-03T00:00:00Z" }),
      candle({ volume: -1, timestamp: "2024-01-04T00:00:00Z" }),
      candle({ timestamp: "invalid" }),
    ])).toEqual([]);
  });

  it("deduplicates the same symbol, range and interval timestamp", () => {
    expect(cleanCandles([candle(), candle({ close: 102 })])).toHaveLength(1);
  });
});
