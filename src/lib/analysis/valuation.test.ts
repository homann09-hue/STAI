import { describe, expect, it } from "vitest";
import {
  comparePeers,
  discountedCashFlow,
  formatValuationRange,
  impliedGrowthRate,
  sensitivityAnalysis,
  yieldValuation,
  type DcfAssumptions
} from "@/lib/analysis/valuation";

/**
 * §37 verlangt beim DCF „Annahmen, Discount Rate, Wachstum, Terminal Growth,
 * Sensitivitätsanalyse". §38 setzt die Regel darüber: keine Scheingenauigkeit.
 *
 * Die Tests prüfen deshalb vor allem, wann das Modell **schweigt** — ein DCF
 * liefert für fast jede Eingabe eine Zahl, und die meisten davon sind Unsinn,
 * der wie eine Bewertung aussieht.
 */

const base: DcfAssumptions = {
  freeCashFlow: 100_000_000,
  sharesOutstanding: 10_000_000,
  netDebt: 0,
  growthRate: 0.08,
  terminalGrowth: 0.02,
  discountRate: 0.09,
  years: 5
};

describe("wann der DCF sich weigert", () => {
  it("rechnet nicht, wenn das ewige Wachstum den Diskontsatz erreicht", () => {
    // Der klassische Fehler. Die Gordon-Formel teilt durch (r - g); bei g >= r
    // wird der Endwert unendlich oder negativ.
    const equal = discountedCashFlow({ ...base, terminalGrowth: 0.09, discountRate: 0.09 });
    const above = discountedCashFlow({ ...base, terminalGrowth: 0.12, discountRate: 0.09 });

    expect(equal.ok).toBe(false);
    expect(above.ok).toBe(false);
    if (above.ok) throw new Error("hätte scheitern müssen");
    expect(above.reason).toContain("gesamte Wirtschaft");
  });

  it("rechnet nicht auf einem negativen Cashflow", () => {
    // Ein DCF auf einem Verlustbringer multipliziert den Verlust.
    const result = discountedCashFlow({ ...base, freeCashFlow: -50_000_000 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("hätte scheitern müssen");
    expect(result.reason).toContain("Hochrechnung des Verlusts");
  });

  it("rechnet nicht ohne Aktienzahl oder Diskontsatz", () => {
    expect(discountedCashFlow({ ...base, sharesOutstanding: 0 }).ok).toBe(false);
    expect(discountedCashFlow({ ...base, discountRate: 0 }).ok).toBe(false);
  });

  it("begrenzt die Prognosephase auf plausible Längen", () => {
    expect(discountedCashFlow({ ...base, years: 0 }).ok).toBe(false);
    expect(discountedCashFlow({ ...base, years: 50 }).ok).toBe(false);
    expect(discountedCashFlow({ ...base, years: 5 }).ok).toBe(true);
  });
});

describe("die Rechnung selbst", () => {
  const result = discountedCashFlow(base);

  it("setzt den Unternehmenswert aus Prognose und Endwert zusammen", () => {
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.enterpriseValue).toBeCloseTo(result.presentValueOfForecast + result.presentValueOfTerminal, 4);
    expect(result.fairValuePerShare).toBeGreaterThan(0);
  });

  it("zieht die Nettoverschuldung ab und rechnet Nettoliquidität hinzu", () => {
    const indebted = discountedCashFlow({ ...base, netDebt: 500_000_000 });
    const cashRich = discountedCashFlow({ ...base, netDebt: -500_000_000 });
    if (!indebted.ok || !cashRich.ok || !result.ok) throw new Error("sollten rechnen");

    expect(indebted.fairValuePerShare).toBeLessThan(result.fairValuePerShare);
    expect(cashRich.fairValuePerShare).toBeGreaterThan(result.fairValuePerShare);
    expect(cashRich.fairValuePerShare - result.fairValuePerShare).toBeCloseTo(50, 6);
  });

  it("nennt den Anteil des Endwerts immer", () => {
    // Die ehrlichste Zahl des Modells. Nachgerechnet: PV Prognose 486,41,
    // PV Endwert 1391,52 -- also 74,1 % aus der Zeit nach dem fuenften Jahr.
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.terminalShare).toBeCloseTo(0.741, 3);
  });

  it("warnt erst, wenn die Prognosephase wirklich Beiwerk ist", () => {
    // Die Schwelle lag zunaechst bei 75 % -- gemessen trifft das die Haelfte
    // aller ueblichen Konfigurationen (50 % bis 81 %). Ein Hinweis, der bei
    // jeder zweiten Rechnung erscheint, wird ueberlesen.
    if (!result.ok) throw new Error("sollte rechnen");
    expect(result.caveats.join(" ")).not.toContain("Endwert");

    // Niedriger Diskontsatz und langsames Prognosewachstum verschieben fast
    // alles in die Ewigkeit.
    const extreme = discountedCashFlow({ ...base, discountRate: 0.06, growthRate: 0.01, terminalGrowth: 0.035 });
    if (!extreme.ok) throw new Error("sollte rechnen");

    expect(extreme.terminalShare).toBeGreaterThan(0.85);
    expect(extreme.caveats.join(" ")).toContain("Endwert");
  });

  it("warnt bei sehr hoher Wachstumsannahme", () => {
    const aggressive = discountedCashFlow({ ...base, growthRate: 0.25 });
    if (!aggressive.ok) throw new Error("sollte rechnen");

    expect(aggressive.caveats.join(" ")).toContain("starke Annahme");
  });

  it("meldet einen negativen Eigenkapitalwert als untauglich", () => {
    const overleveraged = discountedCashFlow({ ...base, netDebt: 100_000_000_000 });
    if (!overleveraged.ok) throw new Error("sollte rechnen");

    expect(overleveraged.caveats.join(" ")).toContain("taugt hier nicht");
  });
});

