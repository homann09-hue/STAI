import { describe, expect, it } from "vitest";
import { instrumentCatalogHitToUniverse, type InstrumentCatalogHit } from "@/lib/instrument-catalog";

function hit(overrides: Partial<InstrumentCatalogHit> = {}): InstrumentCatalogHit {
  return {
    canonicalId: "stock:nasdaq:test:usd",
    symbol: "TEST",
    name: "Test Corporation",
    assetClass: "stock",
    exchange: "NASDAQ",
    exchangeFullName: "Nasdaq",
    country: "US",
    currency: "USD",
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
    ...overrides
  };
}

describe("Instrumentkatalog in der UI", () => {
  it("stellt delayed niemals als realtime dar", () => {
    const result = instrumentCatalogHitToUniverse(hit());
    expect(result.quoteQuality).toBe("delayed");
    expect(result.subscribable).toBe(false);
    expect(result.analysisReadiness).toBe("limited");
  });

  it("blockiert ein tarifgesperrtes Instrument ohne seine Identitaet zu verwerfen", () => {
    const result = instrumentCatalogHitToUniverse(
      hit({ quoteStatus: "restricted", quoteQuality: "unavailable" })
    );
    expect(result.symbol).toBe("TEST");
    expect(result.coverage).toBe("license_required");
    expect(result.analysisReadiness).toBe("blocked");
  });

  it("macht ungepruefte Provider-Treffer sichtbar statt verfuegbar", () => {
    const result = instrumentCatalogHitToUniverse(
      hit({ origin: "provider_search", quoteStatus: "unknown", quoteQuality: "unavailable" })
    );
    expect(result.coverage).toBe("prepared");
    expect(result.note).toMatch(/ungeprueft/i);
  });
});
