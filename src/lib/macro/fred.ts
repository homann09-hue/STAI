/**
 * US-Makrodaten über FRED (Federal Reserve Bank of St. Louis).
 *
 * §28 verlangt CPI, PPI, Arbeitsmarkt, NFP, BIP, Einzelhandel,
 * Konsumentenvertrauen, Anleiherenditen, Dollar-Index und Öl. Für den Euroraum
 * liefert die EZB; für die USA gab es bis hierher **keine** Quelle — WTI, der
 * Dollar-Index und die 10-Jahres-Rendite antworteten beim Kursanbieter mit
 * HTTP 402.
 *
 * **Für Werte kein Schlüssel nötig.** Am 2026-08-08 gemessen: der CSV-Export
 * unter `fred.stlouisfed.org/graph/fredgraph.csv?id=…` antwortet ohne
 * Authentifizierung. Mit `FRED_API_KEY` nutzt der serverseitige Client die
 * offizielle JSON-API zusätzlich für Erstveröffentlichung und Revisionen.
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

export const FRED_HOST = "fred.stlouisfed.org";
export const FRED_API_HOST = "api.stlouisfed.org";

export type FredCopyright = "public_domain" | "citation_required";

export type FredCategory =
  | "policy_rate"
  | "inflation"
  | "labour"
  | "growth"
  | "consumption"
  | "yield"
  | "money"
  | "production"
  | "liquidity"
  | "exchange_rate"
  | "commodity";

export type FredFrequency = "daily" | "weekly" | "monthly" | "quarterly";

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
    id: "us_pce_prices",
    seriesId: "PCEPI",
    label: "PCE-Preisindex USA",
    explanation:
      "Preisindex der privaten Konsumausgaben. Er ist die bevorzugte Inflationsgröße der US-Notenbank; angezeigt wird der Indexstand, nicht automatisch die Jahresrate.",
    category: "inflation",
    frequency: "monthly",
    unit: "index",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Economic Analysis"
  },
  {
    id: "us_core_pce_prices",
    seriesId: "PCEPILFE",
    label: "Kern-PCE-Preisindex USA",
    explanation:
      "PCE-Preisindex ohne Lebensmittel und Energie. Er zeigt den zugrunde liegenden Preisdruck, bleibt aber revisionsanfällig.",
    category: "inflation",
    frequency: "monthly",
    unit: "index",
    copyright: "public_domain",
    originalSource: "U.S. Bureau of Economic Analysis"
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
    id: "us_yield_2y",
    seriesId: "DGS2",
    label: "US-Rendite 2 Jahre",
    explanation: "Verzinsung zweijähriger US-Staatsanleihen. Sie reagiert besonders auf erwartete Leitzinsänderungen.",
    category: "yield",
    frequency: "daily",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_yield_5y",
    seriesId: "DGS5",
    label: "US-Rendite 5 Jahre",
    explanation: "Verzinsung fünfjähriger US-Staatsanleihen als mittlerer Punkt der Zinsstruktur.",
    category: "yield",
    frequency: "daily",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_yield_30y",
    seriesId: "DGS30",
    label: "US-Rendite 30 Jahre",
    explanation: "Verzinsung dreißigjähriger US-Staatsanleihen und langes Ende der US-Zinsstruktur.",
    category: "yield",
    frequency: "daily",
    unit: "percent",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_money_supply_m2",
    seriesId: "M2SL",
    label: "US-Geldmenge M2",
    explanation: "Breite US-Geldmenge aus Bargeld, Sichteinlagen und kurzfristig verfügbaren Spareinlagen.",
    category: "money",
    frequency: "monthly",
    unit: "usd",
    valueSuffix: "Mrd. $",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "us_industrial_production",
    seriesId: "INDPRO",
    label: "Industrieproduktion USA",
    explanation: "Index der realen Produktion von Industrie, Bergbau sowie Strom- und Gasversorgern.",
    category: "production",
    frequency: "monthly",
    unit: "index",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "fed_balance_sheet",
    seriesId: "WALCL",
    label: "Bilanzsumme der Federal Reserve",
    explanation: "Gesamtvermögen der Federal Reserve. Veränderungen können den systemischen Liquiditätsrahmen beeinflussen.",
    category: "liquidity",
    frequency: "weekly",
    unit: "usd",
    valueSuffix: "Mio. $",
    copyright: "public_domain",
    originalSource: "Board of Governors of the Federal Reserve System"
  },
  {
    id: "fed_reverse_repo",
    seriesId: "RRPONTSYD",
    label: "Fed Overnight Reverse Repo",
    explanation: "Tägliche Nutzung der Overnight-Reverse-Repo-Fazilität. Ein Rückgang kann auf abfließende überschüssige Liquidität hindeuten.",
    category: "liquidity",
    frequency: "daily",
    unit: "usd",
    valueSuffix: "Mrd. $",
    copyright: "public_domain",
    originalSource: "Federal Reserve Bank of New York"
  },
  {
    id: "us_treasury_general_account",
    seriesId: "WTREGEN",
    label: "US Treasury General Account",
    explanation: "Kassenbestand des US-Finanzministeriums bei der Federal Reserve. Bewegungen verändern die Bankreserven im Finanzsystem.",
    category: "liquidity",
    frequency: "weekly",
    unit: "usd",
    valueSuffix: "Mio. $",
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

export type FredRevisionStatus = "not_available" | "unrevised" | "revised";

export type FredObservation = {
  period: string;
  value: number;
  realtimeStart?: string | null;
  realtimeEnd?: string | null;
  firstPublishedAt?: string | null;
  initialValue?: number | null;
  revisionStatus?: FredRevisionStatus;
};

function isoDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Parst die offizielle JSON-Antwort, ohne unvollständige Zeilen zu erraten. */
export function parseFredApiObservations(payload: unknown): FredObservation[] {
  if (!payload || typeof payload !== "object") return [];
  const observations = (payload as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) return [];

  return observations.flatMap((entry): FredObservation[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const period = isoDate(row.date);
    const rawValue = typeof row.value === "string" ? row.value.trim() : row.value;
    if (!period || rawValue === "" || rawValue === ".") return [];
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return [];
    return [{
      period,
      value,
      realtimeStart: isoDate(row.realtime_start),
      realtimeEnd: isoDate(row.realtime_end)
    }];
  }).sort((left, right) => left.period.localeCompare(right.period));
}

