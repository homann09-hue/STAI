import { describe, expect, it, vi } from "vitest";
import { ChainedQuoteProvider } from "@/lib/providers/market-provider";
import type { CanonicalQuoteIdentity } from "@/lib/quote-request-identity";

vi.mock("@/lib/observability", () => ({ logEvent: vi.fn() }));

const instruments: CanonicalQuoteIdentity[] = [
  {
    canonicalId: "stock:xnas:aapl:usd",
    internalInstrumentId: "instrument-us",
    symbol: "AAPL",
    assetType: "stock",
    exchange: "XNAS",
    currency: "USD",
    providerMappings: [
      { providerId: "fmp", providerSymbol: "AAPL" },
      { providerId: "twelve_data", providerSymbol: "AAPL:XNAS" },
    ],
  },
  {
    canonicalId: "stock:xetr:aapl:eur",
    internalInstrumentId: "instrument-de",
    symbol: "AAPL",
    assetType: "stock",
    exchange: "XETR",
    currency: "EUR",
    providerMappings: [
      { providerId: "fmp", providerSymbol: "AAPL.DE" },
      { providerId: "twelve_data", providerSymbol: "AAPL:XETR" },
    ],
  },
];

function providerQuote(
  providerSymbol: string,
  currency: string,
) {
  return {
    symbol: providerSymbol,
    providerId: "twelve_data",
    providerSymbol,
    provider: "Twelve Data",
    price: currency === "USD" ? 200 : 185,
    currency,
    quality: "near_realtime",
    marketStatus: "open",
    timestamp: "2026-08-22T10:00:00.000Z",
  };
}

describe("canonical quote provider failover", () => {
  it("uses each provider's verified symbols without collapsing same-symbol listings", async () => {
    const primaryGetQuotes = vi
      .fn()
      .mockRejectedValue(new Error("primary unavailable"));
    const fallbackGetQuotes = vi.fn().mockResolvedValue([
      providerQuote("AAPL:XNAS", "USD"),
      providerQuote("AAPL:XETR", "EUR"),
    ]);
    const chain = new ChainedQuoteProvider([
      {
        providerName: "FMP",
        providerId: "fmp",
        quality: "delayed",
        streamMode: "rest_polling",
        getQuote: vi.fn(),
        getQuotes: primaryGetQuotes,
        getQuotesBatch: vi.fn(),
      },
      {
        providerName: "Twelve Data",
        providerId: "twelve_data",
        quality: "near_realtime",
        streamMode: "rest_polling",
        getQuote: vi.fn(),
        getQuotes: fallbackGetQuotes,
        getQuotesBatch: vi.fn(),
      },
    ]);

    const quotes = await chain.getCanonicalQuotes(instruments);

    expect(chain.providerIds).toEqual(["fmp", "twelve_data"]);
    expect(primaryGetQuotes).toHaveBeenCalledWith(["AAPL", "AAPL.DE"]);
    expect(fallbackGetQuotes).toHaveBeenCalledWith([
      "AAPL:XNAS",
      "AAPL:XETR",
    ]);
    expect(quotes).toEqual([
      expect.objectContaining({
        canonicalId: "stock:xnas:aapl:usd",
        instrumentId: "instrument-us",
        providerId: "twelve_data",
        providerSymbol: "AAPL:XNAS",
        currency: "USD",
      }),
      expect.objectContaining({
        canonicalId: "stock:xetr:aapl:eur",
        instrumentId: "instrument-de",
        providerId: "twelve_data",
        providerSymbol: "AAPL:XETR",
        currency: "EUR",
      }),
    ]);
  });
});
