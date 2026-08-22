import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNormalizedQuote } from "@/lib/canonical-quote";
import type { NormalizedQuote } from "@/lib/types";

const {
  getMarketDataProvider,
  streamQuotes,
  streamCanonicalQuotes,
  resolveCanonicalQuoteIdentities,
  logEvent,
} = vi.hoisted(() => ({
  getMarketDataProvider: vi.fn(),
  streamQuotes: vi.fn(),
  streamCanonicalQuotes: vi.fn(),
  resolveCanonicalQuoteIdentities: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("@/lib/providers/market-provider", () => ({ getMarketDataProvider }));
vi.mock("@/lib/instrument-master-store", () => ({
  resolveCanonicalQuoteIdentities,
}));
vi.mock("@/lib/observability", () => ({ logEvent }));
vi.mock("@/lib/api-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-guard")>();
  return { ...actual, rateLimit: vi.fn().mockResolvedValue(null) };
});

import { GET } from "./route";

function quote(
  symbol = "AAPL",
  currency = "USD",
  providerSymbol = symbol,
): NormalizedQuote {
  return buildNormalizedQuote({
    canonicalId: null,
    instrumentId: `provider:${symbol}`,
    symbol,
    assetType: "stock",
    providerId: "fmp",
    providerSymbol,
    venue: "XNAS",
    currency,
    price: symbol === "AAPL" ? 200 : 185,
    provider: "FMP",
    quality: "delayed",
    marketStatus: "closed",
    timestamp: "2026-08-22T10:00:00.000Z",
  });
}

function resolvedIdentity(
  canonicalId = "stock:xnas:aapl:usd",
  providerSymbol = "AAPL",
  internalInstrumentId = "instrument-us",
) {
  const [assetType, exchange, symbol, currency] = canonicalId.split(":");
  return {
    canonicalId,
    symbol: symbol.toUpperCase(),
    assetType,
    exchange: exchange.toUpperCase(),
    currency: currency.toUpperCase(),
    internalInstrumentId,
    providerMappings: [{ providerId: "fmp", providerSymbol }],
  };
}

function oneBatch(batch: NormalizedQuote[]) {
  return async function* () {
    yield batch;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  streamQuotes.mockImplementation(oneBatch([quote()]));
  streamCanonicalQuotes.mockImplementation(oneBatch([quote()]));
  resolveCanonicalQuoteIdentities.mockImplementation(
    async (identities: Array<{ canonicalId: string }>) => ({
      status: "ready",
      providerIds: ["fmp"],
      identities: identities.map((identity) =>
        resolvedIdentity(identity.canonicalId),
      ),
    }),
  );
  getMarketDataProvider.mockReturnValue({
    providerName: "FMP",
    providerId: "fmp",
    providerIds: ["fmp"],
    quality: "delayed",
    streamMode: "rest_polling",
    streamQuotes,
    streamCanonicalQuotes,
  });
});

afterEach(() => vi.useRealTimers());

async function call(query: string) {
  const response = await GET(
    new Request(`https://stockpilot.test/api/market/stream?${query}`),
  );
  return { response, body: await response.text() };
}

describe("GET /api/market/stream canonical identity", () => {
  it("streams through the exact Instrument-Master provider mapping", async () => {
    const { response, body } = await call(
      "canonicalIds=stock:xnas:aapl:usd&intervalMs=5000",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Identity-Mode")).toBe("canonical");
    expect(streamCanonicalQuotes).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          canonicalId: "stock:xnas:aapl:usd",
          internalInstrumentId: "instrument-us",
          providerMappings: [{ providerId: "fmp", providerSymbol: "AAPL" }],
        }),
      ],
      expect.objectContaining({ intervalMs: 5000 }),
    );
    expect(streamQuotes).not.toHaveBeenCalled();
    expect(body).toContain('"identityMode":"canonical"');
    expect(body).toContain('"canonicalId":"stock:xnas:aapl:usd"');
    expect(body).toContain('"instrumentId":"instrument-us"');
  });

  it("keeps same-symbol listings separate in one stream", async () => {
    const identities = [
      resolvedIdentity("stock:xnas:aapl:usd", "AAPL", "instrument-us"),
      resolvedIdentity("stock:xetr:aapl:eur", "AAPL.DE", "instrument-de"),
    ];
    resolveCanonicalQuoteIdentities.mockResolvedValue({
      status: "ready",
      providerIds: ["fmp"],
      identities,
    });
    streamCanonicalQuotes.mockImplementation(
      oneBatch([quote(), quote("AAPL", "EUR", "AAPL.DE")]),
    );
    const { response, body } = await call(
      "canonicalIds=stock:xnas:aapl:usd,stock:xetr:aapl:eur",
    );
    expect(response.status).toBe(200);
    expect(body).toContain('"canonicalId":"stock:xnas:aapl:usd"');
    expect(body).toContain('"canonicalId":"stock:xetr:aapl:eur"');
    expect(body).toContain('"instrumentId":"instrument-de"');
    expect(body).toContain('"currency":"EUR"');
  });

  it("fails closed before opening a stream when mapping evidence is unsafe", async () => {
    resolveCanonicalQuoteIdentities.mockResolvedValueOnce({
      status: "store_unavailable",
    });
    const unavailable = await call(
      "canonicalIds=stock:xnas:aapl:usd",
    );
    resolveCanonicalQuoteIdentities.mockResolvedValueOnce({
      status: "provider_symbol_collision",
      providerId: "fmp",
      providerSymbol: "AAPL",
      canonicalIds: [
        "stock:xnas:aapl:usd",
        "stock:xetr:aapl:eur",
      ],
    });
    const collision = await call(
      "canonicalIds=stock:xnas:aapl:usd,stock:xetr:aapl:eur",
    );
    expect([unavailable.response.status, collision.response.status]).toEqual([
      503,
      409,
    ]);
    expect(streamCanonicalQuotes).not.toHaveBeenCalled();
  });

  it("keeps the legacy path explicit, deduplicated and filtered", async () => {
    streamQuotes.mockImplementation(oneBatch([quote("AAPL"), quote("MSFT")]));
    const { response, body } = await call("symbols=AAPL,aapl");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Identity-Mode")).toBe(
      "legacy_symbol",
    );
    expect(streamQuotes).toHaveBeenCalledWith(["AAPL"], expect.any(Object));
    expect(body).toContain('"identityMode":"legacy_symbol"');
    expect(body).toContain('"droppedQuotes":1');
    expect(body).not.toContain('"symbol":"MSFT"');
  });

  it("validates empty, mixed, oversized and malformed selectors", async () => {
    const empty = await call("");
    const mixed = await call(
      "canonicalIds=stock:xnas:aapl:usd&symbols=AAPL",
    );
    const tooLong = await call(`canonicalIds=${"a".repeat(6_201)}`);
    const tooMany = await call(
      `symbols=${Array.from({ length: 31 }, (_, index) => `S${index}`).join(
        ",",
      )}`,
    );
    const invalidCanonical = await call("canonicalIds=not-canonical");
    const invalidSymbol = await call("symbols=%3Cscript%3E");
    expect([
      empty.response.status,
      mixed.response.status,
      tooLong.response.status,
      tooMany.response.status,
      invalidCanonical.response.status,
      invalidSymbol.response.status,
    ]).toEqual([400, 400, 400, 400, 400, 400]);
    expect(streamQuotes).not.toHaveBeenCalled();
    expect(streamCanonicalQuotes).not.toHaveBeenCalled();
  });

  it("emits a controlled error event when the canonical provider stream fails", async () => {
    streamCanonicalQuotes.mockReturnValue({
      [Symbol.asyncIterator]() {
        return {
          next: async () => {
            throw new Error("provider down");
          },
        };
      },
    });
    const { response, body } = await call(
      "canonicalIds=stock:xnas:aapl:usd",
    );
    expect(response.status).toBe(200);
    expect(body).toContain("event: error");
    expect(body).toContain("REST-Polling wechseln");
    expect(logEvent).toHaveBeenCalledWith(
      "error",
      "market.stream_failed",
      expect.any(Object),
    );
  });

  it("caps oversized legacy SSE events instead of emitting an unbounded payload", async () => {
    const symbols = Array.from({ length: 30 }, (_, index) => `S${index}`);
    const issues = Array.from(
      { length: 32 },
      (_, index) => `issue_${index}_${"x".repeat(60)}`,
    );
    const batch = symbols.map((symbol) =>
      buildNormalizedQuote({
        ...quote(symbol),
        sourceQualityIssues: issues,
      }),
    );
    streamQuotes.mockImplementation(oneBatch(batch));
    const { response, body } = await call(`symbols=${symbols.join(",")}`);
    expect(response.status).toBe(200);
    expect(body).toContain(
      "Stream-Payload wurde aus Sicherheitsgründen begrenzt",
    );
  });

  it("closes an aborted canonical client without reporting a provider incident", async () => {
    const requestController = new AbortController();
    streamCanonicalQuotes.mockImplementation(
      (_instruments: unknown[], options: { signal: AbortSignal }) => ({
        [Symbol.asyncIterator]() {
          return {
            next: () =>
              new Promise<never>((_resolve, reject) => {
                options.signal.addEventListener(
                  "abort",
                  () => reject(new Error("aborted")),
                  { once: true },
                );
              }),
          };
        },
      }),
    );
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/stream?canonicalIds=stock:xnas:aapl:usd",
        { signal: requestController.signal },
      ),
    );
    const reader = response.body?.getReader();
    expect((await reader?.read())?.done).toBe(false);
    requestController.abort();
    await reader?.read();
    expect(logEvent).toHaveBeenCalledWith("info", "market.stream_closed", {
      provider: "FMP",
      reason: "client_abort",
    });
  });

  it("emits heartbeats and closes cleanly at the bounded lifetime", async () => {
    vi.useFakeTimers();
    streamCanonicalQuotes.mockImplementation(
      (_instruments: unknown[], options: { signal: AbortSignal }) => ({
        [Symbol.asyncIterator]() {
          return {
            next: () =>
              new Promise<never>((_resolve, reject) => {
                options.signal.addEventListener(
                  "abort",
                  () => reject(new Error("lifetime")),
                  { once: true },
                );
              }),
          };
        },
      }),
    );
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/stream?canonicalIds=stock:xnas:aapl:usd",
      ),
    );
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let body = decoder.decode((await reader?.read())?.value);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    for (let index = 0; index < 30; index += 1) {
      const chunk = await reader?.read();
      if (!chunk || chunk.done) break;
      body += decoder.decode(chunk.value);
    }
    expect(body).toContain("event: heartbeat");
    expect(body).toContain("event: complete");
    expect(logEvent).toHaveBeenCalledWith("info", "market.stream_closed", {
      provider: "FMP",
      reason: "max_connection_ms",
    });
  });
});
