/**
 * Unternehmensqualität in erklärbaren Teilnoten.
 *
 * §25 ist in einem Punkt sehr deutlich: „Kein einzelner magischer Score. Jeder
 * Score braucht erklärbare Unterkategorien." Diese Datei nimmt das wörtlich.
 *
 * Die wichtigste Eigenschaft ist nicht die Formel, sondern was passiert, wenn
 * eine Zahl fehlt: **es wird nichts geschätzt.** Eine fehlende Kennzahl senkt
 * die Aussagekraft und wird benannt. Ein Score, der aus zwei von acht Werten
 * entsteht und trotzdem wie eine Note aussieht, wäre schlimmer als gar keiner —
 * denn niemand hinterfragt eine Zahl, die plausibel wirkt.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

export type ScoreDimension =
  | "profitability"
  | "growth"
  | "balance_sheet"
  | "cash_flow"
  | "leverage"
  | "valuation"
  | "returns";

/** Rohwerte, wie sie ein Provider liefert. Alles darf fehlen. */
export type FundamentalInputs = {
  grossMargin?: number | null;
  operatingMargin?: number | null;
  netMargin?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  currentRatio?: number | null;
  quickRatio?: number | null;
  equityRatio?: number | null;
  operatingCashFlow?: number | null;
  freeCashFlow?: number | null;
  netIncome?: number | null;
  debtToEquity?: number | null;
  netDebtToEbitda?: number | null;
  peRatio?: number | null;
  priceToSales?: number | null;
  evToEbitda?: number | null;
  returnOnEquity?: number | null;
  returnOnAssets?: number | null;
  returnOnInvestedCapital?: number | null;
};

/** Eine einzelne Beobachtung, aus der sich eine Teilnote zusammensetzt. */
export type ScoreComponent = {
  label: string;
  /** Der gemessene Wert, oder null wenn er fehlt. */
  value: number | null;
  /** 0 bis 100. Null, wenn der Wert fehlt. */
  points: number | null;
  /** Warum diese Punktzahl — in einem Satz, ohne Fachjargon. */
  reason: string;
};

export type DimensionScore = {
  dimension: ScoreDimension;
  label: string;
  /** 0 bis 100, oder null wenn keine einzige Kennzahl vorlag. */
  score: number | null;
  components: ScoreComponent[];
  /** Wie viele der erwarteten Kennzahlen tatsächlich vorlagen. */
  coverage: { available: number; expected: number };
  /**
   * Ob die Note belastbar ist. Unter der Hälfte der Kennzahlen wird sie zwar
   * gezeigt, aber ausdrücklich als nicht belastbar gekennzeichnet.
   */
  reportable: boolean;
  note: string;
};

const dimensionLabels: Record<ScoreDimension, string> = {
  profitability: "Profitabilität",
  growth: "Wachstum",
  balance_sheet: "Bilanzqualität",
  cash_flow: "Cashflow",
  leverage: "Verschuldung",
  valuation: "Bewertung",
  returns: "Kapitalrendite"
};

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Bildet einen Wert auf 0–100 ab.
 *
 * Linear zwischen `worst` und `best`, außerhalb gekappt. Bewusst keine Kurve:
 * eine Nichtlinearität müsste begründet werden, und jede Begründung wäre hier
 * geraten.
 */
