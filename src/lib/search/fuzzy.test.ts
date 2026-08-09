import { describe, expect, it } from "vitest";
import { editDistance, isValidIsin, looksLikeIsin, searchInstruments, similarity } from "@/lib/search/fuzzy";

/**
 * §48 verlangt eine Suche über Ticker, Name, ISIN, ETF, Index und Krypto — mit
 * Fuzzy Search.
 *
 * Der Entwurf folgt einer Regel: **ein falscher Treffer ist schlimmer als kein
 * Treffer.** Die Tests prüfen deshalb beides — dass Tippfehler gefunden werden,
 * und dass Unsinn nichts findet.
 */

const universe = [
  { symbol: "AAPL", name: "Apple Inc.", isin: "US0378331005", assetClass: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", isin: "US5949181045", assetClass: "stock" },
  { symbol: "GM", name: "General Motors Company", isin: "US37045V1008", assetClass: "stock" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", isin: "US9229083632", assetClass: "etf" },
  { symbol: "^GSPC", name: "S&P 500 Index", isin: null, assetClass: "index" },
  { symbol: "BTC-USD", name: "Bitcoin", isin: null, assetClass: "crypto" },
  { symbol: "NESN", name: "Nestlé S.A.", isin: "CH0038863350", assetClass: "stock" }
];

const find = (query: string) => searchInstruments(query, universe);

describe("wörtliche Treffer", () => {
  it("findet den Ticker", () => {
    expect(find("AAPL").hits[0].item.symbol).toBe("AAPL");
    expect(find("aapl").hits[0].kind).toBe("exact");
  });

  it("findet den Firmennamen", () => {
    expect(find("Microsoft Corporation").hits[0].item.symbol).toBe("MSFT");
  });

  it("findet über den Wortanfang", () => {
    expect(find("Micro").hits[0].item.symbol).toBe("MSFT");
  });

  it("findet ein Wort mitten im Namen", () => {
    // "motors" soll General Motors finden -- ein Praefixvergleich auf den
    // ganzen Namen wuerde das verfehlen.
    expect(find("Motors").hits[0].item.symbol).toBe("GM");
  });

  it("findet ETF, Index und Krypto", () => {
    expect(find("Vanguard").hits[0].item.assetClass).toBe("etf");
    expect(find("S&P 500 Index").hits[0].item.assetClass).toBe("index");
    expect(find("Bitcoin").hits[0].item.assetClass).toBe("crypto");
  });

  it("ignoriert Akzente", () => {
    // "Nestlé" muss auch ohne Akzent auffindbar sein.
    expect(find("Nestle").hits[0].item.symbol).toBe("NESN");
  });
});

describe("Tippfehler", () => {
  it("zählt einen Zahlendreher als einen Fehler", () => {
    // Der haeufigste Tippfehler ueberhaupt. Ohne Damerau waeren das zwei.
    expect(editDistance("microsoft", "mircosoft")).toBe(1);
    expect(editDistance("apple", "aplpe")).toBe(1);
  });

  it("findet vertippte Firmennamen", () => {
    expect(find("Mircosoft").hits[0].item.symbol).toBe("MSFT");
    expect(find("Microsft").hits[0].item.symbol).toBe("MSFT");
  });

  it("stellt unscharfe Treffer hinter wörtliche", () => {
    // Ein aehnlich geschriebener Treffer darf nie ueber einem woertlichen
    // stehen.
    const fuzzy = find("Mircosoft").hits[0];
    const exact = find("MSFT").hits[0];

    expect(fuzzy.kind).toBe("fuzzy");
    expect(fuzzy.score).toBeLessThan(exact.score);
  });

  it("nennt den Grund für den Treffer", () => {
    // §104: nachvollziehbar, warum etwas erschienen ist.
    expect(find("Mircosoft").hits[0].reason).toContain("Ähnlich geschrieben");
    expect(find("AAPL").hits[0].reason).toContain("Ticker");
  });
});

describe("was nichts finden darf", () => {
  it("gibt bei Unsinn keinen Treffer aus", () => {
    // Der Kern: wer "qqqwwweee" tippt, meint nichts. Das Aehnlichste
    // auszugeben waere schlimmer als nichts.
    const result = find("qqqwwweee");

    expect(result.hits).toHaveLength(0);
    expect(result.note).toContain("Kein Instrument gefunden");
  });

  it("sucht kurze Eingaben nicht unscharf", () => {
    // Bei drei Zeichen ist fast alles zu allem aehnlich.
    expect(find("xyz").hits).toHaveLength(0);
  });

  it("liefert bei leerer Eingabe nichts und keine Meldung", () => {
    expect(searchInstruments("", universe)).toEqual({ hits: [], note: null });
    expect(searchInstruments("   ", universe).hits).toHaveLength(0);
  });
});

describe("ISIN", () => {
  it("prüft die Prüfziffer echter ISINs", () => {
    expect(isValidIsin("US0378331005")).toBe(true); // Apple
    expect(isValidIsin("US5949181045")).toBe(true); // Microsoft
    expect(isValidIsin("CH0038863350")).toBe(true); // Nestlé
    expect(isValidIsin("DE0007164600")).toBe(true); // SAP
  });

  it("erkennt eine falsche Prüfziffer", () => {
    expect(isValidIsin("US0378331006")).toBe(false);
    expect(isValidIsin("DE0007164601")).toBe(false);
  });

  it("erkennt ein falsches Format", () => {
    expect(isValidIsin("US03783310")).toBe(false);
    expect(isValidIsin("0S0378331005")).toBe(false);
    expect(isValidIsin("")).toBe(false);
  });

  it("findet ein Papier über seine ISIN", () => {
    const result = find("US0378331005");

    expect(result.hits[0].item.symbol).toBe("AAPL");
    expect(result.hits[0].kind).toBe("isin");
  });

  it("sucht ISINs nicht unscharf", () => {
    // Eine um ein Zeichen abweichende ISIN ist ein anderes Papier, kein
    // aehnliches.
    const result = find("US0378331006");

    expect(result.hits).toHaveLength(0);
  });

  it("nennt eine falsche Prüfziffer einen Tippfehler statt ein fehlendes Papier", () => {
    // Der Unterschied entscheidet, wo der Nutzer weitersucht.
    const typo = find("US0378331006");
    const unknown = find("GB0002634946");

    expect(typo.note).toContain("Tippfehler");
    expect(unknown.note).toContain("nicht hinterlegt");
  });

  it("unterscheidet Aussehen von Gültigkeit", () => {
    expect(looksLikeIsin("US0378331006")).toBe(true);
    expect(isValidIsin("US0378331006")).toBe(false);
  });
});

describe("Ähnlichkeit", () => {
  it("ist bei gleichen Zeichenketten eins", () => {
    expect(similarity("apple", "apple")).toBe(1);
    expect(similarity("", "")).toBe(1);
  });

  it("sinkt mit der Zahl der Fehler", () => {
    expect(similarity("microsoft", "mircosoft")).toBeGreaterThan(similarity("microsoft", "mxrxoxoft"));
  });
});