/** Verknüpft den aktuellen Wert mit der offiziellen ersten Veröffentlichung. */
export function mergeFredObservationVintages(
  current: readonly FredObservation[],
  initial: readonly FredObservation[]
): FredObservation[] {
  const initialByPeriod = new Map(initial.map((entry) => [entry.period, entry]));

  return current.map((entry) => {
    const first = initialByPeriod.get(entry.period);
    if (!first) {
      return { ...entry, firstPublishedAt: null, initialValue: null, revisionStatus: "not_available" };
    }
    const revised = Math.abs(entry.value - first.value) > 1e-9;
    return {
      ...entry,
      firstPublishedAt: first.realtimeStart ?? null,
      initialValue: first.value,
      revisionStatus: revised ? "revised" : "unrevised"
    };
  });
}

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
  return observations.slice(1).map((entry, index) => {
    const previous = observations[index];
    const value = Number((entry.value - previous.value).toFixed(3));
    const carriesVintageData = entry.revisionStatus !== undefined || entry.initialValue !== undefined;
    if (!carriesVintageData) return { period: entry.period, value };

    const initialValue = entry.initialValue !== null && entry.initialValue !== undefined
      && previous.initialValue !== null && previous.initialValue !== undefined
      ? Number((entry.initialValue - previous.initialValue).toFixed(3))
      : null;

    return {
      ...entry,
      value,
      initialValue,
      revisionStatus: initialValue === null
        ? "not_available"
        : Math.abs(value - initialValue) > 1e-9 ? "revised" : "unrevised"
    };
  });
}

export function fredSeriesUrl(series: FredSeriesDefinition) {
  const url = new URL(`https://${FRED_HOST}/graph/fredgraph.csv`);
  url.searchParams.set("id", series.seriesId);
  return url;
}

export function fredApiSeriesUrl(
  series: FredSeriesDefinition,
  apiKey: string,
  outputType: 1 | 4,
  observations: number
) {
  const url = new URL(`https://${FRED_API_HOST}/fred/series/observations`);
  url.searchParams.set("series_id", series.seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("output_type", String(outputType));
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(Math.max(2, Math.min(observations, 2_000))));
  return url;
}
