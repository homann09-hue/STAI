import { describe, expect, it } from "vitest";
import {
  getMarketDataRuntimeConfig,
  getProviderLicensePolicy,
  getProviderRegistrySnapshot,
  normalizeProviderId,
  resolveProviderRoute,
} from "@/lib/providers/provider-registry";

const base = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

describe("provider registry", () => {
  it("routes configured global quote providers in deterministic order", () => {
    const result = resolveProviderRoute(
      { capability: "quote", assetClass: "equity", market: "global" },
      {
        ...base,
        TWELVE_DATA_API_KEY: "x",
        FINNHUB_API_KEY: "x",
        FMP_API_KEY: "x",
      },
    );
    expect(result.providers).toEqual(["twelve_data", "finnhub", "fmp"]);
    expect(result.failoverEnabled).toBe(true);
  });

  it("keeps prepared adapters out of executable routes", () => {
    const result = resolveProviderRoute(
      {
        capability: "quote",
        assetClass: "equity",
        market: "us",
        preferredProvider: "alpaca",
      },
      {
        ...base,
        ALPACA_API_KEY: "x",
        ALPACA_API_SECRET: "x",
      },
    );
    expect(result.providers).not.toContain("alpaca");
    expect(result.rejected).toContainEqual(
      expect.objectContaining({
        providerId: "alpaca",
        reason: "adapter_not_implemented",
      }),
    );
  });

  it("does not silently cast an unknown explicit provider", () => {
    const result = resolveProviderRoute(
      {
        capability: "quote",
        preferredProvider: "not-a-provider",
      },
      { ...base, FMP_API_KEY: "x" },
    );
    expect(result.providers).toEqual([]);
    expect(result.rejected[0]).toMatchObject({
      providerId: "not-a-provider",
      reason: "unknown_provider",
    });
  });

  it("fails closed for public display until rights are verified", () => {
    const result = resolveProviderRoute(
      { capability: "quote", assetClass: "equity" },
      {
        NODE_ENV: "production",
        FMP_API_KEY: "x",
        MARKET_DATA_ALLOW_EXTERNAL_DISPLAY: "true",
      },
    );
    expect(result.providers).toEqual([]);
    expect(result.rejected).toContainEqual(
      expect.objectContaining({
        providerId: "fmp",
        reason: "license_not_verified",
      }),
    );
  });

  it("cannot downgrade a deployed production environment", () => {
    const result = resolveProviderRoute(
      { capability: "quote", assetClass: "equity" },
      {
        NODE_ENV: "production",
        MARKET_DATA_ENV: "development",
        FMP_API_KEY: "x",
      },
    );
    expect(result.environment).toBe("production");
    expect(result.providers).toEqual([]);
  });

  it("requires verification and allow-list for public display", () => {
    const env = {
      NODE_ENV: "production",
      FMP_API_KEY: "x",
      MARKET_DATA_ALLOW_EXTERNAL_DISPLAY: "true",
      MARKET_DATA_LICENSE_VERIFIED_PROVIDERS: "fmp",
      MARKET_DATA_EXTERNAL_DISPLAY_PROVIDERS: "fmp",
      MARKET_DATA_LICENSE_VERIFIED_AT: "2026-08-12",
    } as NodeJS.ProcessEnv;
    expect(
      resolveProviderRoute({ capability: "fundamentals" }, env).providers,
    ).toEqual(["fmp"]);
    expect(getProviderLicensePolicy("fmp", env)).toMatchObject({
      licenseVerified: true,
      externalDisplayAllowed: true,
      licenseVerifiedAt: "2026-08-12",
    });
  });

  it("honors enable flags and missing configuration", () => {
    const result = resolveProviderRoute(
      { capability: "fundamentals" },
      {
        ...base,
        FMP_API_KEY: "x",
        ALPHA_VANTAGE_API_KEY: "x",
        MARKET_DATA_ENABLE_FMP: "false",
      },
    );
    expect(result.providers).toEqual(["alpha_vantage"]);
    expect(result.rejected).toContainEqual(
      expect.objectContaining({
        providerId: "fmp",
        reason: "disabled",
      }),
    );
  });

  it("moves degraded providers behind healthy providers", () => {
    const result = resolveProviderRoute(
      {
        capability: "quote",
        assetClass: "equity",
        health: {
          twelve_data: "degraded",
          finnhub: "healthy",
          fmp: "open_circuit",
        },
      },
      {
        ...base,
        TWELVE_DATA_API_KEY: "x",
        FINNHUB_API_KEY: "x",
        FMP_API_KEY: "x",
      },
    );
    expect(result.providers.slice(0, 2)).toEqual([
      "finnhub",
      "twelve_data",
    ]);
    expect(result.rejected).toContainEqual(
      expect.objectContaining({
        providerId: "fmp",
        reason: "unhealthy",
      }),
    );
  });

  it("uses keyless crypto adapters only for crypto routes", () => {
    expect(
      resolveProviderRoute(
        { capability: "quote", assetClass: "crypto" },
        base,
      ).providers.slice(0, 2),
    ).toEqual(["coinbase", "binance"]);
    expect(
      resolveProviderRoute(
        { capability: "quote", assetClass: "equity" },
        base,
      ).providers,
    ).not.toContain("binance");
  });

  it("normalizes aliases without accepting arbitrary strings", () => {
    expect(normalizeProviderId("POLYGON")).toBe("massive");
    expect(normalizeProviderId("news-api")).toBe("newsapi");
    expect(normalizeProviderId("anything")).toBeNull();
  });

  it("bounds controls without exposing secret values", () => {
    const env = {
      ...base,
      FMP_API_KEY: "super-secret",
      MARKET_DATA_RETRY_ATTEMPTS: "99",
      MARKET_DATA_STALE_AFTER_MS: "45000",
    };
    expect(getMarketDataRuntimeConfig(env)).toMatchObject({
      retryAttempts: 5,
      staleAfterMs: 45_000,
    });
    expect(JSON.stringify(getProviderRegistrySnapshot(env))).not.toContain(
      "super-secret",
    );
  });
});
