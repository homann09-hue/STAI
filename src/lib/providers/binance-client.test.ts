import { describe, expect, it, vi } from "vitest";

import { BinanceStreamHub, type BinanceSocketLike } from "@/lib/providers/binance-client";

function fakeSocket() {
  const listeners = new Map<string, (event: { data?: unknown }) => void>();
  const sent: string[] = [];
  const socket: BinanceSocketLike = {
    send: (data) => sent.push(data),
    close: () => undefined,
    addEventListener: (type, listener) => listeners.set(type, listener),
  };
  return { socket, sent, listeners };
}

describe("BinanceStreamHub", () => {
  it("shares one combined upstream connection for quotes and trades", async () => {
    const fake = fakeSocket();
    const factory = vi.fn(() => fake.socket);
    const hub = new BinanceStreamHub({ socketFactory: factory, inactivityTimeoutMs: 60_000 });
    const quoteAbort = new AbortController();
    const tradeAbort = new AbortController();
    const quoteIterator = hub.subscribeQuotes(["BTCUSDT"], { signal: quoteAbort.signal, resolveSymbol: () => "BTC-USD" })[Symbol.asyncIterator]();
    const tradeIterator = hub.subscribeTrades(["BTCUSDT"], { signal: tradeAbort.signal, resolveSymbol: () => "BTC-USD" })[Symbol.asyncIterator]();
    const quoteNext = quoteIterator.next();
    const tradeNext = tradeIterator.next();
    await Promise.resolve();
    fake.listeners.get("open")?.({});
    const subscription = JSON.parse(fake.sent[0]);
    expect(subscription.params.sort()).toEqual(["btcusdt@bookTicker", "btcusdt@ticker", "btcusdt@trade"].sort());
    fake.listeners.get("message")?.({ data: JSON.stringify({ stream: "btcusdt@ticker", data: { e: "24hrTicker", E: 1_786_944_000_000, s: "BTCUSDT", p: "1000", P: "1.5", w: "60500", c: "61000", Q: "0.2", b: "60999", B: "1.2", a: "61001", A: "0.8", o: "60000", h: "62000", l: "59000", v: "100", q: "6050000", L: 99 } }) });
    fake.listeners.get("message")?.({ data: JSON.stringify({ stream: "btcusdt@trade", data: { e: "trade", E: 1_786_944_000_010, s: "BTCUSDT", t: 100, p: "61000", q: "0.1", T: 1_786_944_000_009, m: true } }) });
    await expect(quoteNext).resolves.toMatchObject({ value: [{ symbol: "BTC-USD", providerId: "binance" }] });
    await expect(tradeNext).resolves.toMatchObject({ value: [{ symbol: "BTC-USD", tradeId: "100" }] });
    expect(factory).toHaveBeenCalledTimes(1);
    quoteAbort.abort();
    tradeAbort.abort();
    await quoteIterator.return?.();
    await tradeIterator.return?.();
    hub.close();
  });

  it("rejects subscriptions beyond the configured shared capacity", async () => {
    const fake = fakeSocket();
    const hub = new BinanceStreamHub({ socketFactory: () => fake.socket, maxSymbols: 1 });
    const controller = new AbortController();
    const first = hub.subscribeQuotes(["BTCUSDT"], { signal: controller.signal })[Symbol.asyncIterator]();
    void first.next();
    await Promise.resolve();
    const second = hub.subscribeQuotes(["ETHUSDT"])[Symbol.asyncIterator]();
    await expect(second.next()).rejects.toMatchObject({ code: "capacity" });
    controller.abort();
    await first.return?.();
    hub.close();
  });
});
