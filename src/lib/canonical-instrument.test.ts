import { describe, expect, it } from "vitest";
import { buildCanonicalInstrument } from "./canonical-instrument";

const base = {
  internalInstrumentId: "9bd24323-966f-4f0a-bb63-e52df7865d48",
  canonicalId: "stock:xnas:aapl:usd",
  symbol: "aapl",
  name: "Apple Inc.",
  assetClass: "stock" as const,
  exchangeName: "Nasdaq Global Select Market",
  exchangeCode: "NASDAQ",
  currency: "usd",
  primaryProvider: "FMP",
};

describe("canonical instrument", () => {
  it("keeps verified listing identifiers and provider mappings", () => {
    const instrument = buildCanonicalInstrument({
      ...base,
      displaySymbol: "AAPL",
      mic: "xnas",
      country: "us",
      tradingTimezone: "America/New_York",
      pricePrecision: 2,
      quantityPrecision: 0,
      isActive: true,
      isDelisted: false,
      identifiers: [
        { type: "isin", value: "US0378331005" },
        { type: "figi", value: "BBG000B9XRY4" },
        { type: "provider_symbol", value: "AAPL", provider: "Finnhub" },
      ],
    });

    expect(instrument).toMatchObject({
      symbol: "AAPL",
      mic: "XNAS",
      isin: "US0378331005",
      figi: "BBG000B9XRY4",
      tradingTimezone: "America/New_York",
      pricePrecision: 2,
      quantityPrecision: 0,
      isActive: true,
      isDelisted: false,
    });
    expect(instrument.providerMappings).toEqual([
      { providerId: "Finnhub", providerSymbol: "AAPL", exchangeCode: "NASDAQ" },
      { providerId: "FMP", providerSymbol: "AAPL", exchangeCode: "NASDAQ" },
    ]);
  });

  it("keeps unavailable reference fields explicitly null", () => {
    expect(buildCanonicalInstrument(base)).toMatchObject({
      isin: null,
      figi: null,
      mic: null,
      tradingTimezone: null,
      pricePrecision: null,
      quantityPrecision: null,
      isActive: null,
      isDelisted: null,
    });
  });

  it("does not publish a contradictory active and delisted status", () => {
    expect(
      buildCanonicalInstrument({ ...base, isActive: true, isDelisted: true }),
    ).toMatchObject({ isActive: null, isDelisted: null });
  });

  it("rejects malformed reference identifiers instead of forwarding them", () => {
    expect(
      buildCanonicalInstrument({
        ...base,
        mic: "NASDAQ",
        identifiers: [
          { type: "isin", value: "NOT-AN-ISIN" },
          { type: "figi", value: "NOT-A-FIGI" },
        ],
      }),
    ).toMatchObject({ mic: null, isin: null, figi: null });
  });
});
