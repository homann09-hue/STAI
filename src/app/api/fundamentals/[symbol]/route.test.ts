import { beforeEach, describe, expect, it, vi } from "vitest";

const { withCacheFallbackMock } = vi.hoisted(() => ({
  withCacheFallbackMock: vi.fn(),
}));

vi.mock("@/lib/provider-cache", () => ({
  withCacheFallback: withCacheFallbackMock,
}));

vi.mock("@/lib/api-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-guard")>();
  return {
    ...actual,
    rateLimit: vi.fn().mockResolvedValue(null),
  };
});

import { GET } from "./route";

const metadata = {
  provider: "Kein Fundamentals-Provider",
  requestedProvider: "fmp",
  actualProvider: "unavailable",
  quality: "unavailable",
  fetchedAt: "2026-08-12T00:00:00.000Z",
  fields: {},
  fieldCoverage: { provider: 0, mock: 0, unavailable: 7, total: 7 },
  caveat: null,
  fallback: {
    degraded: true,
    mockLike: false,
    fallbackFields: [],
    warning: "Keine verifizierten Kennzahlen.",
  },
};

function request() {
  return GET(new Request("http://localhost/api/fundamentals/AAPL"), {
    params: Promise.resolve({ symbol: "AAPL" }),
  });
}

describe("fundamentals cache quality", () => {
  beforeEach(() => withCacheFallbackMock.mockReset());

  it("preserves unavailable when a cached lookup contains no fundamentals", async () => {
    withCacheFallbackMock.mockResolvedValue({
      value: { fundamentals: null, metadata },
      fromCache: true,
      cacheStoredAt: "2026-08-12T00:00:00.000Z",
      warning: "cached miss",
    });

    const response = await request();
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(response.headers.get("X-StockPilot-Cache")).toBe("fallback");
    expect(response.headers.get("X-StockPilot-Data-Quality")).toBe("unavailable");
    expect(payload.metadata.quality).toBe("unavailable");
    expect(payload.metadata.cache.fromCache).toBe(true);
  });

  it("marks cached provider fundamentals as cached", async () => {
    withCacheFallbackMock.mockResolvedValue({
      value: {
        fundamentals: {
          peRatio: 20,
          revenueGrowth: 5,
          earningsGrowth: 4,
          debtToEquity: 1,
          cashflow: 100,
          dividendYield: 1.5,
          marketCap: 1_000,
        },
        metadata: { ...metadata, provider: "FMP", actualProvider: "fmp", quality: "delayed" },
      },
      fromCache: true,
      cacheStoredAt: "2026-08-12T00:00:00.000Z",
      warning: null,
    });

    const response = await request();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-StockPilot-Data-Quality")).toBe("cached");
    expect(payload.metadata.quality).toBe("cached");
  });
});
