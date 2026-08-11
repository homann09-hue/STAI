import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.MARKETAUX_API_KEY;
  delete process.env.NEWS_API_KEY;
  delete process.env.NEWSAPI_API_KEY;
  delete process.env.VERCEL_ENV;
  delete process.env.STOCKPILOT_ALLOW_TEST_FIXTURES;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

async function loadNews(symbol = "AAPL") {
  const { getNewsWithMetadata } = await import("@/lib/providers/news-provider");
  return getNewsWithMetadata(symbol);
}

describe("News-Provider Produktionswahrheit", () => {
  it("liefert ohne echten Provider keine Ersatzmeldungen", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    process.env.STOCKPILOT_NEWS_PROVIDER = "auto";

    const result = await loadNews();

    expect(result.news).toEqual([]);
    expect(result.metadata.quality).toBe("unavailable");
    expect(result.metadata.actualProvider).toBe("unavailable");
    expect(result.metadata.fallback.mockCount).toBe(0);
  });

  it("ignoriert eine Mock-Auswahl und den Testschalter in Vercel Production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "production";
    process.env.STOCKPILOT_ALLOW_TEST_FIXTURES = "true";
    process.env.STOCKPILOT_NEWS_PROVIDER = "mock";

    const result = await loadNews();

    expect(result.news).toEqual([]);
    expect(result.metadata.quality).toBe("unavailable");
    expect(result.metadata.provider).toBe("Kein News-Provider");
  });

  it("erlaubt explizite Mock-Fixtures ausschließlich im Testbetrieb", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.STOCKPILOT_NEWS_PROVIDER = "mock";

    const result = await loadNews();

    expect(result.news.length).toBeGreaterThan(0);
    expect(result.metadata.quality).toBe("mock");
    expect(result.metadata.actualProvider).toBe("mock");
  });
});
