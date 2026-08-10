import { describe, expect, it } from "vitest";
import { resolveAssetUnavailability } from "./asset-availability";
import type { KnownInstrumentIdentity } from "./asset-availability";

function identity(overrides: Partial<KnownInstrumentIdentity> = {}): KnownInstrumentIdentity {
  return {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    assetClass: "etf",
    exchange: "NASDAQ",
    currency: "USD",
    provider: "FMP",
    quoteStatus: "restricted",
    ...overrides
  };
}

describe("resolveAssetUnavailability", () => {
  it("behauptet bei unvollständigem Katalog nicht, ein Instrument existiere nicht", () => {
    const result = resolveAssetUnavailability({ symbol: "GIBTESNICHT", known: null });

    expect(result.reason).toBe("identity_unverified");
    expect(result.httpStatus).toBe(503);
    expect(result.identity).toBeNull();
    expect(result.message).not.toMatch(/nicht gefunden/i);
  });

  it("meldet ein bekanntes, aber gesperrtes Instrument nicht als nicht gefunden", () => {
    // Kern des Fixes: QQQ existiert. Ein 404 waere eine falsche Auskunft.
    const result = resolveAssetUnavailability({ symbol: "QQQ", known: identity() });

    expect(result.reason).toBe("quote_not_entitled");
    expect(result.httpStatus).toBe(403);
    expect(result.message).not.toMatch(/nicht gefunden/i);
    expect(result.message).toMatch(/existiert/i);
  });

  it("gibt bei Tarifsperre die bekannte Identitaet trotzdem heraus", () => {
    const result = resolveAssetUnavailability({ symbol: "QQQ", known: identity() });

    expect(result.identity).not.toBeNull();
    expect(result.identity?.name).toBe("Invesco QQQ Trust");
    expect(result.identity?.exchange).toBe("NASDAQ");
    expect(result.identity?.currency).toBe("USD");
  });

  it("nennt bei jeder Sackgasse einen naechsten Schritt", () => {
    const unknown = resolveAssetUnavailability({ symbol: "XX", known: null });
    const blocked = resolveAssetUnavailability({ symbol: "QQQ", known: identity() });

    expect(unknown.remediation).toBeTruthy();
    expect(blocked.remediation).toBeTruthy();
  });

  it("unterscheidet einen Betriebsfehler von einer Tarifsperre", () => {
    // Ein voruebergehender Providerfehler darf nicht wie eine dauerhafte
    // Sperre aussehen, sonst haelt der Nutzer das Instrument fuer unbrauchbar.
    const result = resolveAssetUnavailability({
      symbol: "AAPL",
      known: identity({ symbol: "AAPL", quoteStatus: "error" })
    });

    expect(result.reason).toBe("provider_error");
    expect(result.httpStatus).toBe(503);
    expect(result.remediation).toMatch(/späterer Versuch|vorübergehend/i);
  });

  it("behandelt ein bekanntes, aber ungepruefte Instrument als Betriebsfehler, nicht als Sperre", () => {
    const result = resolveAssetUnavailability({
      symbol: "MSFT",
      known: identity({ symbol: "MSFT", quoteStatus: "unknown" })
    });

    expect(result.reason).toBe("provider_error");
    expect(result.reason).not.toBe("quote_not_entitled");
  });
});
