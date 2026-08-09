import { describe, expect, it } from "vitest";
import {
  inferAssetClass,
  instrumentDirectoryCapabilityReport
} from "./instrument-directory-provider.pure";

/**
 * Die Erwartungswerte stammen aus echten FMP-Antworten, gemessen am 2026-08-07.
 * Sie sind bewusst nicht erfunden, damit ein Providerwechsel im Antwortformat
 * hier sichtbar bricht.
 */
describe("inferAssetClass", () => {
  it("erkennt Krypto am Handelsplatz, nicht am Namen", () => {
    const result = inferAssetClass({ symbol: "BTCUSD", name: "Bitcoin USD", exchange: "CRYPTO" });
    expect(result).toEqual({ assetClass: "crypto", certain: true });
  });

  it("erkennt Devisenpaare am Handelsplatz", () => {
    const result = inferAssetClass({ symbol: "EURUSD", name: "EUR/USD", exchange: "FOREX" });
    expect(result).toEqual({ assetClass: "forex", certain: true });
  });

  it("erkennt Indizes am Handelsplatz und am Caret-Praefix", () => {
    expect(inferAssetClass({ symbol: "^GSPC", name: "S&P 500", exchange: "INDEX" })).toEqual({
      assetClass: "index",
      certain: true
    });
    expect(inferAssetClass({ symbol: "^NDX", name: "Nasdaq 100", exchange: "unknown" })).toEqual({
      assetClass: "index",
      certain: true
    });
  });

  it("leitet ETFs nur heuristisch ab und markiert das als unsicher", () => {
    const result = inferAssetClass({
      symbol: "SPY",
      name: "State Street SPDR S&P 500 ETF",
      exchange: "AMEX"
    });
    expect(result.assetClass).toBe("etf");
    expect(result.certain).toBe(false);
  });

  it("faellt auf Aktie zurueck, statt eine Klasse zu erfinden", () => {
    const result = inferAssetClass({ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" });
    expect(result).toEqual({ assetClass: "stock", certain: false });
  });

  it("stuft eine Aktie mit BTC im Namen nicht als Krypto ein", () => {
    // Realer FMP-Treffer: BTCS Inc. ist eine NASDAQ-Aktie, keine Kryptowaehrung.
    const result = inferAssetClass({ symbol: "BTCS", name: "BTCS Inc.", exchange: "NASDAQ" });
    expect(result.assetClass).toBe("stock");
  });

  it("erkennt einen Bitcoin-Trust-ETF trotz Krypto-Bezug im Namen als ETF", () => {
    const result = inferAssetClass({
      symbol: "BTC",
      name: "Grayscale Bitcoin Mini Trust ETF",
      exchange: "AMEX"
    });
    expect(result.assetClass).toBe("etf");
  });
});

describe("instrumentDirectoryCapabilityReport", () => {
  it("behauptet keine Verzeichnisabdeckung", () => {
    const report = instrumentDirectoryCapabilityReport(true);
    expect(report.directorySyncAvailable).toBe(false);
    expect(report.consequence).toMatch(/nicht erreichbar/i);
  });

  it("dokumentiert die gemessenen Sperren mit HTTP-Status", () => {
    const report = instrumentDirectoryCapabilityReport(true);
    const blocked = Object.fromEntries(report.blockedEndpoints.map((e) => [e.endpoint, e.status]));

    expect(blocked["v3/stock/list"]).toBe(403);
    expect(blocked["stable/company-screener"]).toBe(402);
    expect(blocked["stable/search-isin"]).toBe(402);
    expect(report.availableEndpoints.map((e) => e.endpoint)).toContain("stable/search-symbol");
  });
});
