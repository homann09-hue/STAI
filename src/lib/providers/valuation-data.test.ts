import { describe, expect, it } from "vitest";
import {
  buildValuationInputs,
  parseAnalystView,
  parseKeyMetrics,
  parsePeers,
  parseRatioHistory,
  toDcfAssumptions
} from "@/lib/providers/valuation-data";

/**
 * Die Zuordnung der Feldnamen ist hier die eigentliche Fehlerquelle. Sie
 * scheitert leise: `priceToEarningsRatio` und `priceToEarningsDilutedRatio`
 * sind zwei verschiedene Zahlen mit fast gleichem Namen, und wer die falsche
 * nimmt, merkt es nie.
 *
 * Die Werte stammen aus echten Antworten vom 2026-08-08.
 */

const ratioRow = {
  fiscalYear: "2025",
  grossProfitMargin: 0.4690516410716045,
  netProfitMargin: 0.2691506412181824,
  priceToEarningsRatio: 34.1068090787717,
  priceToEarningsDilutedRatio: 34.243967828418235,
  priceToBookRatio: 51.79151546797228,
  priceToSalesRatio: 9.176121284791222,
  debtToEquityRatio: 1.5241072518411023
};

describe("Kennzahlenreihe", () => {
  it("nimmt das unverwässerte KGV, nicht das verwässerte", () => {
    // Zwei Felder, fast gleicher Name, verschiedene Zahl. Wer hier danebengreift,
    // merkt es nie.
    const [year] = parseRatioHistory([ratioRow]);

    expect(year.peRatio).toBeCloseTo(34.1068, 4);
    expect(year.peRatio).not.toBeCloseTo(34.2439, 4);
  });

  it("liest alle Kennzahlen des Jahres", () => {
    const [year] = parseRatioHistory([ratioRow]);

    expect(year.fiscalYear).toBe("2025");
    expect(year.grossMargin).toBeCloseTo(0.469, 3);
    expect(year.netMargin).toBeCloseTo(0.269, 3);
    expect(year.priceToBook).toBeCloseTo(51.79, 2);
    expect(year.debtToEquity).toBeCloseTo(1.524, 3);
  });

  it("macht aus fehlenden Feldern null statt null-Werten", () => {
    const [year] = parseRatioHistory([{ fiscalYear: "2024" }]);

    expect(year.peRatio).toBeNull();
    expect(year.grossMargin).toBeNull();
  });

  it("verträgt fremde Antworten", () => {
    expect(parseRatioHistory(null)).toEqual([]);
    expect(parseRatioHistory({ error: "Payment Required" })).toEqual([]);
    expect(parseRatioHistory(["kein Objekt", null])).toEqual([]);
  });
});

describe("Kennzahlen aus key-metrics", () => {
  it("holt die Eigenkapitalrendite von dort statt aus ratios", () => {
    // In `ratios` ist das Feld im Tarif durchgehend 0. Ein Wert von 0 % waere
    // eine Aussage, keine Luecke -- deshalb die andere Quelle.
    const [year] = parseKeyMetrics([
      { fiscalYear: "2025", returnOnEquity: 1.5191298333175105, earningsYield: 0.029331635106467118 }
    ]);

    expect(year.returnOnEquity).toBeCloseTo(1.519, 3);
    expect(year.earningsYield).toBeCloseTo(0.0293, 4);
  });
});

