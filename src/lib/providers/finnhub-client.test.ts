import { afterEach, describe, expect, it, vi } from "vitest";

import { FinnhubClient, FinnhubClientError, streamFinnhubTrades, type FinnhubSocketLike } from "@/lib/providers/finnhub-client";

afterEach(() => vi.unstubAllGlobals());

describe("FinnhubClient", () => {
  it("keeps the REST key out of the URL and sends it as a server header", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).not.toContain("secret-key");
      expect(new Headers(init?.headers).get("X-Finnhub-Token")).toBe("secret-key");
      return new Response(JSON.stringify({ c: 225, d: 2, dp: 0.9, h: 226, l: 220, o: 221, pc: 223, t: 1_700_000_000 }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await new FinnhubClient({ apiKey: "secret-key" }).getQuote("AAPL");
    expect(result.quote?.price).toBe(225);
  });

  it("maps provider entitlement failures explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    await expect(new FinnhubClient({ apiKey: "secret-key" }).getPriceTarget("AAPL"))
      .rejects.toMatchObject({ code: "not_entitled", status: 403 });
  });

  it("rejects invalid symbols before calling Finnhub", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(new FinnhubClient({ apiKey: "secret-key" }).getQuote("<script>"))
      .rejects.toBeInstanceOf(FinnhubClientError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Finnhub trade stream", () => {
  it("subscribes once and emits normalized trades", async () => {
    const listeners = new Map<string, (event: { data?: unknown }) => void>();
    const sent: string[] = [];
    const socket: FinnhubSocketLike = {
      send: (data) => sent.push(data),
      close: () => undefined,
      addEventListener: (type, listener) => { listeners.set(type, listener); },
    };
    const controller = new AbortController();
    const stream = streamFinnhubTrades(["AAPL", "AAPL"], { apiKey: "secret-key", signal: controller.signal, socketFactory: () => socket, reconnectBaseMs: 1 });
    const iterator = stream[Symbol.asyncIterator]();
    const next = iterator.next();
    await Promise.resolve();
    listeners.get("open")?.({});
    listeners.get("message")?.({ data: JSON.stringify({ type: "trade", data: [{ s: "AAPL", p: 225, v: 2, t: 1_700_000_000_000 }] }) });
    const result = await Promise.race([
      next,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Trade-Stream-Testtimeout")), 1_000)),
    ]);
    expect(result.value?.[0]).toMatchObject({ symbol: "AAPL", price: 225, size: 2 });
    expect(sent).toEqual([JSON.stringify({ type: "subscribe", symbol: "AAPL" })]);
    controller.abort();
    await Promise.race([
      iterator.return?.(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Trade-Stream-Cleanup-Timeout")), 1_000)),
    ]);
  });
});
