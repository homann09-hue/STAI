import { describe, expect, it } from "vitest";
import { buildValuationView, withImpliedGrowth } from "@/lib/analysis/valuation-view";
import type { FundamentalsBundle } from "@/lib/providers/valuation-data";

/**
 * Hier treffen Zahlen aus verschiedenen Quellen aufeinander — Kennzahlenreihe,
 * Bilanz, Kurs, Peers. Genau an solchen Nahtstellen ist der Fehler mit der
 * Nettoverschuldung entstanden.
 *
 * Die Werte stammen aus echten AAPL-Antworten vom 2026-08-08.
 */

const bundle: FundamentalsBundle = {
  ratios: [
    { fiscalYear: "2025", peRatio: 34.11, priceToSales: 9.18, priceToBook: 51.79, grossMargin: 0.469, netMargin: 0.269, debtToEquity: 1.52 },
    { fiscalYear: "2024", peRatio: 37.28, priceToSales: 8.94, priceToBook: 61.37, grossMargin: 0.462, netMargin: 0.239, debtToEquity: 2.09 },
    { fiscalYear: "2023", peRatio: 27.79, priceToSales: 7.03, priceToBook: 43.37, grossMargin: 0.441, netMargin: 0.253, debtToEquity: 1.99 },
    { fiscalYear: "2022", peRatio: 24.46, priceToSales: 6.19, priceToBook: 48.14, grossMargin: 0.433, netMargin: 0.253, debtToEquity: 2.61 },
    { fiscalYear: "2021", peRatio: 25.91, priceToSales: 6.71, priceToBook: 38.89, grossMargin: 0.418, netMargin: 0.259, debtToEquity: 2.16 }
  ],
  keyMetrics: [
    { fiscalYear: "2025", returnOnEquity: 1.519, earningsYield: 0.0293, freeCashFlowYield: 0.0259, enterpriseValue: 3_895_186_810_000 }
  ],
  valuation: {
    freeCashFlow: 98_767_000_000,
    // Aus der Bilanz. Aus `enterpriseValue − marketCap` waeren faelschlich
    // 707 Mrd. Nettoliquiditaet geworden.
    netDebt: 76_443_000_000,
    sharesOutstanding: 14_687_000_000,
    earningsYield: 0.0293,
    freeCashFlowYield: 0.0259,
    blockers: []
  },
  peers: [
    { symbol: "GOOGL", name: "Alphabet", marketCap: 4_287_778_028_630, price: 354.3 },
    { symbol: "MSFT", name: "Microsoft", marketCap: 3_700_000_000_000, price: 502 },
    { symbol: "META", name: "Meta", marketCap: 1_600_000_000_000, price: 620 }
  ],
  analysts: {
    strongBuy: 1, buy: 70, hold: 32, sell: 8, strongSell: 0, consensus: "Buy",
    targets: { lastMonth: 329.55, lastQuarter: 336.18, lastYear: 306.68 },
    counts: { lastMonth: 11, lastQuarter: 17, lastYear: 69 },
    note: "111 Urteile."
  },
  note: "Abschlussdaten aus bis zu 5 Geschäftsjahren."
};

describe("Zusammensetzung der Ansicht", () => {
  const view = buildValuationView(bundle, { currency: "$" });

  it("rechnet den DCF mit der Nettoverschuldung aus der Bilanz", () => {
    // Mit 76,4 Mrd. Schulden statt 707 Mrd. Liquiditaet: rund 129 $ statt 182 $.
    expect(view.dcf.ok).toBe(true);
    if (!view.dcf.ok) throw new Error("sollte rechnen");
    expect(view.dcf.fairValuePerShare).toBeGreaterThan(120);
    expect(view.dcf.fairValuePerShare).toBeLessThan(140);
  });

  it("gibt die Spanne aus, nicht den Punktwert allein", () => {
    expect(view.sensitivity?.range).not.toBeNull();
    expect(view.sensitivity!.range!.high).toBeGreaterThan(view.sensitivity!.range!.low);
  });

  it("setzt die Kennzahlen in den Fünfjahresvergleich", () => {
    const pe = view.metrics.find((metric) => metric.definition.id === "peRatio");

    expect(pe?.sentence).toBe("KGV 34,1 — deutlich über dem 5-Jahres-Median von 27,8.");
  });

  it("nimmt den jüngsten Wert und nicht den ältesten", () => {
    // Der Anbieter liefert absteigend. Wer Position 0 fuer das aelteste Jahr
    // haelt, vergleicht 2021 gegen den Median -- und merkt es nicht.
    const pe = view.metrics.find((metric) => metric.definition.id === "peRatio");

    expect(pe?.value).toBeCloseTo(34.11, 2);
    expect(pe?.value).not.toBeCloseTo(25.91, 2);
  });

  it("holt die Eigenkapitalrendite aus der richtigen Quelle", () => {
    const roe = view.metrics.find((metric) => metric.definition.id === "returnOnEquity");

    expect(roe?.value).toBeCloseTo(1.519, 3);
  });

  it("reicht die Analystenurteile unverändert durch", () => {
    expect(view.analysts?.targets.lastMonth).toBe(329.55);
    expect(view.analysts?.consensus).toBe("Buy");
  });

  it("stellt die Vergleichsgruppe dar", () => {
    expect(view.peers).toHaveLength(1);
    expect(view.peers[0].peers).toHaveLength(3);
  });
});

describe("wenn Daten fehlen", () => {
  it("verweigert die Bewertung mit Begründung statt mit einer Zahl", () => {
    const broken = buildValuationView({
      ...bundle,
      valuation: { ...bundle.valuation, freeCashFlow: null, blockers: ["Kein freier Cashflow gemeldet."] }
    });

    expect(broken.dcf.ok).toBe(false);
    if (broken.dcf.ok) throw new Error("hätte scheitern müssen");
    expect(broken.dcf.reason).toContain("Cashflow");
    expect(broken.sensitivity).toBeNull();
  });

  it("bildet ohne Kennzahlenreihe keine Einordnung", () => {
    const bare = buildValuationView({ ...bundle, ratios: [], keyMetrics: [] });

    for (const metric of bare.metrics) {
      expect(metric.median).toBeNull();
    }
  });

  it("lässt die Peer-Liste leer, wenn keine kommen", () => {
    expect(buildValuationView({ ...bundle, peers: [] }).peers).toEqual([]);
  });
});

describe("implizites Wachstum", () => {
  it("wird erst mit dem aktuellen Kurs gebildet", () => {
    // Getrennt, weil der Kurs eine andere Groesse ist als die Abschlussdaten.
    // Beides zusammenzuwerfen war schon einmal die Ursache eines
    // Vorzeichenfehlers um eine Groessenordnung.
    const ohne = buildValuationView(bundle);
    expect(ohne.impliedGrowth).toBeNull();

    const mit = withImpliedGrowth(ohne, bundle, 313.33);
    expect(mit.impliedGrowth).not.toBeNull();
    expect(mit.impliedGrowth!.growthRate).toBeGreaterThan(0.2);
  });

  it("verlangt einen brauchbaren Kurs", () => {
    const view = buildValuationView(bundle);

    expect(withImpliedGrowth(view, bundle, 0).impliedGrowth).toBeNull();
    expect(withImpliedGrowth(view, bundle, null).impliedGrowth).toBeNull();
  });
});
