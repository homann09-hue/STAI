/**
 * US-Makrodaten über FRED (Federal Reserve Bank of St. Louis).
 *
 * §28 verlangt CPI, PPI, Arbeitsmarkt, NFP, BIP, Einzelhandel,
 * Konsumentenvertrauen, Anleiherenditen, Dollar-Index und Öl. Für den Euroraum
 * liefert die EZB; für die USA gab es bis hierher **keine** Quelle — WTI, der
 * Dollar-Index und die 10-Jahres-Rendite antworteten beim Kursanbieter mit
 * HTTP 402.
 *
 * **Kein Schlüssel nötig.** Am 2026-08-08 gemessen: der CSV-Export unter
 * `fred.stlouisfed.org/graph/fredgraph.csv?id=…` antwortet ohne
 * Authentifizierung. Die JSON-API unter `api.stlouisfed.org` verlangt dagegen
 * einen Schlüssel (HTTP 400 ohne). Deshalb wird hier der CSV-Weg genutzt.
 *
 * ## Lizenz — und warum sie hier im Code steht
 *
 * FRED unterscheidet drei Rechtsstände, und sie stehen **je Reihe gemessen**
 * im Katalog statt pauschal angenommen:
 *
 * | Stand | Bedeutung |
 * |---|---|
 * | `public_domain` | Nutzung frei, Quellenangabe erbeten |
 * | `citation_required` | Urheberrechtlich geschützt, Nutzung mit Quellenangabe zulässig |
 * | `preapproval_required` | Nur nicht-kommerziell ohne schriftliche Erlaubnis |
 *
 * Reihen mit `preapproval_required` sind hier **nicht** aufgenommen.
 *
 * Abschnitt IV der FRED-Bedingungen erlaubt für die beiden ersten Stände
 * „internal commercial uses" und die Darstellung in „reports to clients" mit
 * Quellenangabe. Ob ein kostenpflichtiges SaaS-Produkt darunter fällt oder
 * unter das Verbot, „datasets for commercial use" weiterzuverbreiten, ist
 * **eine juristische Frage und keine technische**. Sie ist in
 * `docs/PROGRESS_MATRIX.md` als offener Punkt vermerkt.
 *
 * Die Quellenangabe ist deshalb Pflichtfeld an jeder Reihe und nicht optional.
 */

import { fetchBoundedProviderText } from "@/lib/providers/http-json";

export const FRED_HOST = "fred.stlouisfed.org";

export type FredCopyright = "public_domain" | "citation_required";

export type FredCategory =
  | "policy_rate"
  | "inflation"
  | "labour"
  | "growth"
  | "consumption"
  | "yield"
  | "exchange_rate"
  | "commodity";

export type FredFrequency = "daily" | "monthly" | "quarterly";

export type FredSeriesDefinition = {
  id: string;
  /** Die FRED-Kennung, exakt wie gemessen. */
  seriesId: string;
  label: string;
  explanation: string;
  category: FredCategory;
  frequency: FredFrequency;
  unit: "percent" | "index" | "usd" | "thousands";
  /** Am 2026-08-08 auf der Reihenseite abgelesen, nicht angenommen. */
  copyright: FredCopyright;
  /** Ursprungsbehörde. Gehört in die Quellenangabe. */
  originalSource: string;
  /**
   * Ob der gemeldete Wert die Veränderung zum Vormonat ist statt des Standes.
   *
   * Nur für die Beschäftigung relevant: FRED liefert mit `PAYEMS` den
   * **Bestand** in Tausend. Die als „NFP" berichtete Zahl ist die monatliche
   * Veränderung. Sie wird abgeleitet und als abgeleitet gekennzeichnet.
   */
  reportAsChange?: boolean;
  /**
   * Was hinter dem Wert stehen muss, damit er stimmt.
   *
   * FRED liefert nackte Zahlen in der Einheit der Reihe, und die steht nur in
   * der Beschreibung. Die Einzelhandelsumsätze kommen **in Millionen** Dollar:
   * „700.000,00 $" wäre um den Faktor eine Million daneben und sähe dabei
   * völlig plausibel aus. Prozent- und Indexreihen brauchen nichts.
   */
  valueSuffix?: string;
};

/**
 * Der Katalog.
 *
 * Aufgenommen ist nur, was am 2026-08-08 einzeln geantwortet hat. **Nicht
 * enthalten: PMI.** Die Reihe `NAPM` gibt bei FRED HTTP 404 — das ISM hat die
 * Weiterverbreitung eingestellt. `INDPRO` (Industrieproduktion) ist etwas
 * anderes und steht deshalb nicht als Ersatz darin.
 */
