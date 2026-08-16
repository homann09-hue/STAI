import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlpacaClient,
  AlpacaClientError,
  type AlpacaWebSocket,
  resetAlpacaStreamLeaseForTests,
  streamAlpacaMarketData,
} from "@/lib/providers/alpaca-client";
import { resetProviderResilienceForTests } from "@/lib/provider-resilience";

const snapshot = {
  latestTrade: { t: "2026-08-14T15:30:00Z", x: "V", p: 221.5, s: 10, i: 1, c: ["@"], z: "C" },
  latestQuote: { t: "2026-08-14T15:30:00Z", ax: "V", ap: 221.52, as: 4, bx: "V", bp: 221.48, bs: 7, c: ["R"], z: "C" },
  minuteBar: null,
  dailyBar: { t: "2026-08-14T15:30:00Z", o: 219, h: 223, l: 218, c: 221.5, v: 1_000, n: 200, vw: 220.4 },
  prevDailyBar: { t: "2026-08-13T20:00:00Z", o: 217, h: 220, l: 216, c: 219, v: 900, n: 180, vw: 218 },
};
const clock = {
  timestamp: "2026-08-14T15:30:00Z",
  is_open: true,
  next_open: "2026-08-17T13:30:00Z",
  next_close: "2026-08-14T20:00:00Z",
};

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ALPACA_API_KEY_ID", "key-id");
  vi.stubEnv("ALPACA_API_SECRET_KEY", "secret-key");
  vi.stubEnv("ALPACA_DATA_FEED", "iex");
  resetAlpacaStreamLeaseForTests();
  await resetProviderResilienceForTests();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.stubEnv("NODE_ENV", "test");
  resetAlpacaStreamLeaseForTests();
  await resetProviderResilienceForTests();
  vi.unstubAllEnvs();
});

describe("Alpaca REST client", () => {
  it("keeps credentials in official headers and normalizes a snapshot plus market clock", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo, _init?: RequestInit) =>
      String(input).includes("/clock") ? json(clock) : json(snapshot, 200, {
        "x-ratelimit-limit": "200",
        "x-ratelimit-remaining": "199",
        "x-ratelimit-reset": "1786721400",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AlpacaClient().getSnapshot("AAPL");
    expect(result.data).toMatchObject({ providerId: "alpaca", bidSize: 7, askSize: 4, marketStatus: "open" });
    const snapshotCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/snapshot"));
    expect(String(snapshotCall?.[0])).not.toContain("secret-key");
    expect(snapshotCall?.[1]?.headers).toMatchObject({
      "APCA-API-KEY-ID": "key-id",
      "APCA-API-SECRET-KEY": "secret-key",
    });
    expect(result.quota).toMatchObject({ limit: 200, remaining: 199 });
  });

  it("loads several symbols in one snapshot batch", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) =>
      String(input).includes("/clock") ? json(clock) : json({ AAPL: snapshot, MSFT: { ...snapshot, latestTrade: { ...snapshot.latestTrade, p: 510 } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new AlpacaClient().getSnapshots(["AAPL", "MSFT", "AAPL"]);
    expect(result.data.map((quote) => quote.symbol)).toEqual(["AAPL", "MSFT"]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/snapshots"))).toHaveLength(1);
  });

  it("loads latest trades without inventing quote fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ trades: { AAPL: snapshot.latestTrade } })));
    const result = await new AlpacaClient().getLatestTrades(["AAPL"]);
    expect(result.data[0]).toMatchObject({ symbol: "AAPL", price: 221.5, venue: "IEX" });
  });

  it("paginates raw historical bars with a fixed feed and adjustment", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const second = url.searchParams.has("page_token");
      return json({
        bars: [{ t: second ? "2026-08-14T15:31:00Z" : "2026-08-14T15:30:00Z", o: 220, h: 222, l: 219, c: second ? 222 : 221, v: 100, n: 5, vw: 220.5 }],
        symbol: "AAPL",
        next_page_token: second ? null : "next",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await new AlpacaClient().getHistoricalBars("AAPL", "1m", { limit: 3, now: new Date("2026-08-14T16:00:00Z") });
    expect(result.data.bars).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [input] of fetchMock.mock.calls) {
      const url = new URL(String(input));
      expect(url.searchParams.get("feed")).toBe("iex");
      expect(url.searchParams.get("adjustment")).toBe("raw");
    }
  });

  it("standardizes entitlement and rate-limit failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "forbidden" }, 403)));
    await expect(new AlpacaClient().getLatestTrades(["AAPL"])).rejects.toMatchObject({ code: "not_entitled" } satisfies Partial<AlpacaClientError>);
    await resetProviderResilienceForTests();
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "rate" }, 429, { "retry-after": "2" })));
    await expect(new AlpacaClient().getLatestTrades(["AAPL"])).rejects.toMatchObject({ code: "rate_limited", retryAfterMs: 2_000 } satisfies Partial<AlpacaClientError>);
  });
});