describe("Sensitivität — das eigentliche Ergebnis", () => {
  const analysis = sensitivityAnalysis(base);

  it("liefert eine Spanne statt eines Punktwerts", () => {
    expect(analysis.range).not.toBeNull();
    expect(analysis.range!.high).toBeGreaterThan(analysis.range!.low);
  });

  it("zeigt, wie stark zwei Prozentpunkte das Ergebnis verschieben", () => {
    // Der Grund fuer die ganze Uebung: die Spanne ist breit, weil die
    // Annahmen unsicher sind -- nicht, weil die Rechnung schlecht waere.
    const spread = analysis.range!.high / analysis.range!.low;
    expect(spread).toBeGreaterThan(1.5);
  });

  it("lässt ungültige Kombinationen leer, statt sie zu erfinden", () => {
    // Bei einem Diskontsatz von 7 % und 2 % ewigem Wachstum plus Aufschlag
    // wird die Bedingung g < r verletzt.
    const narrow = sensitivityAnalysis({ ...base, discountRate: 0.03, terminalGrowth: 0.025 });
    const empty = narrow.cells.filter((cell) => cell.fairValuePerShare === null);

    expect(empty.length).toBeGreaterThan(0);
    expect(narrow.valid).toBeLessThan(narrow.total);
  });

  it("benennt die Breite als Unsicherheit der Annahmen", () => {
    expect(analysis.note).toContain("tatsächliche Unsicherheit");
  });
});

describe("Darstellung ohne Scheingenauigkeit", () => {
  it("rundet die Spanne grob", () => {
    // §38 wortwoertlich: "Base Case: 145-170 EUR" statt "Ziel: 163,27 EUR".
    expect(formatValuationRange({ low: 144.31, high: 168.77 })).toBe("145–170 €");
  });

  it("rundet kleine Kurse feiner", () => {
    expect(formatValuationRange({ low: 12.3, high: 18.9 })).toBe("12–19 €");
  });

  it("sagt bei fehlender Bewertung nichts", () => {
    expect(formatValuationRange(null)).toContain("Keine belastbare Bewertung");
  });
});

describe("Reverse DCF", () => {
  it("findet das Wachstum, das den Kurs rechtfertigt", () => {
    const forward = discountedCashFlow(base);
    if (!forward.ok) throw new Error("sollte rechnen");

    const implied = impliedGrowthRate(base, forward.fairValuePerShare);

    expect(implied).not.toBeNull();
    expect(implied!.growthRate).toBeCloseTo(base.growthRate, 2);
  });

  it("verlangt bei höherem Kurs höheres Wachstum", () => {
    const forward = discountedCashFlow(base);
    if (!forward.ok) throw new Error("sollte rechnen");

    const cheap = impliedGrowthRate(base, forward.fairValuePerShare * 0.6);
    const rich = impliedGrowthRate(base, forward.fairValuePerShare * 1.6);

    expect(rich!.growthRate).toBeGreaterThan(cheap!.growthRate);
  });

  it("gibt die Grenze zu, statt zu extrapolieren", () => {
    const absurd = impliedGrowthRate(base, 1_000_000);

    expect(absurd!.note).toContain("mehr, als dieses Modell sinnvoll abbildet");
  });

  it("verschiebt die Frage auf das Unternehmen", () => {
    // Der Kern des Reverse DCF: nicht "was ist es wert", sondern "was muesste
    // zutreffen". Das ist eine Frage ueber das Unternehmen, keine ueber das
    // Modell.
    const implied = impliedGrowthRate(base, 500);
    expect(implied!.note).toContain("Frage über das Unternehmen");
  });
});

