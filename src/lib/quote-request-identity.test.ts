import { describe, expect, it } from "vitest";
import { bindQuotesToCanonicalIdentities, canonicalQuoteCacheKey, prepareCanonicalQuoteRequest } from "@/lib/quote-request-identity";

describe("canonical quote request identity", () => {
  it("rejects malformed, unsupported and incomplete canonical IDs", () => {
    expect(prepareCanonicalQuoteRequest(["<script>"]).status).toBe("invalid");
    expect(prepareCanonicalQuoteRequest(["bond:xnas:corp:usd"]).status).toBe("invalid");
    expect(prepareCanonicalQuoteRequest(["stock:xnas:aapl"]).status).toBe("invalid");
    expect(prepareCanonicalQuoteRequest(["stock:xnas:aapl:us"]).status).toBe("invalid");
  });

  it("rejects provider-symbol collisions instead of mixing listings", () => {
    expect(prepareCanonicalQuoteRequest(["stock:xnas:aapl:usd", "stock:xetr:aapl:eur"])).toEqual({
      status: "provider_symbol_collision", providerSymbol: "AAPL",
      canonicalIds: ["stock:xnas:aapl:usd", "stock:xetr:aapl:eur"],
    });
  });

  it("deduplicates IDs and creates a listing-specific cache key", () => {
    const result = prepareCanonicalQuoteRequest(["stock:xnas:aapl:usd", "etf:arcx:spy:usd", "stock:xnas:aapl:usd"]);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.providerSymbols).toEqual(["AAPL", "SPY"]);
    expect(canonicalQuoteCacheKey("fmp", result.identities)).toBe("quotes:canonical:fmp:etf:arcx:spy:usd,stock:xnas:aapl:usd");
  });

  it("binds a provider quote to exactly one canonical listing", () => {
    const result = prepareCanonicalQuoteRequest(["stock:xnas:aapl:usd"]);
    if (result.status !== "ready") throw new Error("test setup failed");
    const quotes = bindQuotesToCanonicalIdentities([{
      symbol: "AAPL", providerId: "fmp", providerSymbol: "AAPL", provider: "FMP",
      price: 200, currency: "USD", quality: "delayed", marketStatus: "closed",
      timestamp: "2026-08-22T10:00:00.000Z",
    }], result.identities);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ canonicalId: "stock:xnas:aapl:usd", symbol: "AAPL", assetType: "stock", currency: "USD" });
  });

  it("ignores malformed and unrequested provider records", () => {
    const result = prepareCanonicalQuoteRequest(["stock:xnas:aapl:usd"]);
    if (result.status !== "ready") throw new Error("test setup failed");
    expect(bindQuotesToCanonicalIdentities([
      null,
      { symbol: "MSFT", providerId: "fmp", providerSymbol: "MSFT", provider: "FMP", price: 300 },
    ], result.identities)).toEqual([]);
  });
});