export const fredSeriesCatalog: FredSeriesDefinition[] = [
  {
    id: "us_policy_rate",
    // Bewusst die **Obergrenze des Zielkorridors**, nicht `DFF`. Der effektive
    // Satz schwankt taeglich um ein paar Basispunkte; aus ihm eine
    // Entscheidungshistorie abzuleiten haette hunderte "Zinsschritte" erzeugt,
    // wo es sechs gab. Am 2026-08-09 gemessen: DFEDTARU macht in 800
    // Beobachtungen genau 6 saubere Stufen, DFF 798 Bewegungen.
    seriesId: "DFEDTARU",
    label: "US-Leitzins (Obergrenze)",
    explanation:
      "Obergrenze des Zielkorridors der US-Notenbank. Die Fed nennt keinen einzelnen Satz, sondern eine Spanne von 25 Basispunkten.",
    category: "policy_rate",
    frequency: "daily",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_yield_3m",
    seriesId: "DGS3MO",
    label: "US-Rendite 3 Monate",
    explanation:
      "Verzinsung dreimonatiger US-Staatsanleihen. Zusammen mit der zehnjährigen Rendite ergibt sie die Zinsstruktur.",
    category: "yield",
    frequency: "daily",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_cpi",
    seriesId: "CPIAUCSL",
    label: "Verbraucherpreise USA (CPI)",
    explanation:
      "Indexstand der Verbraucherpreise. Die Inflationsrate ist die Veränderung dieses Index gegenüber dem Vorjahr.",
    category: "inflation",
    frequency: "monthly",
    unit: "index",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Labor Statistics"
  },
  {
    id: "us_core_cpi",
    seriesId: "CPILFESL",
    label: "Kern-Verbraucherpreise USA",
    explanation:
      "Verbraucherpreise ohne Energie und Lebensmittel. Weniger schwankungsanfällig und deshalb näher am zugrunde liegenden Preisdruck.",
    category: "inflation",
    frequency: "monthly",
    unit: "index",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Labor Statistics"
  },
  {
    id: "us_ppi",
    seriesId: "PPIACO",
    label: "Erzeugerpreise USA (PPI)",
    explanation:
      "Preise auf Herstellerebene. Sie laufen den Verbraucherpreisen oft voraus, weil Kosten mit Verzögerung weitergegeben werden.",
    category: "inflation",
    frequency: "monthly",
    unit: "index",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Labor Statistics"
  },
  {
    id: "us_unemployment",
    seriesId: "UNRATE",
    label: "Arbeitslosenquote USA",
    explanation: "Anteil der Arbeitslosen an allen Erwerbspersonen. Eine der beiden Zielgrößen der US-Notenbank.",
    category: "labour",
    frequency: "monthly",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Labor Statistics"
  },
  {
    id: "us_nonfarm_payrolls",
    seriesId: "PAYEMS",
    label: "Beschäftigung außerhalb der Landwirtschaft (NFP)",
    explanation:
      "Veränderung der Zahl der Beschäftigten gegenüber dem Vormonat, in Tausend. Der meistbeachtete US-Arbeitsmarktwert.",
    category: "labour",
    frequency: "monthly",
    unit: "thousands",
    valueSuffix: "Tsd. Stellen",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Labor Statistics",
    reportAsChange: true
  },
  {
    id: "us_gdp_growth",
    seriesId: "A191RL1Q225SBEA",
    label: "BIP-Wachstum USA",
    explanation:
      "Reales Wirtschaftswachstum gegenüber dem Vorquartal, auf ein Jahr hochgerechnet. So wird es in den USA berichtet.",
    category: "growth",
    frequency: "quarterly",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Economic Analysis"
  },
  {
    id: "us_retail_sales",
    seriesId: "RSAFS",
    label: "Einzelhandelsumsätze USA",
    explanation: "Umsätze im Einzelhandel in Millionen Dollar. Sie zeigen, wie viel Haushalte tatsächlich ausgeben.",
    category: "consumption",
    frequency: "monthly",
    unit: "usd",
    valueSuffix: "Mio. $",
    copyright: "public_domain",
    originalSource: "U.S. Census Bureau"
  },
  {
    id: "us_consumer_sentiment",
    seriesId: "UMCSENT",
    label: "Konsumentenvertrauen USA",
    explanation:
      "Stimmungsindex der Universität Michigan. Er misst die Erwartung der Haushalte, nicht ihr tatsächliches Verhalten.",
    category: "consumption",
    frequency: "monthly",
    unit: "index",
    // Als einzige Reihe im Katalog urheberrechtlich geschuetzt. Nutzung mit
    // Quellenangabe zulaessig -- die Angabe ist deshalb hier kein Beiwerk.
    copyright: "citation_required",
    originalSource: "University of Michigan"
  },
  {
    id: "us_yield_10y",
    seriesId: "DGS10",
    label: "US-Rendite 10 Jahre",
    explanation:
      "Verzinsung zehnjähriger US-Staatsanleihen. Der Referenzzins für fast alle langfristigen Finanzierungen weltweit.",
    category: "yield",
    frequency: "daily",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_dollar_index",
    seriesId: "DTWEXBGS",
    label: "Dollar-Index (breit)",
    explanation:
      "Wert des Dollars gegenüber einem handelsgewichteten Währungskorb. Ein steigender Wert bedeutet einen stärkeren Dollar.",
    category: "exchange_rate",
    frequency: "daily",
    unit: "index",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "wti_oil",
    seriesId: "DCOILWTICO",
    label: "WTI-Öl",
    explanation:
      "US-Referenzsorte West Texas Intermediate, Preis je Barrel. Nicht identisch mit Brent — beide Sorten laufen zeitweise deutlich auseinander.",
    category: "commodity",
    frequency: "daily",
    unit: "usd",
    valueSuffix: "$ je Barrel",
    copyright: "public_domain",
    originalSource: "U.S. Energy Information Administration"
  }
];

