import { describe, expect, it } from "vitest";
import type { NormalizedQuote } from "@/lib/types";
import { summarizeQuoteProviders } from "./quote-provenance";

function quote(symbol: string, provider: string): NormalizedQuote {
  return {
    symbol,
    assetType: "stock",
    price: 1,
    currency: "USD",
    change: 0,
    changePercent: 0,
    timestamp: "2026-08-11T18:00:00.000Z",
    provider,
    quality: "near_realtime",
    marketStatus: "unknown",
  };
}

describe("summarizeQuoteProviders", () => {
  it("reports the providers that actually supplied the quotes", () => {
    expect(
      summarizeQuoteProviders(
        [quote("AAPL", "Finnhub"), quote("MSFT", "Finnhub (Server-Cache)")],
        "Financial Modeling Prep",
      ),
    ).toEqual({ provider: "Finnhub", providers: ["Finnhub"] });
  });

  it("keeps mixed provider provenance visible without duplicates", () => {
    expect(
      summarizeQuoteProviders(
        [quote("AAPL", "Finnhub"), quote("SPY", "Financial Modeling Prep")],
        "Configured Provider",
      ),
    ).toEqual({
      provider: "Finnhub, Financial Modeling Prep",
      providers: ["Finnhub", "Financial Modeling Prep"],
    });
  });

  it("uses the configured provider only when no quote was returned", () => {
    expect(
      summarizeQuoteProviders([], "Kein verifizierter Marktdatenanbieter"),
    ).toEqual({
      provider: "Kein verifizierter Marktdatenanbieter",
      providers: [],
    });
  });
});
