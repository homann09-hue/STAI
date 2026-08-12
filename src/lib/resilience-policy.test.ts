import { describe, expect, it } from "vitest";
import {
  getProviderCachePolicy,
  getProviderRequestPolicy,
} from "@/lib/resilience-policy";

describe("resilience policy", () => {
  it("uses data-specific cache windows", () => {
    const quote = getProviderCachePolicy("quote", {});
    const metadata = getProviderCachePolicy("instrument_metadata", {});

    expect(quote.ttlMs).toBeLessThan(metadata.ttlMs);
    expect(quote.staleTtlMs).toBeGreaterThanOrEqual(quote.ttlMs);
    expect(metadata.staleTtlMs).toBe(30 * 24 * 60 * 60 * 1_000);
  });

  it("clamps unsafe cache overrides", () => {
    const policy = getProviderCachePolicy("quote", {
      STOCKPILOT_QUOTES_TTL_MS: "1",
      STOCKPILOT_QUOTES_STALE_TTL_MS: "999999999999",
    });

    expect(policy.ttlMs).toBe(1_000);
    expect(policy.staleTtlMs).toBe(30 * 24 * 60 * 60 * 1_000);
  });

  it("keeps constrained providers conservative", () => {
    const alpha = getProviderRequestPolicy("alpha_vantage", {});
    const binance = getProviderRequestPolicy("binance", {});

    expect(alpha.requestsPerMinute).toBe(5);
    expect(alpha.maxConcurrency).toBe(1);
    expect(binance.requestsPerMinute).toBeGreaterThan(alpha.requestsPerMinute);
  });

  it("supports bounded provider-specific overrides", () => {
    const policy = getProviderRequestPolicy("finnhub", {
      MARKET_DATA_RATE_LIMIT_FINNHUB_PER_MINUTE: "120",
      MARKET_DATA_BURST_FINNHUB: "999",
      MARKET_DATA_CONCURRENCY_FINNHUB: "0",
      MARKET_DATA_RETRY_ATTEMPTS: "99",
    });

    expect(policy.requestsPerMinute).toBe(120);
    expect(policy.burstCapacity).toBe(120);
    expect(policy.maxConcurrency).toBe(1);
    expect(policy.maxRetries).toBe(5);
  });

  it("does not let a global retry count exceed the Twelve Data burst budget", () => {
    const policy = getProviderRequestPolicy("twelve_data", {
      MARKET_DATA_RETRY_ATTEMPTS: "5",
    });
    expect(policy.burstCapacity).toBe(8);
    expect(policy.maxRetries).toBe(1);

    const explicitlyDisabled = getProviderRequestPolicy("twelve_data", {
      MARKET_DATA_RETRY_ATTEMPTS: "5",
      MARKET_DATA_RETRY_ATTEMPTS_TWELVE_DATA: "0",
    });
    expect(explicitlyDisabled.maxRetries).toBe(0);
  });
});
