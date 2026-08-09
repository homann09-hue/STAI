import { describe, expect, it } from "vitest";
import { assessInstrumentIdentity, buildCanonicalInstrumentId } from "./instrument-identity";
import type { InstrumentIdentityInput } from "./instrument-identity";

function hit(overrides: Partial<InstrumentIdentityInput> = {}): InstrumentIdentityInput {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    assetClass: "stock",
    matchedVia: "symbol",
    ...overrides
  };
}

describe("buildCanonicalInstrumentId", () => {
  it("trennt Mehrfachlistings desselben Unternehmens", () => {
    const nasdaq = buildCanonicalInstrumentId({
      assetClass: "stock",
      exchange: "NASDAQ",
      symbol: "AAPL",
      currency: "USD"
    });
    const xetra = buildCanonicalInstrumentId({
      assetClass: "stock",
      exchange: "XETRA",
      symbol: "AAPL.DE",
      currency: "EUR"
    });

    expect(nasdaq).toBe("stock:nasdaq:aapl:usd");
    expect(nasdaq).not.toBe(xetra);
  });

  it("ist stabil gegenueber Schreibweise und Sonderzeichen", () => {
    const a = buildCanonicalInstrumentId({
      assetClass: "stock",
      exchange: "New York Stock Exchange Arca",
      symbol: "SPY",
      currency: "USD"
    });
    const b = buildCanonicalInstrumentId({
      assetClass: "stock",
      exchange: "new york stock exchange arca",
      symbol: "SPY",
      currency: "usd"
    });

    expect(a).toBe(b);
  });

  it("faellt auf lesbare Platzhalter zurueck statt auf leere Segmente", () => {
    const id = buildCanonicalInstrumentId({
      assetClass: "stock",
      exchange: "",
      symbol: "XYZ",
      currency: ""
    });
    expect(id).toBe("stock:unknown-exchange:xyz:unknown-currency");
  });
});

describe("assessInstrumentIdentity", () => {
  it("weist immer auf die fehlende ISIN hin, weil der Tarif keine liefert", () => {
    const identity = assessInstrumentIdentity(hit());
    expect(identity.resolutionWarnings.join(" ")).toMatch(/ISIN/i);
  });

  it("belohnt eine sichere Assetklasse aus dem Handelsplatz", () => {
    const crypto = assessInstrumentIdentity(
      hit({ symbol: "BTCUSD", name: "Bitcoin USD", exchange: "CRYPTO", assetClass: "crypto" })
    );
    const stock = assessInstrumentIdentity(hit());

    expect(crypto.identityConfidence).toBeGreaterThan(stock.identityConfidence);
    expect(crypto.resolutionStatus).toBe("resolved");
  });

  it("stuft einen Treffer ohne Handelsplatz herab und warnt sichtbar", () => {
    const identity = assessInstrumentIdentity(hit({ exchange: "unknown" }));

    expect(identity.identityConfidence).toBeLessThan(60);
    expect(identity.resolutionWarnings.join(" ")).toMatch(/Handelsplatz/i);
    expect(identity.resolutionStatus).not.toBe("resolved");
  });

  it("wertet einen Namenstreffer schwaecher als einen Symboltreffer", () => {
    const bySymbol = assessInstrumentIdentity(hit({ matchedVia: "symbol" }));
    const byName = assessInstrumentIdentity(hit({ matchedVia: "name" }));

    expect(byName.identityConfidence).toBeLessThan(bySymbol.identityConfidence);
  });

  it("behauptet nie eine aufgeloeste Identitaet bei heuristischer Klasse ohne Boerse", () => {
    const identity = assessInstrumentIdentity(
      hit({ exchange: "unknown", matchedVia: "name", name: "Irgendein Fonds ETF", assetClass: "etf" })
    );
    expect(identity.resolutionStatus).toBe("ambiguous");
  });
});
