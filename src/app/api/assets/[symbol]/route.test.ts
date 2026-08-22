import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KnownInstrumentIdentity } from "@/lib/instrument-resolution";

const getAsset = vi.fn();
const getMarketDataProvider = vi.fn();
const rateLimit = vi.fn();
const withCacheFallback = vi.fn();
const recordInstrumentQuoteStatus = vi.fn();
const resolveInstrumentIdentityBySymbol = vi.fn();

vi.mock("@/lib/providers/market-provider", () => ({
  getMarketDataProvider: () => getMarketDataProvider(),
}));
vi.mock("@/lib/api-guard", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-guard")>("@/lib/api-guard");
  return { ...actual, rateLimit: (...args: unknown[]) => rateLimit(...args) };
});
vi.mock("@/lib/provider-cache", () => ({
  withCacheFallback: (...args: unknown[]) => withCacheFallback(...args),
}));
vi.mock("@/lib/instrument-master-store", () => ({
  recordInstrumentQuoteStatus: (...args: unknown[]) => recordInstrumentQuoteStatus(...args),
  resolveInstrumentIdentityBySymbol: (...args: unknown[]) => resolveInstrumentIdentityBySymbol(...args),
}));

function identity(overrides: Partial<KnownInstrumentIdentity> = {}): KnownInstrumentIdentity {
  return {
    internalInstrumentId: "11111111-1111-4111-8111-111111111111",
    canonicalId: "stock:xnas:abc:usd",
    symbol: "ABC",
    name: "ABC Corporation",
    assetClass: "stock",
    exchange: "NASDAQ",
    exchangeCode: "NASDAQ",
    mic: "XNAS",
    currency: "USD",
    provider: "FMP",
    quoteStatus: "available",
    ...overrides,
  };
}

async function call(symbol: string, canonicalId?: string) {
  const { GET } = await import("./route");
  const suffix = canonicalId ? `?canonicalId=${encodeURIComponent(canonicalId)}` : "";
  return GET(
    new Request(`https://stockpilot.test/api/assets/${encodeURIComponent(symbol)}${suffix}`, {
      headers: { "x-real-ip": `10.30.40.${Math.floor(Math.random() * 200) + 1}` },
    }),
    { params: Promise.resolve({ symbol }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  rateLimit.mockResolvedValue(null);
  getMarketDataProvider.mockReturnValue({
    getAsset,
    providerName: "Test Provider",
    streamMode: "rest_polling",
  });
  resolveInstrumentIdentityBySymbol.mockResolvedValue({
    status: "resolved",
    identity: identity(),
  });
  withCacheFallback.mockResolvedValue({
    value: null,
    fromCache: false,
    cacheStoredAt: null,
    warning: null,
  });
});

describe("GET /api/assets/[symbol] listing identity", () => {
  it("returns 409 and never calls a provider for ambiguous symbols", async () => {
    resolveInstrumentIdentityBySymbol.mockResolvedValue({
      status: "ambiguous",
      symbol: "ABC",
      candidates: [
        identity(),
        identity({ canonicalId: "stock:xetr:abc:eur", exchange: "XETRA", currency: "EUR" }),
      ],
      truncated: false,
    });

    const response = await call("ABC");
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.reason).toBe("listing_ambiguous");
    expect(body.listings).toHaveLength(2);
    expect(withCacheFallback).not.toHaveBeenCalled();
  });

  it("uses the canonical ID for cache and quote-status persistence", async () => {
    await call("ABC", "stock:xnas:abc:usd");

    expect(resolveInstrumentIdentityBySymbol).toHaveBeenCalledWith(
      "ABC",
      "stock:xnas:abc:usd",
    );
    expect(withCacheFallback).toHaveBeenCalledWith(
      "asset:stock:xnas:abc:usd",
      expect.any(Function),
      expect.any(Object),
    );
    expect(recordInstrumentQuoteStatus).toHaveBeenCalledWith(
      "stock:xnas:abc:usd",
      "restricted",
    );
  });

  it("rejects malformed canonical IDs before lookup", async () => {
    const response = await call("ABC", "<script>");
    expect(response.status).toBe(400);
    expect(resolveInstrumentIdentityBySymbol).not.toHaveBeenCalled();
  });
});
