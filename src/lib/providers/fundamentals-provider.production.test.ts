import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/http-json", () => ({
  fetchBoundedProviderJson: vi.fn(async (url: URL) => {
    if (url.pathname.endsWith("/profile")) {
      return { data: [{ marketCap: 3_100_000_000_000 }], latencyMs: 4 };
    }
    return { data: [], latencyMs: 4 };
  })
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.FMP_API_KEY;
  delete process.env.ALPHA_VANTAGE_API_KEY;
  delete process.env.VERCEL_ENV;
  delete process.env.STOCKPILOT_ALLOW_TEST_FIXTURES;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

async function loadFundamentals(symbol = "AAPL") {
  const { getFundamentalsWithMetadata } = await import("@/lib/providers/fundamentals-provider");
  return getFundamentalsWithMetadata(symbol);
}

describe("Fundamentals-Provider Produktionswahrheit", () => {
  it("liefert ohne echten Provider keine Ersatzkennzahlen", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER = "auto";

    const result = await loadFundamentals();

    expect(result.fundamentals).toBeNull();
    expect(result.metadata.quality).toBe("unavailable");
    expect(result.metadata.actualProvider).toBe("unavailable");
    expect(result.metadata.fieldCoverage.unavailable).toBe(result.metadata.fieldCoverage.total);
  });

  it("ignoriert eine Mock-Auswahl in Vercel Production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    process.env.STOCKPILOT_ALLOW_TEST_FIXTURES = "true";
    process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER = "mock";

    const result = await loadFundamentals();

    expect(result.fundamentals).toBeNull();
    expect(result.metadata.provider).toBe("Kein Fundamentals-Provider");
    expect(result.metadata.fieldCoverage.mock).toBe(0);
  });

  it("markiert eine echte Teilantwort feldweise und ergänzt keine Mockwerte", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER = "fmp";
    process.env.FMP_API_KEY = "test-key";

    const result = await loadFundamentals();

    expect(result.fundamentals?.marketCap).toBe(3_100_000_000_000);
    expect(result.metadata.actualProvider).toBe("fmp");
    expect(result.metadata.fields.marketCap).toBe("provider");
    expect(result.metadata.fields.revenueGrowth).toBe("unavailable");
    expect(result.metadata.fieldCoverage.mock).toBe(0);
    expect(result.metadata.fallback.warning).toContain("1 von 7");
  });

  it("erlaubt explizite Mock-Fixtures ausschließlich im Testbetrieb", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER = "mock";

    const result = await loadFundamentals();

    expect(result.fundamentals).not.toBeNull();
    expect(result.metadata.quality).toBe("mock");
    expect(result.metadata.fieldCoverage.mock).toBe(result.metadata.fieldCoverage.total);
  });
});
