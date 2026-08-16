import { describe, expect, it } from "vitest";

import {
  alpacaFeedMetadata,
  normalizeAlpacaBars,
  normalizeAlpacaSnapshot,
  normalizeAlpacaTrade,
} from "@/lib/providers/alpaca-normalization";

const now = new Date("2026-08-14T15:30:01.000Z");
const trade = {
  t: "2026-08-14T15:30:00.000Z",
  x: "V",
  p: 221.5,
  s: 10,
  i: 99,
  c: ["@"],
  z: "C",
};
const quote = {
  t: "2026-08-14T15:30:00.100Z",
  ax: "V",
  ap: 221.52,
  as: 4,
  bx: "V",
  bp: 221.48,
  bs: 7,
  c: ["R"],
  z: "C",
};

describe("Alpaca normalization", () => {
  it("preserves IEX bid/ask sizes while declaring the single-venue limitation", () => {
    const normalized = normalizeAlpacaSnapshot(
      "AAPL",
      {
        latestTrade: trade,
        latestQuote: quote,
        minuteBar: null,
        dailyBar: { t: trade.t, o: 219, h: 223, l: 218, c: 221.5, v: 1_000, n: 200, vw: 220.4 },
        prevDailyBar: { t: "2026-08-13T20:00:00Z", o: 217, h: 220, l: 216, c: 219, v: 900, n: 180, vw: 218 },
      },
      {
        feed: "iex",
        latencyMs: 18,
        clock: {
          timestamp: now.toISOString(),
          is_open: true,
          next_open: "2026-08-17T13:30:00Z",
          next_close: "2026-08-14T20:00:00Z",
        },
        now,
      },
    );

    expect(normalized).toMatchObject({
      providerId: "alpaca",
      provider: "Alpaca IEX (einzelner Handelsplatz)",
      venue: "IEX",
      bid: 221.48,
      bidSize: 7,
      ask: 221.52,
      askSize: 4,
      last: 221.5,
      marketSession: "REGULAR",
      marketStatus: "open",
      feedType: "REALTIME",
      reportedDelaySeconds: 0,
      isRealtime: true,
    });
    expect(normalized?.qualityIssues).toContain("single_venue_feed");
  });

  it("never labels delayed SIP as realtime", () => {
    const normalized = normalizeAlpacaSnapshot(
      "AAPL",
      { latestTrade: trade, latestQuote: quote, minuteBar: null, dailyBar: null, prevDailyBar: null },
      { feed: "delayed_sip", latencyMs: 20, now },
    );
    expect(normalized).toMatchObject({
      quality: "delayed",
      feedType: "DELAYED",
      reportedDelaySeconds: 900,
      isRealtime: false,
    });
  });

  it("normalizes raw bars and rejects no OHLC facts", () => {
    const result = normalizeAlpacaBars(
      "AAPL",
      [{ t: "2026-08-14T15:30:00Z", o: 220, h: 222, l: 219, c: 221, v: 1_000, n: 44, vw: 220.7 }],
      { feed: "iex", interval: "1m", now },
    );
    expect(result.bars[0]).toMatchObject({
      providerId: "alpaca",
      venue: "IEX",
      interval: "1m",
      open: 220,
      high: 222,
      low: 219,
      close: 221,
      tradeCount: 44,
      vwap: 220.7,
      adjustmentType: "RAW",
      isAdjusted: false,
    });
    expect(result.quality.rejected).toBe(0);
  });

  it("normalizes trades with venue, conditions and feed provenance", () => {
    expect(normalizeAlpacaTrade("AAPL", trade, "iex", now)).toMatchObject({
      symbol: "AAPL",
      providerId: "alpaca",
      venue: "IEX",
      price: 221.5,
      size: 10,
      tradeId: "99",
      conditions: ["@"],
      isRealtime: true,
    });
    expect(alpacaFeedMetadata("iex").providerLabel).toContain("einzelner Handelsplatz");
  });
});
