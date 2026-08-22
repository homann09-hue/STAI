import { describe, expect, it } from "vitest";
import type { MarketUniverseInstrument } from "@/lib/types";
import { enrichInstrumentSearchResults, normalizeInstrumentSymbol, resolveInstrumentUniverse } from "./instrument-master";

function instrument(overrides: Partial<MarketUniverseInstrument> = {}): MarketUniverseInstrument {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    assetClass: "stock",
    exchange: "NASDAQ",
    country: "USA",
    currency: "USD",
    provider: "Test Provider",
    quality: "delayed",
    quoteQuality: "delayed",
    coverage: "available",
    subscribable: false,
    lastUpdatedAt: "2026-08-06T12:00:00.000Z",
    note: "Test fixture",
    ...overrides
  };
}

describe("instrument master", () => {
  it("normalizes symbols defensively", () => {
    expect(normalizeInstrumentSymbol(" aapl<script> ")).toBe("AAPLSCRIPT");
    expect(normalizeInstrumentSymbol("btc-usd")).toBe("BTC-USD");
    expect(normalizeInstrumentSymbol(null)).toBe("");
  });

  it("deduplicates provider duplicates by asset class, exchange, symbol and currency", () => {
    const resolved = resolveInstrumentUniverse([
      instrument({ provider: "Provider A", quoteQuality: "delayed", coverage: "available" }),
      instrument({ provider: "Provider B", quoteQuality: "near_realtime", coverage: "available", subscribable: true })
    ]);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.provider).toBe("Provider B");
    expect(resolved[0]?.canonicalId).toBe("stock:nasdaq:aapl:usd");
    expect(resolved[0]?.resolutionStatus).toBe("resolved");
  });

  it("does not collapse crypto and stock symbols with similar tickers", () => {
    const resolved = resolveInstrumentUniverse([
      instrument({ symbol: "BTC", name: "Bitcoin Depot Inc.", assetClass: "stock", exchange: "NASDAQ" }),
      instrument({ symbol: "BTC-USD", name: "Bitcoin", assetClass: "crypto", exchange: "Binance", country: "Global" })
    ]);

    expect(resolved.map((item) => item.canonicalId).sort()).toEqual([
      "crypto:binance:btc-usd:usd",
      "stock:nasdaq:btc:usd"
    ]);
  });

  it("marks weak provider-only rows as ambiguous instead of pretending full resolution", () => {
    const resolved = resolveInstrumentUniverse([
      instrument({
        symbol: "META",
        name: "Meta Platforms Inc.",
        exchange: "Provider",
        coverage: "available",
        quoteQuality: "near_realtime",
        subscribable: true
      })
    ]);

    expect(resolved[0]?.resolutionStatus).toBe("ambiguous");
    expect(resolved[0]?.identityConfidence).toBeLessThan(90);
    expect(resolved[0]?.resolutionWarnings?.join(" ")).toContain("Handelsplatz");
  });

  it("preserves license-required instruments as non-live professional coverage", () => {
    const resolved = resolveInstrumentUniverse([
      instrument({
        symbol: "ES",
        name: "E-mini S&P 500 Futures",
        assetClass: "future",
        exchange: "CME",
        coverage: "license_required",
        quoteQuality: "unavailable"
      })
    ]);

    expect(resolved[0]?.coverage).toBe("license_required");
    expect(resolved[0]?.quoteQuality).toBe("unavailable");
    expect(resolved[0]?.subscribable).toBe(false);
    expect(resolved[0]?.resolutionWarnings?.join(" ")).toContain("Börsenlizenz");
  });

  it("adds explainable search context and analysis readiness", () => {
    const resolved = resolveInstrumentUniverse([
      instrument({ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", coverage: "available", quoteQuality: "near_realtime" }),
      instrument({ symbol: "ES", name: "E-mini S&P 500 Futures", assetClass: "future", exchange: "CME", coverage: "license_required", quoteQuality: "unavailable" })
    ]);
    const enriched = enrichInstrumentSearchResults(resolved, "apple nasdaq");
    const apple = enriched.find((item) => item.symbol === "AAPL");
    const future = enrichInstrumentSearchResults(resolved, "ES")[0];

    expect(apple?.matchReasons).toEqual(expect.arrayContaining(["Name passt", "Börse passt"]));
    expect(apple?.analysisReadiness).toBe("ready");
    expect(apple?.detailHref).toBe(
      "/assets/AAPL?canonicalId=stock%3Anasdaq%3Aaapl%3Ausd",
    );
    expect(future?.analysisReadiness).toBe("blocked");
    expect(future?.analysisBlockers?.join(" ")).toContain("Börsen- oder Datenlizenz");
  });
});
