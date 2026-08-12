import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetProviderResilienceForTests } from "@/lib/provider-resilience";
import {
  getTwelveDataApiKey,
  streamTwelveDataQuotes,
  TwelveDataClient,
  TwelveDataClientError,
  type TwelveDataWebSocket,
} from "@/lib/providers/twelve-data-client";

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("TWELVE_DATA_API_KEY", "server-secret");
  await resetProviderResilienceForTests();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await resetProviderResilienceForTests();
});

function jsonResponse(value: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("Twelve Data server client", () => {
  it("keeps the key out of the URL and captures only safe quota headers", async () => {
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) =>
      jsonResponse(
        {
          symbol: "AAPL",
          close: "229.65",
          currency: "USD",
          timestamp: 1786553940,
        },
        { "api-credits-used": "1", "api-credits-left": "7" },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new TwelveDataClient().getQuote(
      "AAPL",
      "near_realtime",
      new Date("2026-08-12T18:00:00.000Z"),
    );
    const [url, init] = fetchMock.mock.calls[0];

    expect(String(url)).not.toContain("server-secret");
    expect(String(url)).toContain("/quote?symbol=AAPL");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "apikey server-secret",
    );
    expect(result.quota).toEqual({ used: 1, left: 7 });
    expect(JSON.stringify(result)).not.toContain("server-secret");
  });

  it("uses the official comma batch and enforces the configured credit cap", async () => {
    vi.stubEnv("TWELVE_DATA_BATCH_MAX_SYMBOLS", "2");
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, _init?: RequestInit) =>
      jsonResponse({
        AAPL: { symbol: "AAPL", close: "220", currency: "USD" },
        MSFT: { symbol: "MSFT", close: "510", currency: "USD" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new TwelveDataClient().getQuotes(
      ["AAPL", "MSFT", "NVDA"],
      "near_realtime",
    );
    const url = new URL(String(fetchMock.mock.calls[0][0]));

    expect(url.searchParams.get("symbol")).toBe("AAPL,MSFT");
    expect(result.data.map((quote) => quote.symbol)).toEqual(["AAPL", "MSFT"]);
  });

  it.each([
    [401, "authentication"],
    [403, "not_entitled"],
    [404, "not_found"],
    [429, "rate_limited"],
    [503, "unavailable"],
  ] as const)("standardizes body error %s as %s", async (status, code) => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ status: "error", code, message: "provider detail" }),
    );
    // The provider sends the numeric status, not our expected code string.
    fetchMock.mockImplementation(async () =>
      jsonResponse({ status: "error", code: status, message: "provider detail" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new TwelveDataClient().getQuote("AAPL", "near_realtime"),
    ).rejects.toMatchObject({
      name: "TwelveDataClientError",
      code,
      status,
    } satisfies Partial<TwelveDataClientError>);
    if (status === 429) expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed successful payloads and unsafe input", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ status: "ok" })));
    await expect(new TwelveDataClient().searchInstruments("AAPL")).rejects.toMatchObject({
      code: "invalid_response",
    });
    await expect(
      new TwelveDataClient().getQuote("../../secret", "near_realtime"),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("accepts the legacy server-side key alias but fails closed without a key", () => {
    delete process.env.TWELVE_DATA_API_KEY;
    vi.stubEnv("TWELVEDATA_API_KEY", "legacy-secret");
    expect(getTwelveDataApiKey()).toBe("legacy-secret");
    delete process.env.TWELVEDATA_API_KEY;
    expect(() => new TwelveDataClient()).toThrow("TWELVE_DATA_API_KEY fehlt");
  });
});

describe("Twelve Data WebSocket", () => {
  it("reconnects, resubscribes and emits only normalized price events", async () => {
    vi.useFakeTimers();
    vi.stubEnv("TWELVE_DATA_STREAM_ENABLED", "true");
    const sockets: Array<{
      socket: TwelveDataWebSocket;
      sent: string[];
      emit: (type: string, value?: unknown) => void;
      url: string;
    }> = [];
    const socketFactory = (url: string) => {
      const listeners = new Map<string, Array<(event: unknown) => void>>();
      const sent: string[] = [];
      let readyState = 0;
      const socket = {
        get readyState() {
          return readyState;
        },
        addEventListener(type: string, listener: (event: unknown) => void) {
          listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        },
        send(value: string) {
          sent.push(value);
        },
        close() {
          readyState = 3;
        },
      } as TwelveDataWebSocket;
      const emit = (type: string, value?: unknown) => {
        if (type === "open") readyState = 1;
        if (type === "close" || type === "error") readyState = 3;
        const event =
          type === "message" ? { data: JSON.stringify(value) } : ({} as Event);
        for (const listener of listeners.get(type) ?? []) listener(event);
      };
      sockets.push({ socket, sent, emit, url });
      return socket;
    };
    const controller = new AbortController();
    const removeAbortListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );
    const iterator = streamTwelveDataQuotes(["AAPL"], {
      quality: "near_realtime",
      signal: controller.signal,
      socketFactory,
      reconnectBaseMs: 250,
    })[Symbol.asyncIterator]();
    const next = iterator.next();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].emit("open");
    sockets[0].emit("close");
    await vi.advanceTimersByTimeAsync(500);
    sockets[1].emit("open");
    sockets[1].emit("message", {
      event: "price",
      symbol: "AAPL",
      price: 230.5,
      timestamp: 1786553940,
      day_volume: 1000,
      currency: "USD",
      exchange: "NASDAQ",
    });

    await expect(next).resolves.toMatchObject({
      done: false,
      value: [
        expect.objectContaining({
          symbol: "AAPL",
          price: 230.5,
          providerId: "twelve_data",
        }),
      ],
    });
    expect(sockets).toHaveLength(2);
    expect(sockets[1].sent[0]).toContain('"action":"subscribe"');
    expect(sockets[1].url).toContain("apikey=server-secret");
    controller.abort();
    await iterator.return?.();
    expect(removeAbortListener).toHaveBeenCalledTimes(2);
    expect(removeAbortListener).toHaveBeenLastCalledWith(
      "abort",
      expect.any(Function),
    );
  });
});
