import { describe, expect, it } from "vitest";

import {
  isCoinbaseStreamProductSupported,
  normalizeCoinbaseTickerMessage,
} from "@/lib/providers/coinbase-normalization";

const message = {
  channel: "ticker",
  timestamp: "2026-08-17T12:00:00.000Z",
  sequence_num: 42,
  events: [
    {
      type: "update",
      tickers: [
        {
          type: "ticker",
          product_id: "BTC-USD",
          price: "60000",
          volume_24_h: "123.45",
          low_24_h: "59000",
          high_24_h: "61000",
          low_52_w: "30000",
          high_52_w: "70000",
          price_percent_chg_24_h: "2.5",
          best_bid: "59999",
          best_bid_quantity: "1.2",
          best_ask: "60001",
          best_ask_quantity: "0.8",
        },
      ],
    },
  ],
};

describe("Coinbase ticker normalization", () => {
  it("normalizes verified ticker fields without inventing missing values", () => {
    const result = normalizeCoinbaseTickerMessage(message, {
      quality: "near_realtime",
      receivedAt: new Date("2026-08-17T12:00:00.080Z"),
    });
    expect(result?.sequenceNumber).toBe(42);
    expect(result?.quotes[0]).toMatchObject({
      symbol: "BTC-USD",
      providerId: "coinbase",
      providerSymbol: "BTC-USD",
      price: 60_000,
      bid: 59_999,
      ask: 60_001,
      spread: 2,
      volume: 123.45,
      quality: "near_realtime",
      latencyMs: 80,
      marketStatus: "open",
    });
    expect(result?.quotes[0].open).toBeNull();
  });

  it("rejects malformed payloads and non-positive prices", () => {
    expect(normalizeCoinbaseTickerMessage({ channel: "ticker" })).toBeNull();
    expect(
      normalizeCoinbaseTickerMessage({
        ...message,
        events: [
          {
            type: "update",
            tickers: [{ product_id: "BTC-USD", price: "0" }],
          },
        ],
      })?.quotes,
    ).toEqual([]);
  });

  it("does not silently remap ordinary USDC products to USD", () => {
    expect(isCoinbaseStreamProductSupported("BTC-USDC")).toBe(false);
    expect(isCoinbaseStreamProductSupported("USDT-USDC")).toBe(true);
    expect(isCoinbaseStreamProductSupported("BTC-USD")).toBe(true);
    expect(isCoinbaseStreamProductSupported("<script>")) .toBe(false);
  });
});
