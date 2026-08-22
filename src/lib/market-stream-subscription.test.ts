import { describe, expect, it } from "vitest";
import {
  indexQuotesForStreamSubscription,
  normalizeMarketStreamSubscription,
  quoteKeyForStreamMode,
} from "@/lib/market-stream-subscription";
import { buildNormalizedQuote } from "@/lib/canonical-quote";

function quote(canonicalId: string | null, symbol = "AAPL") {
  return buildNormalizedQuote({
    canonicalId,
    instrumentId: canonicalId,
    symbol,
    assetType: "stock",
    providerId: "test",
    providerSymbol: symbol,
    venue: "XNAS",
    currency: "USD",
    price: 200,
    provider: "Test",
    quality: "delayed",
    marketStatus: "closed",
    timestamp: "2026-08-22T10:00:00.000Z",
  });
}

describe("market stream subscription", () => {
  it("normalizes and deduplicates canonical listing IDs", () => {
    expect(normalizeMarketStreamSubscription({
      canonicalIds: [" STOCK:XNAS:AAPL:USD ", "stock:xnas:aapl:usd", "invalid"],
    })).toEqual({
      mode: "canonical",
      values: ["stock:xnas:aapl:usd"],
      key: "canonical:stock:xnas:aapl:usd",
      query: "canonicalIds=stock%3Axnas%3Aaapl%3Ausd",
    });
  });

  it("keeps the legacy symbol mode explicit and bounded", () => {
    const result = normalizeMarketStreamSubscription({
      symbols: [" aapl ", "AAPL", "<script>", ...Array.from({ length: 40 }, (_, index) => `S${index}`)],
    });
    expect(result.mode).toBe("legacy_symbol");
    expect(result.values[0]).toBe("AAPL");
    expect(result.values).toHaveLength(30);
    expect(result.values).not.toContain("<SCRIPT>");
  });

  it("indexes canonical quotes only by the requested listing", () => {
    const subscription = normalizeMarketStreamSubscription({ canonicalIds: ["stock:xnas:aapl:usd"] });
    expect(indexQuotesForStreamSubscription([
      quote("stock:xnas:aapl:usd"),
      quote("stock:xetr:aapl:eur"),
      null,
    ], subscription)).toEqual({
      "stock:xnas:aapl:usd": expect.objectContaining({ canonicalId: "stock:xnas:aapl:usd" }),
    });
  });

  it("uses symbols only in the declared legacy mode", () => {
    const value = quote(null);
    expect(quoteKeyForStreamMode(value, "canonical")).toBeNull();
    expect(quoteKeyForStreamMode(value, "legacy_symbol")).toBe("AAPL");
  });
});
