import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CoinbaseStreamHub,
  type CoinbaseSocketLike,
} from "@/lib/providers/coinbase-client";

afterEach(() => vi.useRealTimers());

function fakeSocket() {
  const listeners = new Map<string, (event: { data?: unknown }) => void>();
  const sent: string[] = [];
  const socket: CoinbaseSocketLike = {
    send: (data) => sent.push(data),
    close: () => undefined,
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  return { socket, sent, listeners };
}

function ticker(sequenceNumber = 1) {
  return JSON.stringify({
    channel: "ticker",
    timestamp: "2026-08-17T12:00:00.000Z",
    sequence_num: sequenceNumber,
    events: [
      {
        type: "update",
        tickers: [
          { product_id: "BTC-USD", price: "60000", best_bid: "59999", best_ask: "60001" },
          { product_id: "ETH-USD", price: "3000", best_bid: "2999", best_ask: "3001" },
        ],
      },
    ],
  });
}

describe("CoinbaseStreamHub", () => {
  it("shares one upstream socket and filters batches per subscriber", async () => {
    const fake = fakeSocket();
    const factory = vi.fn(() => fake.socket);
    const hub = new CoinbaseStreamHub({ socketFactory: factory, heartbeatTimeoutMs: 60_000 });
    const firstAbort = new AbortController();
    const secondAbort = new AbortController();
    const first = hub.subscribe(["BTC-USD"], { signal: firstAbort.signal })[Symbol.asyncIterator]();
    const second = hub.subscribe(["ETH-USD"], { signal: secondAbort.signal })[Symbol.asyncIterator]();
    const firstNext = first.next();
    const secondNext = second.next();
    await Promise.resolve();
    fake.listeners.get("open")?.({});
    fake.listeners.get("message")?.({ data: ticker() });

    await expect(firstNext).resolves.toMatchObject({ value: [{ symbol: "BTC-USD" }] });
    await expect(secondNext).resolves.toMatchObject({ value: [{ symbol: "ETH-USD" }] });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(fake.sent.map((value) => JSON.parse(value))).toEqual([
      { type: "subscribe", channel: "heartbeats" },
      { type: "subscribe", product_ids: ["BTC-USD", "ETH-USD"], channel: "ticker" },
    ]);

    firstAbort.abort();
    secondAbort.abort();
    await first.return?.();
    await second.return?.();
    hub.close();
  });

  it("fails closed when the shared product capacity would be exceeded", async () => {
    const fake = fakeSocket();
    const hub = new CoinbaseStreamHub({ socketFactory: () => fake.socket, maxSymbols: 1 });
    const controller = new AbortController();
    const first = hub.subscribe(["BTC-USD"], { signal: controller.signal })[Symbol.asyncIterator]();
    void first.next();
    await Promise.resolve();
    const second = hub.subscribe(["ETH-USD"])[Symbol.asyncIterator]();
    await expect(second.next()).rejects.toMatchObject({ code: "capacity" });
    controller.abort();
    await first.return?.();
    hub.close();
  });
});
