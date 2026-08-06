import { afterEach, describe, expect, it } from "vitest";
import { getProviderHealthReport, getPublicProviderCapabilityReport } from "./provider-health";

const originalEnv = {
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
  FMP_API_KEY: process.env.FMP_API_KEY,
  NEWS_API_KEY: process.env.NEWS_API_KEY,
  MARKETAUX_API_KEY: process.env.MARKETAUX_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
};

function resetEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("provider health capability report", () => {
  afterEach(resetEnv);

  it("summarizes public provider capabilities without leaking secret variable names", () => {
    process.env.FINNHUB_API_KEY = "secret-test-key";
    process.env.FMP_API_KEY = "secret-test-key";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-test-key";

    const report = getPublicProviderCapabilityReport(new Date("2026-08-06T12:00:00.000Z"));
    const serialized = JSON.stringify(report);

    expect(report.categories.some((item) => item.id === "market" && item.configuredCount > 0)).toBe(true);
    expect(report.categories.some((item) => item.id === "auth" && item.status === "ready")).toBe(true);
    expect(report.publicNotice).toContain("ohne API-Key-Namen");
    expect(serialized).not.toContain("FINNHUB_API_KEY");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("secret-test-key");
  });

  it("keeps missing provider areas explicit instead of implying complete live coverage", () => {
    delete process.env.FINNHUB_API_KEY;
    delete process.env.FMP_API_KEY;
    delete process.env.NEWS_API_KEY;
    delete process.env.MARKETAUX_API_KEY;

    const detailed = getProviderHealthReport(new Date("2026-08-06T12:00:00.000Z"));
    const publicReport = getPublicProviderCapabilityReport(new Date("2026-08-06T12:00:00.000Z"));
    const market = publicReport.categories.find((item) => item.id === "market");
    const news = publicReport.categories.find((item) => item.id === "news");

    expect(detailed.totals.missing_key).toBeGreaterThan(0);
    expect(market?.liveClaim).not.toBe("allowed");
    expect(news?.status).toBe("missing_key");
    expect(publicReport.criticalLimitations.length).toBeGreaterThan(0);
  });
});
