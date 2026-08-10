import { describe, expect, it } from "vitest";
import { primaryQuoteProvider, resolveQuoteChain, type QuoteChainEnv } from "@/lib/providers/quote-chain";

/**
 * §21 verlangt Primary, Secondary und Fallback. Der wichtigste Test dieser
 * Datei ist der, der eine Ausfallsicherheit **verneint**, die es nicht gibt:
 * mit einer einzigen konfigurierten Quelle ist die Kette keine Kette, und das
 * muss die Antwort sagen statt es zu verschweigen.
 */

const env = (values: QuoteChainEnv): QuoteChainEnv => values;

describe("resolveQuoteChain", () => {
  it("bildet aus zwei Schlüsseln eine echte Rangfolge", () => {
    const chain = resolveQuoteChain(env({ FMP_API_KEY: "x", FINNHUB_API_KEY: "y" }));

    expect(chain.providers).toEqual(["fmp", "finnhub"]);
    expect(chain.hasFailover).toBe(true);
    expect(chain.note).toMatch(/nächste Quelle versucht/);
  });

  it("nennt eine einzelne Quelle nicht ausfallsicher", () => {
    // Der Kern: eine Rangfolge zwischen einer Quelle und sich selbst ist keine.
    const chain = resolveQuoteChain(env({ FMP_API_KEY: "x" }));

    expect(chain.providers).toEqual(["fmp"]);
    expect(chain.hasFailover).toBe(false);
    expect(chain.note).toMatch(/keinen echten Ersatz/);
  });

  it("nimmt nur Quellen auf, für die ein Schlüssel gesetzt ist", () => {
    const chain = resolveQuoteChain(env({ FINNHUB_API_KEY: "y", ALPHA_VANTAGE_API_KEY: "  " }));

    // Leerzeichen sind kein Schluessel.
    expect(chain.providers).toEqual(["finnhub"]);
  });

  it("erkennt beide Schreibweisen desselben Anbieters", () => {
    expect(resolveQuoteChain(env({ TWELVEDATA_API_KEY: "z" })).providers).toEqual(["twelve_data"]);
    expect(resolveQuoteChain(env({ TWELVE_DATA_API_KEY: "z" })).providers).toEqual(["twelve_data"]);
    expect(resolveQuoteChain(env({ POLYGON_API_KEY: "z" })).providers).toEqual(["massive"]);
  });

  it("stellt eine ausdrückliche Wahl nach vorne, ohne den Rückfall abzuschalten", () => {
    // Wer eine Quelle bevorzugt, will damit fast nie sagen "und sonst lieber
    // Demodaten".
    const chain = resolveQuoteChain(
      env({ MARKET_DATA_PROVIDER: "finnhub", FMP_API_KEY: "x", FINNHUB_API_KEY: "y" })
    );

    expect(chain.providers).toEqual(["finnhub", "fmp"]);
    expect(chain.hasFailover).toBe(true);
  });

  it("führt eine ausdrücklich gewählte Quelle nicht doppelt", () => {
    const chain = resolveQuoteChain(env({ MARKET_DATA_PROVIDER: "fmp", FMP_API_KEY: "x", FINNHUB_API_KEY: "y" }));
    expect(chain.providers).toEqual(["fmp", "finnhub"]);
  });

  it("behandelt „mock“ als Ansage, nicht als Bevorzugung", () => {
    // Wer ausdruecklich Mock waehlt, will keine echten Abrufe -- auch dann
    // nicht, wenn Schluessel vorhanden sind.
    const chain = resolveQuoteChain(env({ MARKET_DATA_PROVIDER: "mock", FMP_API_KEY: "x" }));

    expect(chain.providers).toEqual([]);
    expect(chain.hasFailover).toBe(false);
    expect(chain.note).toMatch(/keine echten Quellen/);
  });

  it("sagt bei fehlender Konfiguration deutlich, dass Produktion geschlossen ausfaellt", () => {
    const chain = resolveQuoteChain(env({}));

    expect(chain.providers).toEqual([]);
    expect(chain.note).toMatch(/keine Ersatzkurse/);
  });

  it("behandelt „auto“ wie keine Angabe", () => {
    const explicit = resolveQuoteChain(env({ MARKET_DATA_PROVIDER: "auto", FMP_API_KEY: "x", FINNHUB_API_KEY: "y" }));
    const implicit = resolveQuoteChain(env({ FMP_API_KEY: "x", FINNHUB_API_KEY: "y" }));

    expect(explicit.providers).toEqual(implicit.providers);
  });

  it("hält die Standardrangfolge nach Abdeckung ein", () => {
    const chain = resolveQuoteChain(
      env({
        ALPHA_VANTAGE_API_KEY: "a",
        EODHD_API_KEY: "b",
        FINNHUB_API_KEY: "c",
        FMP_API_KEY: "d"
      })
    );

    expect(chain.providers).toEqual(["fmp", "finnhub", "eodhd", "alpha_vantage"]);
  });
});

describe("primaryQuoteProvider", () => {
  it("nennt den bevorzugten Anbieter", () => {
    expect(primaryQuoteProvider(env({ FMP_API_KEY: "x", FINNHUB_API_KEY: "y" }))).toBe("fmp");
  });

  it("gibt ohne Konfiguration nichts zurück statt einer Vermutung", () => {
    expect(primaryQuoteProvider(env({}))).toBeNull();
  });
});