describe("Renditebetrachtung", () => {
  it("vergleicht die Gewinnrendite mit dem risikofreien Zins", () => {
    const result = yieldValuation({ earningsYield: 0.062, riskFreeRate: 0.047 });

    expect(result.spreadToRiskFree).toBeCloseTo(1.5, 5);
    expect(result.interpretation).toContain("Entschädigung für das unternehmerische Risiko");
  });

  it("benennt eine Rendite unter dem risikofreien Zins als Wachstumserwartung", () => {
    const result = yieldValuation({ earningsYield: 0.03, riskFreeRate: 0.047 });

    expect(result.spreadToRiskFree).toBeLessThan(0);
    expect(result.interpretation).toContain("preist Wachstum ein");
  });

  it("lässt ohne Vergleichszins die Bewertung offen", () => {
    expect(yieldValuation({ earningsYield: 0.05 }).interpretation).toContain("bleibt offen");
  });

  it("erfindet keine Rendite", () => {
    const result = yieldValuation({});

    expect(result.earningsYield).toBeNull();
    expect(result.spreadToRiskFree).toBeNull();
  });
});

describe("Peer-Vergleich", () => {
  const peers = [
    { symbol: "MSFT", name: "Microsoft", value: 30 },
    { symbol: "GOOGL", name: "Alphabet", value: 22 },
    { symbol: "META", name: "Meta", value: 24 },
    { symbol: "AMZN", name: "Amazon", value: 40 }
  ];

  it("hält einen Ausreißer aus dem Vergleichswert heraus", () => {
    // Werte 30, 22, 24, 40 -- Median 27, Mittelwert 29.
    // Mit dem Ausreisser 300: Median 30, Mittelwert 83,2.
    //
    // Der Median wandert um 3 Punkte, der Mittelwert um 54. Genau darum steht
    // hier der Median: ein einzelnes Unternehmen mit KGV 300 wuerde den
    // Durchschnitt der ganzen Gruppe unbrauchbar machen.
    const clean = comparePeers("KGV", 28, peers);
    const withOutlier = comparePeers("KGV", 28, [...peers, { symbol: "X", name: "Ausreißer", value: 300 }]);

    expect(clean.median).toBe(27);
    expect(withOutlier.median).toBe(30);

    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanShift = mean([30, 22, 24, 40, 300]) - mean([30, 22, 24, 40]);

    expect(Math.abs(withOutlier.median! - clean.median!)).toBeLessThan(meanShift / 10);
  });

  it("bildet unter drei Vergleichswerten keine Aussage", () => {
    // Ein "Median" aus zwei Zahlen ist deren Mittelwert und hat mit einer
    // Vergleichsgruppe nichts zu tun.
    const thin = comparePeers("KGV", 28, peers.slice(0, 2));

    expect(thin.median).toBeNull();
    expect(thin.interpretation).toContain("keine Vergleichsgruppe");
  });

  it("verwirft unbrauchbare Peer-Werte", () => {
    // Ein negatives KGV ist keine niedrige Bewertung, sondern ein Verlust --
    // in den Median einzurechnen waere ein Vorzeichenfehler mit Folgen.
    const withGaps = comparePeers("KGV", 28, [
      ...peers,
      { symbol: "A", name: "ohne Wert", value: null },
      { symbol: "B", name: "negativ", value: -5 }
    ]);

    expect(withGaps.median).toBe(27);
  });

  it("nennt einen Aufschlag begründungsbedürftig, keinen Abschlag einen Kaufgrund", () => {
    const expensive = comparePeers("KGV", 40, peers);
    const cheap = comparePeers("KGV", 15, peers);

    expect(expensive.interpretation).toContain("muss durch Wachstum, Marge oder Qualität gedeckt sein");
    expect(cheap.interpretation).toContain("kein Kaufgrund");
  });

  it("nennt eine geringe Abweichung eine geringe Abweichung", () => {
    expect(comparePeers("KGV", 27.5, peers).interpretation).toContain("nahe am Median");
  });
});
