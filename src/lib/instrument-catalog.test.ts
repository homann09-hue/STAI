import { describe, expect, it } from "vitest";
import {
  instrumentCatalogHitToUniverse,
  rankInstrumentCatalogHits,
  type InstrumentCatalogHit,
} from "@/lib/instrument-catalog";

function hit(
  overrides: Partial<InstrumentCatalogHit> = {},
): InstrumentCatalogHit {
  const base: InstrumentCatalogHit = {
    internalInstrumentId: "2ee2c553-920d-445e-9a43-a6630e205cc7",
    canonicalId: "stock:nasdaq:test:usd",
    symbol: "TEST",
    displaySymbol: "TEST",
    name: "Test Corporation",
    assetClass: "stock",
    instrumentType: "stock",
    exchangeName: "Nasdaq",
    exchangeCode: "NASDAQ",
    mic: "XNAS",
    exchange: "NASDAQ",
    exchangeFullName: "Nasdaq",
    country: "US",
    currency: "USD",
    isin: null,
    figi: null,
    providerMappings: [
      { providerId: "FMP", providerSymbol: "TEST", exchangeCode: "NASDAQ" },
    ],
    tradingTimezone: "America/New_York",
    pricePrecision: 2,
    quantityPrecision: 0,
    isActive: null,
    isDelisted: null,
    provider: "FMP",
    identifiers: [{ type: "ticker", value: "TEST" }],
    identityConfidence: 92,
    resolutionStatus: "resolved",
    resolutionWarnings: [],
    origin: "instrument_master",
    quoteStatus: "available",
    quoteQuality: "delayed",
    quoteCheckedAt: "2026-08-10T08:00:00.000Z",
    discoveredAt: "2026-08-10T07:00:00.000Z",
    confirmationCount: 3,
    matchedVia: null,
  };
  return { ...base, ...overrides };
}

describe("Instrumentkatalog in der UI", () => {
  it("ordnet einen exakten Ticker vor einem haeufiger bestaetigten Suffix-Listing ein", () => {
    const exact = hit({
      canonicalId: "stock:nasdaq:aapl:usd",
      symbol: "AAPL",
      displaySymbol: "AAPL",
      name: "Apple Inc.",
      confirmationCount: 1,
    });
    const suffixListing = hit({
      canonicalId: "stock:neo:aapl.ne:cad",
      symbol: "AAPL.NE",
      displaySymbol: "AAPL.NE",
      name: "Apple CDR",
      confirmationCount: 100,
    });

    const result = rankInstrumentCatalogHits([suffixListing, exact], "aapl");

    expect(result.map((item) => item.symbol)).toEqual(["AAPL", "AAPL.NE"]);
  });

  it("ordnet eine exakte Providerkennung vor einem reinen Namenstreffer ein", () => {
    const identifierMatch = hit({
      canonicalId: "stock:nasdaq:aapl:usd",
      symbol: "AAPL",
      name: "Apple Inc.",
      identifiers: [
        { type: "provider_symbol", value: "US0378331005", provider: "FMP" },
      ],
      confirmationCount: 1,
    });
    const nameMatch = hit({
      canonicalId: "stock:otc:example:usd",
      symbol: "EXAMPLE",
      name: "US0378331005 Holdings",
      confirmationCount: 100,
    });

    const result = rankInstrumentCatalogHits(
      [nameMatch, identifierMatch],
      "US0378331005",
    );

    expect(result[0]?.canonicalId).toBe(identifierMatch.canonicalId);
  });

  it("bewahrt bei gleichwertigen Listings die Relevanzreihenfolge des Providers", () => {
    const primary = hit({
      canonicalId: "stock:nasdaq:aapl:usd",
      symbol: "AAPL",
      name: "Apple Inc.",
      origin: "provider_search",
      quoteStatus: "unknown",
      confirmationCount: 1,
    });
    const secondary = hit({
      canonicalId: "stock:bcba:aapl:ars",
      symbol: "AAPL",
      name: "Apple Inc. CEDEAR",
      origin: "provider_search",
      quoteStatus: "unknown",
      confirmationCount: 1,
    });
    expect(rankInstrumentCatalogHits([primary, secondary], "AAPL")[0]).toBe(
      primary,
    );
  });

  it("stellt delayed niemals als realtime dar", () => {
    const result = instrumentCatalogHitToUniverse(hit());
    expect(result.quoteQuality).toBe("delayed");
    expect(result.subscribable).toBe(false);
    expect(result.analysisReadiness).toBe("limited");
  });

  it("blockiert ein tarifgesperrtes Instrument ohne seine Identitaet zu verwerfen", () => {
    const result = instrumentCatalogHitToUniverse(
      hit({ quoteStatus: "restricted", quoteQuality: "unavailable" }),
    );
    expect(result.symbol).toBe("TEST");
    expect(result.coverage).toBe("license_required");
    expect(result.analysisReadiness).toBe("blocked");
  });

  it("macht ungepruefte Provider-Treffer sichtbar statt verfuegbar", () => {
    const result = instrumentCatalogHitToUniverse(
      hit({
        origin: "provider_search",
        quoteStatus: "unknown",
        quoteQuality: "unavailable",
      }),
    );
    expect(result.coverage).toBe("prepared");
    expect(result.note).toMatch(/ungeprueft/i);
  });
});
