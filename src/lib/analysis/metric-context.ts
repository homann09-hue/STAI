/**
 * Kennzahlen mit Einordnung.
 *
 * §50 verlangt für erklärungsbedürftige Kennzahlen vier Dinge: Tooltip, kurze
 * Erklärung, Kontext und historische Einordnung. Der Anspruch steht als
 * Beispiel darin:
 *
 * > Nicht nur: `P/E 42`
 * > sondern: `P/E 42 – deutlich über dem 5-Jahres-Median.`
 *
 * Der Unterschied ist nicht kosmetisch. „42“ ist für die meisten Leser
 * bedeutungslos; erst der Vergleich mit der eigenen Vergangenheit macht daraus
 * eine Aussage.
 *
 * **Gemessen am 2026-08-08:** der Anbietertarif liefert genau fünf
 * Geschäftsjahre (`limit=5` antwortet mit 200, `limit=6` mit HTTP 402). Das
 * passt zufällig genau auf das Fenster, das §50 nennt — mehr ist nicht möglich,
 * und der Zeitraum wird deshalb überall mit ausgegeben statt stillschweigend
 * angenommen.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

export type MetricDirection = "higher_is_better" | "lower_is_better" | "neutral";

export type MetricFormat = "ratio" | "percent" | "currency" | "number";

export type MetricDefinition = {
  id: string;
  label: string;
  /** Was die Kennzahl misst — ein Satz, ohne Fachjargon. Das ist der Tooltip. */
  explanation: string;
  /** Warum sie überhaupt zählt. */
  whyItMatters: string;
  /**
   * Was sie **nicht** sagt.
   *
   * Der wichtigste Teil vieler Kennzahlen. Ein hohes KGV heißt nicht „teuer“,
   * sondern „der Markt erwartet Wachstum“ — ob zu Recht, sagt die Zahl nicht.
   */
  caveat: string;
  direction: MetricDirection;
  format: MetricFormat;
};

/**
 * Der Katalog.
 *
 * Bewusst knapp gehalten: lieber zwölf Kennzahlen mit einer Erklärung, die
 * jemand ohne Vorwissen versteht, als vierzig mit Lehrbuchsätzen.
 */
