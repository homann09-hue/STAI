import { describe, expect, it } from "vitest";

import { normalizeFinnhubQuote, normalizeFinnhubTrade } from "@/lib/providers/finnhub-normalization";

describe("Finnhub normalization", () => {
  it("normalizes a measured quote without inventing bid or ask", () => {
    expect(normalizeFinnhubQuote({ c: 225, d: 2, dp: 0.9, h: 226, l: 220, o: 221, pc: 223, t: 1_700_000_000 }))
      .toEqual({ price: 225, change: 2, changePercent: 0.9, high: 226, low: 220, open: 221, previousClose: 223, timestamp: "2023-11-14T22:13:20.000Z" });
  });

  it("treats Finnhub's zero quote as no data", () => {
    expect(normalizeFinnhubQuote({ c: 0, t: 0 })).toBeNull();
  });

  it("normalizes websocket messages as trades, not quotes", () => {
    const trade = normalizeFinnhubTrade(
      { s: "BINANCE:BTCUSDT", p: 64000, v: 0.25, t: 1_700_000_000_000, c: ["1"] },
      { quality: "near_realtime", receivedAt: new Date("2026-08-16T12:00:00Z") },
    );
    expect(trade).toMatchObject({ providerId: "finnhub", symbol: "BINANCE:BTCUSDT", venue: "BINANCE", price: 64000, size: 0.25, feedType: "NEAR_REALTIME", isRealtime: false });
    expect(trade?.qualityIssues.join(" ")).toContain("keine Bid/Ask-Quotes");
  });
});
