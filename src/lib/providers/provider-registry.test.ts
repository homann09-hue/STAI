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

  it("routes every implemented FMP data domain through the registry", () => {
    const env = { ...base, FMP_API_KEY: "x" };
    for (const capability of [
      "historical_bars",
      "instrument_search",
      "fundamentals",
      "corporate_actions",
      "market_calendar",
      "news",
    ] as const) {
      expect(
        resolveProviderRoute({ capability, preferredProvider: "fmp" }, env).providers,
      ).toContain("fmp");
    }
  });

  it("routes every implemented Twelve Data domain only when configured", () => {
    const env = { ...base, TWELVE_DATA_API_KEY: "x" };
    for (const capability of [
      "quote",
      "quote_batch",
      "stream_quotes",
      "historical_bars",
      "instrument_search",
      "market_status",
    ] as const) {
      expect(resolveProviderRoute({ capability }, env).providers).toContain(
        "twelve_data",
      );
    }
    expect(
      resolveProviderRoute({ capability: "market_status" }, base).providers,
    ).not.toContain("twelve_data");
  });

  it("routes the implemented Alpaca adapter only with the official credential pair", () => {
    const result = resolveProviderRoute(
      {
        capability: "quote",
        assetClass: "equity",
        market: "us",
        preferredProvider: "alpaca",
      },
      {
        ...base,
        ALPACA_API_KEY_ID: "x",
        ALPACA_API_SECRET_KEY: "x",
      },
    );
    expect(result.providers[0]).toBe("alpaca");
    expect(
      resolveProviderRoute(
        { capability: "quote", preferredProvider: "alpaca" },
        { ...base, ALPACA_API_KEY_ID: "x" },
      ).providers,
    ).not.toContain("alpaca");
  });

  it("exposes Alpaca quote, trade stream, history and market-status capabilities", () => {
    const env = {
      ...base,
      ALPACA_API_KEY_ID: "x",
      ALPACA_API_SECRET_KEY: "x",
    };
    for (const capability of [
      "quote",
      "quote_batch",
      "stream_quotes",
      "stream_trades",
      "historical_bars",
      "market_status",
    ] as const) {
      expect(
        resolveProviderRoute({ capability, preferredProvider: "alpaca" }, env).providers,
      ).toEqual(["alpaca"]);
    }
  });

  it("marks delayed SIP as delayed and IEX as a single-venue realtime feed", () => {
    const credentials = {
      ...base,
      ALPACA_API_KEY_ID: "x",
      ALPACA_API_SECRET_KEY: "x",
    };
    expect(getProviderLicensePolicy("alpaca", credentials)).toMatchObject({
      feedType: "realtime",
      maximumKnownDelay: 0,
    });
    expect(getProviderLicensePolicy("alpaca", {
      ...credentials,
      ALPACA_DATA_FEED: "delayed_sip",
    })).toMatchObject({ feedType: "delayed", maximumKnownDelay: 900 });
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