export const metricDefinitions: Record<string, MetricDefinition> = {
  peRatio: {
    id: "peRatio",
    label: "KGV",
    explanation: "Wie viele Jahresgewinne im aktuellen Kurs stecken. Ein KGV von 20 heißt: der Kurs entspricht dem Zwanzigfachen des Jahresgewinns.",
    whyItMatters: "Die gebräuchlichste Messgröße dafür, wie teuer eine Aktie im Verhältnis zu dem ist, was das Unternehmen verdient.",
    caveat: "Ein hohes KGV heißt nicht „teuer“, sondern dass der Markt Wachstum erwartet. Ob zu Recht, sagt die Zahl nicht. Bei Verlusten ist sie gar nicht bildbar.",
    direction: "lower_is_better",
    format: "ratio"
  },
  priceToSales: {
    id: "priceToSales",
    label: "Kurs-Umsatz-Verhältnis",
    explanation: "Der Börsenwert im Verhältnis zum Jahresumsatz.",
    whyItMatters: "Funktioniert auch bei Unternehmen ohne Gewinn — dort, wo das KGV nichts liefert.",
    caveat: "Ignoriert vollständig, ob am Umsatz etwas verdient wird. Zwei Unternehmen mit gleichem Verhältnis können unterschiedlich profitabel sein.",
    direction: "lower_is_better",
    format: "ratio"
  },
  priceToBook: {
    id: "priceToBook",
    label: "Kurs-Buchwert-Verhältnis",
    explanation: "Der Börsenwert im Verhältnis zum bilanziellen Eigenkapital.",
    whyItMatters: "Bei Banken und kapitalintensiven Unternehmen aussagekräftiger als das KGV.",
    caveat: "Bei Software- und Markenunternehmen wenig brauchbar: deren Wert steckt in Dingen, die nicht in der Bilanz stehen.",
    direction: "lower_is_better",
    format: "ratio"
  },
  grossMargin: {
    id: "grossMargin",
    label: "Bruttomarge",
    explanation: "Was von jedem Euro Umsatz übrig bleibt, nachdem die direkten Herstellkosten abgezogen sind.",
    whyItMatters: "Zeigt die Preissetzungsmacht. Eine hohe Bruttomarge bedeutet, dass das Unternehmen mehr verlangen kann, als die Herstellung kostet.",
    caveat: "Zwischen Branchen nicht vergleichbar: Software liegt naturgemäß bei 70–90 %, Handel bei 20–30 %.",
    direction: "higher_is_better",
    format: "percent"
  },
  netMargin: {
    id: "netMargin",
    label: "Nettomarge",
    explanation: "Was nach allen Kosten, Zinsen und Steuern vom Umsatz übrig bleibt.",
    whyItMatters: "Die Endstufe der Profitabilität — was tatsächlich beim Unternehmen ankommt.",
    caveat: "Einmaleffekte wie Verkäufe oder Abschreibungen können sie in einem Jahr stark verzerren.",
    direction: "higher_is_better",
    format: "percent"
  },
  returnOnEquity: {
    id: "returnOnEquity",
    label: "Eigenkapitalrendite",
    explanation: "Wie viel Gewinn das Unternehmen auf das eingesetzte Eigenkapital erwirtschaftet.",
    whyItMatters: "Misst, wie wirksam das Kapital der Eigentümer arbeitet.",
    caveat: "Lässt sich durch Schulden künstlich erhöhen — wenig Eigenkapital im Nenner ergibt eine hohe Rendite bei gleichem Gewinn.",
    direction: "higher_is_better",
    format: "percent"
  },
  debtToEquity: {
    id: "debtToEquity",
    label: "Verschuldungsgrad",
    explanation: "Wie viel Fremdkapital auf jeden Euro Eigenkapital kommt.",
    whyItMatters: "Schulden verstärken Gewinne und Verluste gleichermaßen. Ein hoher Wert erhöht das Risiko in schlechten Jahren.",
    caveat: "Was hoch ist, hängt vom Geschäft ab: Versorger tragen dauerhaft mehr als Softwarehäuser.",
    direction: "lower_is_better",
    format: "ratio"
  },
  earningsYield: {
    id: "earningsYield",
    label: "Gewinnrendite",
    explanation: "Der Kehrwert des KGV — welcher Anteil des Kurses als Jahresgewinn zurückkommt.",
    whyItMatters: "Direkt mit der Verzinsung einer Staatsanleihe vergleichbar. 4 % Gewinnrendite gegen 4,7 % risikofrei ist eine Aussage; ein KGV von 25 ist keine.",
    caveat: "Der Gewinn eines Jahres, nicht der künftige. Ein wachsendes Unternehmen verdient die niedrige Anfangsrendite später womöglich ein.",
    direction: "higher_is_better",
    format: "percent"
  },
  freeCashFlowYield: {
    id: "freeCashFlowYield",
    label: "Free-Cash-Flow-Rendite",
    explanation: "Wie viel frei verfügbarer Zahlungsmittelüberschuss auf den Unternehmenswert entfällt.",
    whyItMatters: "Cashflow lässt sich schwerer gestalten als der ausgewiesene Gewinn.",
    caveat: "Schwankt bei investitionsintensiven Unternehmen von Jahr zu Jahr stark.",
    direction: "higher_is_better",
    format: "percent"
  },
  rsi: {
    id: "rsi",
    label: "RSI",
    explanation: "Verhältnis der Kursgewinne zu den Kursverlusten der letzten 14 Handelstage, auf eine Skala von 0 bis 100 gebracht.",
    whyItMatters: "Zeigt, ob eine Bewegung in kurzer Zeit ungewöhnlich weit gelaufen ist.",
    caveat: "In einem starken Trend bleibt der RSI wochenlang im Extrem. „Überkauft“ ist kein Verkaufssignal.",
    direction: "neutral",
    format: "number"
  },
  adx: {
    id: "adx",
    label: "ADX",
    explanation: "Misst, wie ausgeprägt ein Trend ist — unabhängig von seiner Richtung.",
    whyItMatters: "Trennt Trendphasen von Seitwärtsphasen. Unter 25 gilt ein Markt als richtungslos.",
    caveat: "Sagt **nichts** über die Richtung. Ein hoher ADX kann einen kräftigen Abwärtstrend bedeuten.",
    direction: "neutral",
    format: "number"
  },
  volatility: {
    id: "volatility",
    label: "Volatilität",
    explanation: "Wie stark der Kurs im Jahresmaß schwankt, aus den Tagesbewegungen hochgerechnet.",
    whyItMatters: "Bestimmt, wie groß eine Position sein darf, ohne dass normale Schwankungen wehtun.",
    caveat: "Vergangene Schwankung sagt wenig über künftige. Ruhige Phasen gehen Ausbrüchen oft voraus.",
    direction: "neutral",
    format: "percent"
  }
};

/**
 * Wie weit ein Wert vom Median abweichen darf, um noch „im üblichen Rahmen“ zu
 * heißen.
 *
 * Kalibriert am Beispiel aus §50: AAPL hatte 2025 ein KGV von 34,1 gegen einen
 * Fünfjahresmedian von 27,8 — 22,7 % darüber. Das soll „deutlich über“ heißen,
 * deshalb liegt die obere Schwelle bei 20 %.
 */
const BANDS = { typical: 0.08, notable: 0.2 };

export type MetricBand = "far_below" | "below" | "typical" | "above" | "far_above" | "unknown";