export function findFredSeries(id: string) {
  return fredSeriesCatalog.find((series) => series.id === id) ?? null;
}

/** Die Quellenangabe, die FRED für jede Reihe verlangt. */
export function fredCitation(series: FredSeriesDefinition) {
  return `Quelle: ${series.originalSource} via FRED (Federal Reserve Bank of St. Louis)`;
}

export type FredObservation = { period: string; value: number };

/**
 * Liest den CSV-Export.
 *
 * Format, am 2026-08-08 gemessen:
 *
 * ```
 * observation_date,UNRATE
 * 1948-01-01,3.4
 * 1952-12-01,
 * ```
 *
 * **Leere Werte kommen vor** und sind keine Nullen — FRED lässt Zeilen ohne
 * Beobachtung leer. Sie werden verworfen und nicht interpoliert: eine
 * ausgedachte Zwischenbeobachtung ist genau die Sorte Erfindung, die dieses
 * Projekt aus dem Code entfernt hat.
 */
export function parseFredCsv(text: string): FredObservation[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  return lines.slice(1).flatMap((line): FredObservation[] => {
    const [period, raw] = line.split(",");
    if (!period || raw === undefined) return [];

    const trimmed = raw.trim();
    // "." ist FREDs Platzhalter fuer "keine Beobachtung".
    if (trimmed === "" || trimmed === ".") return [];

    const value = Number(trimmed);
    if (!Number.isFinite(value)) return [];

    return [{ period: period.trim(), value }];
  });
}

/**
 * Wandelt Bestände in Veränderungen.
 *
 * Nur für die Beschäftigung: `PAYEMS` liefert den Bestand, berichtet wird die
 * monatliche Veränderung. Die erste Beobachtung fällt dabei weg — sie hat
 * keinen Vorgänger, und eine Veränderung gegenüber nichts gibt es nicht.
 */
export function toMonthlyChange(observations: readonly FredObservation[]): FredObservation[] {
  return observations.slice(1).map((entry, index) => ({
    period: entry.period,
    value: Number((entry.value - observations[index].value).toFixed(3))
  }));
}

export function fredSeriesUrl(series: FredSeriesDefinition) {
  const url = new URL(`https://${FRED_HOST}/graph/fredgraph.csv`);
  url.searchParams.set("id", series.seriesId);
  return url;
}

export type FredFetchResult = {
  observations: FredObservation[];
  /** Warum die Reihe so aussieht — inklusive Pflicht-Quellenangabe. */
  note: string;
};

/**
 * Holt eine Reihe.
 *
 * Wirft nicht: eine nicht erreichbare Makroreihe darf keinen Analysepfad
 * abbrechen. Sie darf aber auch nicht durch einen Schätzwert ersetzt werden,
 * deshalb endet jeder Fehlerfall in einer leeren Reihe mit Begründung.
 */
export async function fetchFredSeries(
  series: FredSeriesDefinition,
  observations = 400
): Promise<FredFetchResult> {
  try {
    const { text } = await fetchBoundedProviderText(fredSeriesUrl(series), "FRED", {
      timeoutMs: 9000,
      accept: "text/csv",
      maxBytes: 1_500_000
    });

    const parsed = parseFredCsv(text);
    const trimmed = parsed.slice(-Math.max(2, observations));
    const values = series.reportAsChange ? toMonthlyChange(trimmed) : trimmed;

    return values.length
      ? { observations: values, note: fredCitation(series) }
      : { observations: [], note: `Keine verwertbaren Beobachtungen. ${fredCitation(series)}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    return { observations: [], note: `Reihe nicht abrufbar: ${message}.` };
  }
}
