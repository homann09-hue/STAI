import { beforeEach, describe, expect, it, vi } from "vitest";

const { getQuotes, withCacheFallback } = vi.hoisted(() => ({
  getQuotes: vi.fn(),
  withCacheFallback: vi.fn(),
}));

vi.mock("@/lib/providers/market-provider", () => ({
  getMarketDataProvider: () => ({
    providerId: "fmp",
    providerName: "FMP",
    streamMode: "rest_polling",
    getQuotes,
  }),
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

beforeEach(() => {
  vi.clearAllMocks();
  getQuotes.mockResolvedValue([providerQuote]);
  withCacheFallback.mockImplementation(async (_key: string, loader: () => Promise<unknown>) => ({
    value: await loader(), fromCache: false, cacheStoredAt: null, warning: null,
  }));
});

describe("GET /api/market/quotes canonical identity", () => {
  it("binds provider data to the requested canonical listing", async () => {
    const response = await GET(new Request("https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Identity-Mode")).toBe("canonical");
    expect(getQuotes).toHaveBeenCalledWith(["AAPL"]);
    expect(body.quotes[0]).toMatchObject({ canonicalId: "stock:xnas:aapl:usd", symbol: "AAPL" });
  });

  it("rejects listing collisions before calling a provider", async () => {
    const response = await GET(new Request("https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd,stock:xetr:aapl:eur"));
    expect(response.status).toBe(409);
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("rejects mixed canonical and legacy selectors", async () => {
    const response = await GET(new Request("https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd&symbols=AAPL"));
    expect(response.status).toBe(400);
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("validates empty, oversized and malformed requests", async () => {
    const empty = await GET(new Request("https://stockpilot.test/api/market/quotes"));
    const oversized = await GET(new Request(`https://stockpilot.test/api/market/quotes?canonicalIds=${"a".repeat(4_001)}`));
    const tooMany = await GET(new Request(`https://stockpilot.test/api/market/quotes?symbols=${Array.from({ length: 41 }, (_, index) => `S${index}`).join(",")}`));
    const invalidCanonical = await GET(new Request("https://stockpilot.test/api/market/quotes?canonicalIds=not-a-canonical-id"));
    const invalidSymbol = await GET(new Request("https://stockpilot.test/api/market/quotes?symbols=%3Cscript%3E"));
    expect([empty.status, oversized.status, tooMany.status, invalidCanonical.status, invalidSymbol.status]).toEqual([400, 400, 400, 400, 400]);
    expect(getQuotes).not.toHaveBeenCalled();
  });

  it("keeps the legacy symbol path explicit and deduplicated", async () => {
    const response = await GET(new Request("https://stockpilot.test/api/market/quotes?symbols=AAPL,aapl"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Identity-Mode")).toBe("legacy_symbol");
    expect(getQuotes).toHaveBeenCalledWith(["AAPL"]);
    expect(body.quotes[0].canonicalId).toBeNull();
  });

  it("reports canonical misses without substituting another listing", async () => {
    getQuotes.mockResolvedValue([]);
    const response = await GET(new Request("https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.quotes).toEqual([]);
    expect(body.fallback.unavailableCanonicalIds).toEqual(["stock:xnas:aapl:usd"]);
    expect(body.fallback.degraded).toBe(true);
  });

  it("marks mock quotes and cached responses transparently", async () => {
    getQuotes.mockResolvedValue([{ ...providerQuote, providerId: "mock", provider: "Mock", quality: "mock" }]);
    withCacheFallback.mockImplementation(async (_key: string, loader: () => Promise<unknown>) => ({
      value: await loader(), fromCache: true, cacheStoredAt: "2026-08-22T10:00:00.000Z", warning: "stale fallback",
    }));
    const response = await GET(new Request("https://stockpilot.test/api/market/quotes?symbols=AAPL"));
    const body = await response.json();
    expect(response.headers.get("X-StockPilot-Cache")).toBe("fallback");
    expect(body.fallback.mockSymbols).toEqual(["AAPL"]);
    expect(body.fallback.degraded).toBe(true);
  });

  it("deduplicates simultaneous provider batches in flight", async () => {
    let release: ((value: unknown[]) => void) | undefined;
    getQuotes.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const url = "https://stockpilot.test/api/market/quotes?canonicalIds=stock:xnas:aapl:usd";
    const first = GET(new Request(url));
    const second = GET(new Request(url));
    await Promise.resolve();
    release?.([providerQuote]);
    const responses = await Promise.all([first, second]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(getQuotes).toHaveBeenCalledTimes(1);
  });
});
