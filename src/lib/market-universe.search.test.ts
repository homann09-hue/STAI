import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstrumentCatalogHit } from "@/lib/instrument-catalog";

const searchInstrumentCatalog = vi.fn();

vi.mock("@/lib/instrument-catalog-service", () => ({
  searchInstrumentCatalog: (input: unknown) => searchInstrumentCatalog(input)
}));

const providerHit: InstrumentCatalogHit = {
  canonicalId: "stock:nasdaq:acme:usd",
  symbol: "ACME",
  name: "Acme Corporation",
  assetClass: "stock",
  exchange: "NASDAQ",
  exchangeFullName: "Nasdaq Global Market",
  country: "US",
  currency: "USD",
  provider: "FMP",
  identifiers: [{ type: "ticker", value: "ACME" }],
  identityConfidence: 88,
  resolutionStatus: "resolved",
  resolutionWarnings: [],
  origin: "provider_search",
  quoteStatus: "unknown",
  quoteQuality: "unavailable",
  quoteCheckedAt: null,
  discoveredAt: "2026-08-10T00:00:00.000Z",
  confirmationCount: 1,
  matchedVia: "symbol"
};

beforeEach(() => {
  searchInstrumentCatalog.mockReset();
  searchInstrumentCatalog.mockResolvedValue({
    results: [providerHit],
    coverage: {
      complete: false,
      mode: "search_driven",
      directorySyncAvailable: false,
      note: "search only",
      consequence: "incomplete",
      verifiedAt: "2026-08-10"
    },
    provider: "FMP + StockPilot Instrument Master",
    receivedAt: "2026-08-10T00:00:01.000Z"
  });
});

describe("dynamisches Marktuniversum", () => {
  it("liefert ausschliesslich Treffer des Instrumentkatalogs", async () => {
    const { getMarketUniverse } = await import("@/lib/market-universe");
    const instruments = await getMarketUniverse({ query: "ACME", limit: 20 });

    expect(instruments.map((item) => item.symbol)).toEqual(["ACME"]);
    expect(instruments.some((item) => ["AAPL", "MSFT", "BTC-USD"].includes(item.symbol))).toBe(false);
  });

  it("reicht Filter und Limit an den zentralen Katalog weiter", async () => {
    const { getMarketUniverse } = await import("@/lib/market-universe");
    await getMarketUniverse({ query: "Acme", assetClass: "stock", limit: 17 });

    expect(searchInstrumentCatalog).toHaveBeenCalledWith({
      query: "Acme",
      assetClass: "stock",
      limit: 17
    });
  });

  it("kennzeichnet einen noch ungeprueften Providertreffer als eingeschraenkt", async () => {
    const { getMarketUniverse } = await import("@/lib/market-universe");
    const [instrument] = await getMarketUniverse({ query: "ACME" });

    expect(instrument.coverage).toBe("prepared");
    expect(instrument.quoteQuality).toBe("unavailable");
    expect(instrument.analysisReadiness).toBe("limited");
  });
});