describe("Eingaben für die Bewertung", () => {
  // Echte AAPL-Werte vom 2026-08-08.
  const apple = {
    freeCashFlow: 98_767_000_000,
    netDebt: 76_443_000_000,
    marketCap: 4_601_989_255_480,
    price: 313.33,
    earningsYield: 0.0293,
    freeCashFlowYield: 0.0259
  };

  it("bildet die Aktienzahl aus gleich datierten Größen", () => {
    // Marktkapitalisierung und Kurs stammen aus derselben Abfrage. Der Fehler,
    // der bei der Nettoverschuldung passierte, kann hier nicht auftreten.
    const inputs = buildValuationInputs(apple);

    expect(inputs.sharesOutstanding).toBeCloseTo(apple.marketCap / apple.price, 0);
    expect(inputs.blockers).toEqual([]);
  });

  it("nimmt die Nettoverschuldung so, wie sie in der Bilanz steht", () => {
    // 76,4 Mrd. Schulden. Aus `enterpriseValue − marketCap` waeren
    // faelschlich 707 Mrd. Nettoliquiditaet geworden -- ein Vorzeichenfehler
    // um eine Groessenordnung, weil beide Groessen verschieden datiert sind.
    const inputs = buildValuationInputs(apple);

    expect(inputs.netDebt).toBe(76_443_000_000);
    expect(inputs.netDebt).toBeGreaterThan(0);
  });

  it("benennt jeden Grund, warum keine Bewertung möglich ist", () => {
    const empty = buildValuationInputs({
      freeCashFlow: null,
      netDebt: null,
      marketCap: null,
      price: null,
      earningsYield: null,
      freeCashFlowYield: null
    });

    expect(empty.blockers).toHaveLength(3);
    expect(empty.blockers.join(" ")).toContain("freier Cashflow");
    expect(empty.blockers.join(" ")).toContain("Aktienzahl");
    expect(empty.blockers.join(" ")).toContain("Nettoverschuldung");
  });

  it("hält einen negativen Cashflow für einen Hinderungsgrund", () => {
    const loss = buildValuationInputs({ ...apple, freeCashFlow: -5_000_000_000 });

    expect(loss.blockers.join(" ")).toContain("negativ");
  });

  it("übergibt die Annahmen sichtbar an den DCF", () => {
    // §37 verlangt, dass Diskontsatz, Wachstum und ewiges Wachstum mit
    // ausgegeben werden. Sie stehen deshalb an einer Stelle statt im Aufruf.
    const assumptions = toDcfAssumptions(buildValuationInputs(apple));

    expect(assumptions?.discountRate).toBe(0.09);
    expect(assumptions?.terminalGrowth).toBe(0.025);
    expect(assumptions?.years).toBe(5);
  });

  it("gibt ohne vollständige Eingaben keine Annahmen aus", () => {
    expect(toDcfAssumptions(buildValuationInputs({ ...apple, netDebt: null }))).toBeNull();
  });
});

describe("Peers", () => {
  it("liest die Vergleichsgruppe", () => {
    const peers = parsePeers([
      { symbol: "GOOGL", companyName: "Alphabet Inc.", price: 354.3, mktCap: 4_287_778_028_630 },
      { symbol: "MSFT", companyName: "Microsoft" }
    ]);

    expect(peers).toHaveLength(2);
    expect(peers[0].marketCap).toBe(4_287_778_028_630);
    expect(peers[1].marketCap).toBeNull();
  });

  it("verwirft Einträge ohne Symbol", () => {
    expect(parsePeers([{ companyName: "Ohne Symbol" }, { symbol: "  " }])).toEqual([]);
  });
});

describe("Analystenurteile", () => {
  // Echte AAPL-Antwort vom 2026-08-08.
  const consensus = [{ strongBuy: 1, buy: 70, hold: 32, sell: 8, strongSell: 0, consensus: "Buy" }];
  const targets = [
    {
      lastMonthCount: 11,
      lastMonthAvgPriceTarget: 329.55,
      lastQuarterCount: 17,
      lastQuarterAvgPriceTarget: 336.18,
      lastYearCount: 69,
      lastYearAvgPriceTarget: 306.68
    }
  ];

  it("weist die Zeiträume getrennt aus", () => {
    // Die Veraenderung ueber die Zeit ist die Information. Ein Mittelwert
    // ueber alles haette sie geloescht.
    const view = parseAnalystView(consensus, targets);

    expect(view?.targets.lastMonth).toBe(329.55);
    expect(view?.targets.lastYear).toBe(306.68);
    expect(view?.counts.lastYear).toBe(69);
  });

  it("beschreibt die Bewegung der Kursziele", () => {
    const view = parseAnalystView(consensus, targets);

    // 329,55 gegen 306,68 sind rund 7 % mehr.
    expect(view?.note).toContain("7 % über");
    expect(view?.note).toContain("folgen dem Kurs oft");
  });

  it("zählt alle Urteile zusammen", () => {
    const view = parseAnalystView(consensus, targets);

    expect(view?.note).toContain("111 Urteile");
    expect(view?.consensus).toBe("Buy");
  });

  it("sagt bei fehlenden Urteilen nichts", () => {
    const view = parseAnalystView([{ strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 }], []);

    expect(view?.note).toContain("Keine Analystenurteile");
  });

  it("liefert ohne jede Antwort null", () => {
    expect(parseAnalystView(null, null)).toBeNull();
  });
});