export type MetricContextResult = {
  definition: MetricDefinition;
  value: number | null;
  /** Median der Vergangenheit. `null`, wenn zu wenige Jahre vorliegen. */
  median: number | null;
  /** Wie viele Jahre tatsächlich in den Median eingegangen sind. */
  years: number;
  /** Abweichung vom Median in Prozent. */
  deviationPercent: number | null;
  band: MetricBand;
  /** Der formatierte Wert allein — für die kompakte Anzeige. */
  formatted: string;
  /**
   * Der Satz aus §50: Wert plus historische Einordnung.
   *
   * Bewusst **wertungsfrei** formuliert. „Über dem Median“ ist eine Messung;
   * ob das gut oder schlecht ist, hängt von der Kennzahl und der Erwartung ab
   * und wird nicht in denselben Satz gepackt.
   */
  sentence: string;
};

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function formatMetric(value: number | null, format: MetricFormat, currency = "€"): string {
  if (value === null || !Number.isFinite(value)) return "—";

  switch (format) {
    case "percent":
      return `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
    case "currency":
      return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${currency}`;
    case "ratio":
      return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
    default:
      return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  }
}

/** Ab wie vielen Jahren ein Median gebildet wird. */
const MIN_YEARS = 3;

/**
 * Setzt eine Kennzahl in ihren historischen Zusammenhang.
 *
 * Zwei Fälle werden ausdrücklich **nicht** zu einer Aussage verrechnet:
 *
 * - **Unter drei Jahren** entsteht kein Median. Zwei Werte ergeben deren
 *   Mittelwert, und der beschreibt keine Historie.
 * - **Eine Reihe aus lauter Nullen** ist keine Messung, sondern eine Lücke im
 *   Anbieterfeld. Bei AAPL trifft das am 2026-08-08 auf die
 *   Eigenkapitalrendite zu: alle fünf Jahre stehen auf 0,00.
 */
export function buildMetricContext(
  metricId: string,
  value: number | null | undefined,
  history: readonly (number | null | undefined)[] = [],
  currency = "€"
): MetricContextResult | null {
  const definition = metricDefinitions[metricId];
  if (!definition) return null;

  const current = typeof value === "number" && Number.isFinite(value) ? value : null;
  const usable = history.filter(
    (entry): entry is number => typeof entry === "number" && Number.isFinite(entry) && entry !== 0
  );

  const formatted = formatMetric(current, definition.format, currency);
  const historyMedian = usable.length >= MIN_YEARS ? median(usable) : null;

  if (current === null) {
    return {
      definition,
      value: null,
      median: historyMedian,
      years: usable.length,
      deviationPercent: null,
      band: "unknown",
      formatted,
      sentence: `${definition.label} liegt nicht vor.`
    };
  }

  if (historyMedian === null || historyMedian === 0) {
    return {
      definition,
      value: current,
      median: null,
      years: usable.length,
      deviationPercent: null,
      band: "unknown",
      formatted,
      sentence:
        usable.length === 0
          ? `${definition.label} ${formatted} — keine Vergangenheitswerte zum Vergleich verfügbar.`
          : `${definition.label} ${formatted} — nur ${usable.length} Vergleichsjahre, zu wenig für eine historische Einordnung.`
    };
  }

  const deviation = (current - historyMedian) / Math.abs(historyMedian);
  const magnitude = Math.abs(deviation);

  const band: MetricBand =
    magnitude < BANDS.typical
      ? "typical"
      : magnitude < BANDS.notable
        ? deviation > 0
          ? "above"
          : "below"
        : deviation > 0
          ? "far_above"
          : "far_below";

  const medianText = `${definition.label === "KGV" ? "" : ""}${formatMetric(historyMedian, definition.format, currency)}`;
  const window = `${usable.length}-Jahres-Median`;

  const comparison =
    band === "typical"
      ? `im üblichen Rahmen (${window} ${medianText})`
      : band === "above"
        ? `über dem ${window} von ${medianText}`
        : band === "below"
          ? `unter dem ${window} von ${medianText}`
          : band === "far_above"
            ? `deutlich über dem ${window} von ${medianText}`
            : `deutlich unter dem ${window} von ${medianText}`;

  return {
    definition,
    value: current,
    median: historyMedian,
    years: usable.length,
    deviationPercent: Number((deviation * 100).toFixed(1)),
    band,
    formatted,
    sentence: `${definition.label} ${formatted} — ${comparison}.`
  };
}

/**
 * Ob die Abweichung für den Anleger eher günstig oder ungünstig ist.
 *
 * Getrennt vom Satz, und das ist Absicht: die Messung und ihre Bewertung
 * gehören nicht in denselben Satz. Bei `neutral` gibt es keine Richtung — ein
 * hoher RSI ist weder gut noch schlecht.
 */
export function bandTone(result: MetricContextResult): "favourable" | "unfavourable" | "neutral" {
  if (result.definition.direction === "neutral" || result.band === "typical" || result.band === "unknown") {
    return "neutral";
  }

  const higher = result.band === "above" || result.band === "far_above";
  const good = result.definition.direction === "higher_is_better" ? higher : !higher;
  return good ? "favourable" : "unfavourable";
}