type Listener = (event: never) => void;

class FakeSocket implements AlpacaWebSocket {
  readyState = 1;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  emit(type: "open" | "message" | "error" | "close", data?: unknown) {
    if (type === "close") this.readyState = 3;
    const event = type === "message" ? { data: JSON.stringify(data) } : {};
    for (const listener of this.listeners.get(type) ?? []) listener(event as never);
  }
}

async function waitForSocket(sockets: FakeSocket[], count: number) {
  await vi.waitFor(() => expect(sockets).toHaveLength(count));
  return sockets[count - 1];
}

describe("Alpaca WebSocket lifecycle", () => {
  it("authenticates, subscribes multiple symbols and emits normalized quote and trade batches", async () => {
    const sockets: FakeSocket[] = [];
    const controller = new AbortController();
    const iterator = streamAlpacaMarketData(["AAPL", "MSFT"], {
      signal: controller.signal,
      quotes: true,
      trades: true,
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    })[Symbol.asyncIterator]();
    const next = iterator.next();
    const socket = await waitForSocket(sockets, 1);
    socket.emit("open");
    expect(JSON.parse(socket.sent[0])).toEqual({ action: "auth", key: "key-id", secret: "secret-key" });
    socket.emit("message", [{ T: "success", msg: "authenticated" }]);
    expect(JSON.parse(socket.sent[1])).toEqual({ action: "subscribe", quotes: ["AAPL", "MSFT"], trades: ["AAPL", "MSFT"] });
    socket.emit("message", [{ T: "q", S: "AAPL", ...snapshot.latestQuote }]);
    socket.emit("message", [{ T: "t", S: "AAPL", ...snapshot.latestTrade }]);
    const batch = await next;
    expect(batch.value?.quotes[0]).toMatchObject({ symbol: "AAPL", bid: 221.48, ask: 221.52 });
    expect(batch.value?.trades[0]).toMatchObject({ symbol: "AAPL", price: 221.5 });
    controller.abort();
    await iterator.return?.();
  });

  it("reconnects and resubscribes after an ordinary disconnect", async () => {
    const sockets: FakeSocket[] = [];
    const controller = new AbortController();
    const iterator = streamAlpacaMarketData(["AAPL"], {
      signal: controller.signal,
      reconnectBaseMs: 10,
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    })[Symbol.asyncIterator]();
    const pending = iterator.next();
    const first = await waitForSocket(sockets, 1);
    first.emit("open");
    first.emit("message", [{ T: "success", msg: "authenticated" }]);
    first.emit("close");
    const second = await waitForSocket(sockets, 2);
    second.emit("open");
    second.emit("message", [{ T: "success", msg: "authenticated" }]);
    expect(JSON.parse(second.sent[1])).toMatchObject({ action: "subscribe", quotes: ["AAPL"], trades: ["AAPL"] });
    controller.abort();
    await pending;
  });

  it("fails closed on provider symbol limits instead of reconnecting forever", async () => {
    const sockets: FakeSocket[] = [];
    const iterator = streamAlpacaMarketData(["AAPL"], {
      socketFactory: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
    })[Symbol.asyncIterator]();
    const next = iterator.next();
    const socket = await waitForSocket(sockets, 1);
    socket.emit("open");
    socket.emit("message", [{ T: "error", code: 405, msg: "symbol limit exceeded" }]);
    await expect(next).rejects.toMatchObject({ code: "symbol_limit" });
    expect(sockets).toHaveLength(1);
  });

  it("enforces the configured symbol limit before opening a connection", async () => {
    vi.stubEnv("ALPACA_STREAM_MAX_SYMBOLS", "1");
    const iterator = streamAlpacaMarketData(["AAPL", "MSFT"], {
      socketFactory: () => new FakeSocket(),
    })[Symbol.asyncIterator]();
    await expect(iterator.next()).rejects.toMatchObject({ code: "symbol_limit" });
  });
});
