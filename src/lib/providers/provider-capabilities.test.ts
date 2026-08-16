import { describe, expect, it } from "vitest";

import { resolveQuoteChainForAssetClass } from "@/lib/providers/provider-capabilities";

describe("provider capability coverage", () => {
  it("counts only configured and enabled providers as failover", () => {
    const coverage = resolveQuoteChainForAssetClass("stock", {
      NODE_ENV: "test",
      MARKET_DATA_ENABLE_TWELVE_DATA: "true",
      MARKET_DATA_ENABLE_FINNHUB: "true",
      MARKET_DATA_ENABLE_FMP: "false",
      TWELVE_DATA_API_KEY: "twelve",
      FINNHUB_API_KEY: "finnhub",
    });

    expect(coverage.providers).toEqual(["twelve_data", "finnhub"]);
    expect(coverage.hasFailover).toBe(true);
  });

  it("does not claim failover for one routable source", () => {
    const coverage = resolveQuoteChainForAssetClass("forex", {
      NODE_ENV: "test",
      MARKET_DATA_ENABLE_TWELVE_DATA: "true",
      MARKET_DATA_ENABLE_FINNHUB: "false",
      TWELVE_DATA_API_KEY: "twelve",
    });

    expect(coverage.providers).toEqual(["twelve_data"]);
    expect(coverage.hasFailover).toBe(false);
  });
});
