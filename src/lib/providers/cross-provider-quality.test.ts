import { describe, expect, it } from "vitest";

import { buildNormalizedQuote } from "@/lib/canonical-quote";
import { selectCrossProviderQuote } from "@/lib/providers/cross-provider-quality";

function quote(providerId: string, price: number, options: { providerSymbol?: string; currency?: string; timestamp?: string } = {}) {
  const timestamp = options.timestamp ?? "2026-08-17T12:00:00.000Z";
  return buildNormalizedQuote({
    instrumentId: `stock:NASDAQ:AAPL:${options.currency ?? "USD"}`,
    symbol: "AAPL",
    assetType: "stock",
    providerId,
    providerSymbol: options.providerSymbol ?? "AAPL",
    venue: "NASDAQ",
    currency: options.currency ?? "USD",
    last: price,
    bid: price - 0.01,
    ask: price + 0.01,
    marketStatus: "open",
    marketSession: "REGULAR",
    eventTimestamp: timestamp,
    providerTimestamp: timestamp,
    receivedTimestamp: timestamp,
    provider: providerId,
    quality: "near_realtime",
  }, { now: new Date(timestamp) });
}

describe("cross-provider quote quality", () => {
  it("confirms close observations without averaging the selected price", () => {
    const result = selectCrossProviderQuote([quote("primary", 100), quote("secondary", 100.1)]);
    expect(result.report.status).toBe("confirmed");
    expect(result.quote?.price).toBe(100);
    expect(result.quote?.qualityIssues).toContain("cross_provider_confirmed");
  });

  it("blocks analysis and caps quality on material divergence", () => {
    const result = selectCrossProviderQuote([quote("primary", 100), quote("secondary", 105)]);
    expect(result.report.status).toBe("divergent");
    expect(result.report.analysisAllowed).toBe(false);
    expect(result.quote).toMatchObject({ price: 100, qualityStatus: "DIVERGENT" });
    expect(result.quote?.qualityScore).toBeLessThanOrEqual(25);
  });

  it("does not compare USD and USDT products as the same instrument", () => {
    const primary = quote("coinbase", 60_000, { providerSymbol: "BTC-USD", currency: "USD" });
    const secondary = quote("binance", 60_010, { providerSymbol: "BTCUSDT", currency: "USD" });
    const result = selectCrossProviderQuote([
      { ...primary, symbol: "BTC-USD", assetType: "crypto" },
      { ...secondary, symbol: "BTC-USD", assetType: "crypto" },
    ]);
    expect(result.report.status).toBe("incomparable");
    expect(result.report.issues).toContain("cross_provider_currency_mismatch");
    expect(result.quote?.price).toBe(60_000);
  });

  it("rejects stale comparisons instead of reporting divergence", () => {
    const result = selectCrossProviderQuote([
      quote("primary", 100),
      quote("secondary", 110, { timestamp: "2026-08-17T11:40:00.000Z" }),
    ]);
    expect(result.report.status).toBe("stale_comparison");
    expect(result.report.issues).toContain("cross_provider_timestamp_skew");
  });

  it("marks a lone provider explicitly", () => {
    const result = selectCrossProviderQuote([quote("primary", 100)]);
    expect(result.report.status).toBe("single_source");
    expect(result.quote?.qualityIssues).toContain("single_provider_quote");
  });
});
