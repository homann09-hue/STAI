import { describe, expect, it } from "vitest";

import { normalizeBinanceKline, normalizeBinanceQuote, normalizeBinanceTrade } from "@/lib/providers/binance-normalization";

const ticker = {
  e: "24hrTicker", E: 1_786_944_000_000, s: "BTCUSDT", p: "1000", P: "1.5", w: "60500", c: "61000", Q: "0.2",
  b: "60999", B: "1.2", a: "61001", A: "0.8", o: "60000", h: "62000", l: "59000", v: "100", q: "6050000", L: 99,
};

describe("Binance stream normalization", () => {
  it("keeps Binance venue identity and USDT currency visible", () => {
    const quote = normalizeBinanceQuote(ticker, { u: 7, s: "BTCUSDT", b: "60999.5", B: "2", a: "61000.5", A: "3" }, {
      quality: "near_realtime",
      receivedAt: new Date(1_786_944_000_080),
      resolveSymbol: () => "BTC-USD",
    });
    expect(quote).toMatchObject({ symbol: "BTC-USD", providerSymbol: "BTCUSDT", currency: "USDT", bid: 60_999.5, ask: 61_000.5, spread: 1, latencyMs: 80 });
    expect(quote?.qualityIssues).toContain("requested_usd_mapped_to_usdt");
  });

  it("normalizes trades without turning them into quotes", () => {
    const trade = normalizeBinanceTrade({ e: "trade", E: 1_786_944_000_010, s: "BTCUSDT", t: 100, p: "61000", q: "0.1", T: 1_786_944_000_009, m: true }, { resolveSymbol: () => "BTC-USD" });
    expect(trade).toMatchObject({ symbol: "BTC-USD", tradeId: "100", price: 61_000, size: 0.1, conditions: ["BUYER_MAKER"] });
  });

  it("normalizes open one-minute candles as raw venue bars", () => {
    const bar = normalizeBinanceKline({
      e: "kline", E: 1_786_944_030_000, s: "BTCUSDT",
      k: { t: 1_786_944_000_000, T: 1_786_944_059_999, s: "BTCUSDT", i: "1m", f: 1, L: 4, o: "60000", c: "61000", h: "62000", l: "59000", v: "10", n: 4, x: false, q: "605000" },
    }, { receivedAt: new Date(1_786_944_030_050), resolveSymbol: () => "BTC-USD" });
    expect(bar).toMatchObject({ symbol: "BTC-USD", interval: "1m", currency: "USDT", isAdjusted: false, adjustmentType: "RAW" });
    expect(bar?.qualityIssues).toContain("open_candle");
  });
});
