import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getQuotes,
  getCanonicalQuotes,
  resolveCanonicalQuoteIdentities,
  withCacheFallback,
} = vi.hoisted(() => ({
  getQuotes: vi.fn(),
  getCanonicalQuotes: vi.fn(),
  resolveCanonicalQuoteIdentities: vi.fn(),
  withCacheFallback: vi.fn(),
}));

vi.mock("@/lib/providers/market-provider", () => ({
  getMarketDataProvider: () => ({
    providerId: "fmp",
    providerIds: ["fmp", "twelve_data"],
    providerName: "FMP",
    streamMode: "rest_polling",
    getQuotes,
    getCanonicalQuotes,
  }),
}));
vi.mock("@/lib/instrument-master-store", () => ({
  resolveCanonicalQuoteIdentities,
}));
vi.mock("@/lib/provider-cache", () => ({ withCacheFallback }));
vi.mock("@/lib/api-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-guard")>();
  return { ...actual, rateLimit: vi.fn().mockResolvedValue(null) };
});

import { GET } from "./route";

const providerQuote = {
  symbol: "AAPL",
  providerId: "fmp",
  providerSymbol: "AAPL",
  provider: "FMP",
  price: 200,
  currency: "USD",
  quality: "delayed",
  marketStatus: "closed",
  timestamp: "2026-08-22T10:00:00.000Z",
};

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

beforeEach(() => {
  vi.clearAllMocks();
  resolveCanonicalQuoteIdentities.mockImplementation(
    async (identities: Array<{ canonicalId: string }>) => ({
      status: "ready",
      providerIds: ["fmp"],
      identities: identities.map((identity) =>
        resolvedIdentity(identity.canonicalId),
      ),
    }),
  );
  getQuotes.mockResolvedValue([providerQuote]);
  getCanonicalQuotes.mockResolvedValue([providerQuote]);
  withCacheFallback.mockImplementation(
    async (_key: string, loader: () => Promise<unknown>) => ({
      value: await loader(),
      fromCache: false,
      cacheStoredAt: null,
      warning: null,
    }),
  );
});