function scale(value: number, worst: number, best: number): number {
  if (worst === best) return 50;
  const ratio = (value - worst) / (best - worst);
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function component(
  label: string,
  value: number | null | undefined,
  worst: number,
  best: number,
  describe: (value: number, points: number) => string
): ScoreComponent {
  if (!isNumber(value)) {
    return {
      label,
      value: null,
      points: null,
      // Keine Punktzahl ohne Wert. Eine Null waere eine Wertung, kein Fehlen.
      reason: `${label} liegt nicht vor. Diese Kennzahl fließt nicht in die Note ein.`
    };
  }

  const points = scale(value, worst, best);
  return { label, value, points, reason: describe(value, points) };
}

function percent(value: number) {
  return `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

function buildDimension(dimension: ScoreDimension, components: ScoreComponent[]): DimensionScore {
  const scored = components.filter((entry) => entry.points !== null);
  const expected = components.length;
  const available = scored.length;

  const score =
    available === 0
      ? null
      : Math.round(scored.reduce((sum, entry) => sum + (entry.points ?? 0), 0) / available);

  // Unter der Haelfte der Kennzahlen ist eine Note kein Urteil, sondern ein
  // Fragment. Sie wird gezeigt, aber nicht als belastbar ausgegeben.
  const reportable = available > 0 && available >= Math.ceil(expected / 2);

  const note =
    available === 0
      ? `Für ${dimensionLabels[dimension]} liegt keine einzige Kennzahl vor. Es wird keine Note gebildet.`
      : reportable
        ? `Note aus ${available} von ${expected} Kennzahlen.`
        : `Nur ${available} von ${expected} Kennzahlen verfügbar. Die Note ist nicht belastbar und dient allein der Orientierung.`;

  return {
    dimension,
    label: dimensionLabels[dimension],
    score,
    components,
    coverage: { available, expected },
    reportable,
    note
  };
}

/**
 * Berechnet alle Teilnoten.
 *
 * Die Grenzwerte stammen aus gängigen Spannen quer über Branchen und sind
 * bewusst grob. Sie taugen für „auffällig gut" gegen „auffällig schwach", nicht
 * für eine Rangfolge auf zwei Nachkommastellen — eine sektorspezifische
 * Kalibrierung wäre nötig und steht in §37 noch aus.
 */
export function buildQualityScores(inputs: FundamentalInputs): DimensionScore[] {
  return [
    buildDimension("profitability", [
      component("Bruttomarge", inputs.grossMargin, 0.05, 0.6, (v) => `Bruttomarge von ${percent(v)}.`),
      component("Operative Marge", inputs.operatingMargin, -0.05, 0.3, (v) => `Operative Marge von ${percent(v)}.`),
      component("Nettomarge", inputs.netMargin, -0.05, 0.25, (v) => `Nettomarge von ${percent(v)}.`)
    ]),

    buildDimension("growth", [
      component("Umsatzwachstum", inputs.revenueGrowth, -0.1, 0.3, (v) =>
        v < 0 ? `Umsatz ist um ${percent(Math.abs(v))} geschrumpft.` : `Umsatz wächst um ${percent(v)}.`
      ),
      component("Gewinnwachstum", inputs.earningsGrowth, -0.2, 0.4, (v) =>
        v < 0 ? `Gewinn ist um ${percent(Math.abs(v))} gefallen.` : `Gewinn wächst um ${percent(v)}.`
      )
    ]),

    buildDimension("balance_sheet", [
      component("Current Ratio", inputs.currentRatio, 0.5, 2.5, (v) =>
        v < 1
          ? `Kurzfristige Verbindlichkeiten übersteigen das Umlaufvermögen (${v.toFixed(2)}).`
          : `Umlaufvermögen deckt die kurzfristigen Verbindlichkeiten ${v.toFixed(2)}-fach.`
      ),
      component("Quick Ratio", inputs.quickRatio, 0.3, 1.5, (v) => `Quick Ratio von ${v.toFixed(2)}.`),
      component("Eigenkapitalquote", inputs.equityRatio, 0.1, 0.6, (v) => `Eigenkapitalquote von ${percent(v)}.`)
    ]),

    buildDimension("cash_flow", [
      component("Free Cash Flow", inputs.freeCashFlow, 0, 1, (v) =>
        v <= 0 ? "Free Cash Flow ist negativ." : "Free Cash Flow ist positiv."
      ),
      // Der entscheidende Test der Ergebnisqualitaet: verdient das Unternehmen
      // das, was es ausweist, auch wirklich?
      component(
        "Cashflow-Deckung des Gewinns",
        isNumber(inputs.operatingCashFlow) && isNumber(inputs.netIncome) && inputs.netIncome !== 0
          ? inputs.operatingCashFlow / inputs.netIncome
          : null,
        0.5,
        1.5,
        (v) =>
          v < 1
            ? `Der operative Cashflow deckt den ausgewiesenen Gewinn nur zu ${percent(v)}.`
            : `Der operative Cashflow übersteigt den Gewinn um das ${v.toFixed(2)}-fache.`
      )
    ]),

    buildDimension("leverage", [
      // Umgekehrte Skala: weniger Schulden ist besser.
      component("Debt/Equity", inputs.debtToEquity, 3, 0, (v) => `Verschuldungsgrad von ${v.toFixed(2)}.`),
      component("Net Debt/EBITDA", inputs.netDebtToEbitda, 5, 0, (v) =>
        v > 3 ? `Nettoverschuldung entspricht dem ${v.toFixed(1)}-fachen EBITDA — hoch.` : `Nettoverschuldung beim ${v.toFixed(1)}-fachen EBITDA.`
      )
    ]),

    buildDimension("valuation", [
      component("KGV", inputs.peRatio, 45, 8, (v) =>
        v <= 0 ? "Kein sinnvolles KGV — das Unternehmen ist nicht profitabel." : `KGV von ${v.toFixed(1)}.`
      ),
      component("P/S", inputs.priceToSales, 12, 1, (v) => `Kurs-Umsatz-Verhältnis von ${v.toFixed(1)}.`),
      component("EV/EBITDA", inputs.evToEbitda, 25, 6, (v) => `EV/EBITDA von ${v.toFixed(1)}.`)
    ]),

    buildDimension("returns", [
      component("ROE", inputs.returnOnEquity, 0, 0.3, (v) => `Eigenkapitalrendite von ${percent(v)}.`),
      component("ROA", inputs.returnOnAssets, 0, 0.15, (v) => `Gesamtkapitalrendite von ${percent(v)}.`),
      component("ROIC", inputs.returnOnInvestedCapital, 0, 0.2, (v) => `Rendite auf das eingesetzte Kapital von ${percent(v)}.`)
    ])
  ];
}

export type QualityAssessment = {
  dimensions: DimensionScore[];
  /** Anteil der belastbaren Teilnoten an allen. */
  reportableDimensions: number;
  totalDimensions: number;
  /** Welche Kennzahlen gefehlt haben — namentlich, nicht als Zahl. */
  missing: string[];
  /** Ob überhaupt eine Aussage über die Unternehmensqualität zulässig ist. */
  reportable: boolean;
  disclaimer: string;
};

/** Ab wie vielen belastbaren Teilnoten eine Gesamtaussage zulässig ist. */
const MIN_REPORTABLE_DIMENSIONS = 4;

/**
 * Fasst die Teilnoten zusammen — **ohne** sie zu einer Gesamtnote zu verrechnen.
 *
 * Das ist Absicht und der Kern von §25. Eine Gesamtnote würde die Teilnoten
 * verstecken, und genau die sind die Aussage. Zusammengefasst wird nur, wie
 * viel überhaupt gemessen werden konnte.
 */
export function assessQuality(inputs: FundamentalInputs): QualityAssessment {
  const dimensions = buildQualityScores(inputs);
  const reportableDimensions = dimensions.filter((entry) => entry.reportable).length;

  const missing = dimensions
    .flatMap((entry) => entry.components)
    .filter((entry) => entry.points === null)
    .map((entry) => entry.label);

  return {
    dimensions,
    reportableDimensions,
    totalDimensions: dimensions.length,
    missing,
    reportable: reportableDimensions >= MIN_REPORTABLE_DIMENSIONS,
    disclaimer:
      "Teilnoten aus gemeldeten Kennzahlen, ohne Branchenkalibrierung. Fehlende Kennzahlen werden nicht geschätzt und senken die Aussagekraft. Keine Anlageberatung."
  };
}