describe("GET /api/market/quotes canonical identity", () => {
  it("uses the Instrument-Master mapping and binds the internal instrument ID", async () => {
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Identity-Mode")).toBe("canonical");
    expect(resolveCanonicalQuoteIdentities).toHaveBeenCalledWith(
      [expect.objectContaining({ canonicalId: "stock:xnas:aapl:usd" })],
      ["fmp", "twelve_data"],
    );
    expect(getCanonicalQuotes).toHaveBeenCalledWith([
      expect.objectContaining({
        internalInstrumentId: "instrument-us",
        providerMappings: [{ providerId: "fmp", providerSymbol: "AAPL" }],
      }),
    ]);
    expect(getQuotes).not.toHaveBeenCalled();
    expect(body.quotes[0]).toMatchObject({
      canonicalId: "stock:xnas:aapl:usd",
      instrumentId: "instrument-us",
      symbol: "AAPL",
    });
  });

  it("keeps same-symbol listings separate through distinct provider symbols and cache identity", async () => {
    const identities = [
      resolvedIdentity("stock:xnas:aapl:usd", "AAPL", "instrument-us"),
      resolvedIdentity("stock:xetr:aapl:eur", "AAPL.DE", "instrument-de"),
    ];
    resolveCanonicalQuoteIdentities.mockResolvedValue({
      status: "ready",
      providerIds: ["fmp"],
      identities,
    });
    getCanonicalQuotes.mockResolvedValue([
      providerQuote,
      {
        ...providerQuote,
        symbol: "AAPL.DE",
        providerSymbol: "AAPL.DE",
        price: 185,
        currency: "EUR",
      },
    ]);
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd,stock:xetr:aapl:eur",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quotes).toEqual([
      expect.objectContaining({
        canonicalId: "stock:xnas:aapl:usd",
        instrumentId: "instrument-us",
        currency: "USD",
      }),
      expect.objectContaining({
        canonicalId: "stock:xetr:aapl:eur",
        instrumentId: "instrument-de",
        currency: "EUR",
      }),
    ]);
    expect(withCacheFallback.mock.calls[0][0]).toContain(
      "fmp=AAPL.DE",
    );
  });

  it("fails closed for unavailable reference data and unsafe mappings", async () => {
    resolveCanonicalQuoteIdentities.mockResolvedValueOnce({
      status: "store_unavailable",
    });
    const unavailable = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd",
      ),
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
    const collision = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd,stock:xetr:aapl:eur",
      ),
    );
    expect([unavailable.status, collision.status]).toEqual([503, 409]);
    expect(getCanonicalQuotes).not.toHaveBeenCalled();
  });

  it("returns not-found separately from an unavailable store", async () => {
    resolveCanonicalQuoteIdentities.mockResolvedValue({
      status: "instrument_not_found",
      canonicalIds: ["stock:xnas:missing:usd"],
    });
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:missing:usd",
      ),
    );
    expect(response.status).toBe(404);
  });

  it("rejects mixed, empty, oversized and malformed selectors", async () => {
    const mixed = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd&symbols=AAPL",
      ),
    );
    const empty = await GET(
      new Request("https://stockpilot.test/api/market/quotes"),
    );
    const oversized = await GET(
      new Request(
        `https://stockpilot.test/api/market/quotes?canonicalIds=${"a".repeat(4_001)}`,
      ),
    );
    const tooMany = await GET(
      new Request(
        `https://stockpilot.test/api/market/quotes?symbols=${Array.from(
          { length: 41 },
          (_, index) => `S${index}`,
        ).join(",")}`,
      ),
    );
    const invalidCanonical = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=not-a-canonical-id",
      ),
    );
    const invalidSymbol = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?symbols=%3Cscript%3E",
      ),
    );
    expect([
      mixed.status,
      empty.status,
      oversized.status,
      tooMany.status,
      invalidCanonical.status,
      invalidSymbol.status,
    ]).toEqual([400, 400, 400, 400, 400, 400]);
    expect(getQuotes).not.toHaveBeenCalled();
    expect(getCanonicalQuotes).not.toHaveBeenCalled();
  });

  it("keeps the legacy symbol path explicit and deduplicated", async () => {
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?symbols=AAPL,aapl",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Identity-Mode")).toBe(
      "legacy_symbol",
    );
    expect(getQuotes).toHaveBeenCalledWith(["AAPL"]);
    expect(getCanonicalQuotes).not.toHaveBeenCalled();
    expect(body.quotes[0].canonicalId).toBeNull();
  });

  it("reports canonical misses without substituting another listing", async () => {
    getCanonicalQuotes.mockResolvedValue([]);
    const response = await GET(
      new Request(
        "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quotes).toEqual([]);
    expect(body.fallback.unavailableCanonicalIds).toEqual([
      "stock:xnas:aapl:usd",
    ]);
    expect(body.fallback.degraded).toBe(true);
  });

  it("marks mock legacy quotes and cached responses transparently", async () => {
    getQuotes.mockResolvedValue([
      {
        ...providerQuote,
        providerId: "mock",
        provider: "Mock",
        quality: "mock",
      },
    ]);
    withCacheFallback.mockImplementation(
      async (_key: string, loader: () => Promise<unknown>) => ({
        value: await loader(),
        fromCache: true,
        cacheStoredAt: "2026-08-22T10:00:00.000Z",
        warning: "stale fallback",
      }),
    );
    const response = await GET(
      new Request("https://stockpilot.test/api/market/quotes?symbols=AAPL"),
    );
    const body = await response.json();
    expect(response.headers.get("X-StockPilot-Cache")).toBe("fallback");
    expect(body.fallback.mockSymbols).toEqual(["AAPL"]);
    expect(body.fallback.degraded).toBe(true);
  });

  it("deduplicates simultaneous canonical provider batches in flight", async () => {
    let release: ((value: unknown[]) => void) | undefined;
    getCanonicalQuotes.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const url =
      "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd";
    const first = GET(new Request(url));
    const second = GET(new Request(url));
    await Promise.resolve();
    await Promise.resolve();
    release?.([providerQuote]);
    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(getCanonicalQuotes).toHaveBeenCalledTimes(1);
  });
});
