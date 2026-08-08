/**
 * Katalog der Makro-Zeitreihen.
 *
 * Jede Serie hier wurde am 2026-08-08 einzeln gegen die Live-API der EZB
 * gemessen, nicht aus einer Dokumentation abgeschrieben. Der Katalog waechst
 * nach derselben Regel wie der Instrument Master: eine Serie kommt erst hinein,
 * wenn sie nachweislich antwortet.
 *
 * Warum die EZB als erste Quelle: sie braucht keinen Schluessel, keinen Tarif
 * und keine Boersenlizenz. Damit ist Makroanalyse der erste Bereich der
 * Zieldefinition, der ohne externen Blocker gebaut werden kann.
 *
 * Nutzungsbedingungen: die EZB erlaubt die Weiterverwendung ihrer
 * Statistikdaten mit Quellenangabe. Die Angabe steht deshalb an jedem
 * Datenpunkt und ist nicht optional.
 */

export type MacroCategory = "policy_rate" | "inflation" | "yield" | "exchange_rate";

/**
 * Erhebungsfrequenz. Sie bestimmt, ab wann ein Wert als veraltet gilt — eine
 * Monatsreihe ist nach zwei Wochen nicht alt, eine Tagesreihe schon.
 */
export type MacroFrequency = "daily" | "business_daily" | "monthly";

export type MacroSeriesDefinition = {
  id: string;
  label: string;
  /** Was der Wert bedeutet, in einem Satz und ohne Fachjargon. */
  explanation: string;
  category: MacroCategory;
  frequency: MacroFrequency;
  /** Einheit des Werts, wie er geliefert wird. */
  unit: "percent" | "ratio";
  region: "euro_area";
  source: "ECB Data Portal";
  sourceUrl: string;
  /** SDMX-Pfad ohne Host, exakt wie gemessen. */
  resource: string;
  key: string;
};

export const ECB_DATA_HOST = "data-api.ecb.europa.eu";

export const macroSeriesCatalog: MacroSeriesDefinition[] = [
  {
    id: "ea_policy_rate",
    label: "EZB-Leitzins",
    explanation:
      "Der Zinssatz, zu dem sich Banken bei der EZB Geld leihen. Er ist der Ausgangspunkt für fast alle anderen Zinsen im Euroraum.",
    category: "policy_rate",
    frequency: "daily",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/FM",
    resource: "FM",
    key: "D.U2.EUR.4F.KR.MRR_FR.LEV"
  },
  {
    id: "ea_inflation_hicp",
    label: "Inflation Euroraum (HVPI)",
    explanation:
      "Veränderung der Verbraucherpreise gegenüber dem Vorjahresmonat. Die EZB strebt mittelfristig 2 % an.",
    category: "inflation",
    frequency: "monthly",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/ICP",
    resource: "ICP",
    key: "M.U2.N.000000.4.ANR"
  },
  {
    id: "ea_yield_3m",
    label: "Rendite 3 Monate (AAA)",
    explanation:
      "Verzinsung kurzlaufender Staatsanleihen bester Bonität im Euroraum. Sie folgt eng dem Leitzins.",
    category: "yield",
    frequency: "business_daily",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/YC",
    resource: "YC",
    key: "B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M"
  },
  {
    id: "ea_yield_10y",
    label: "Rendite 10 Jahre (AAA)",
    explanation:
      "Verzinsung langlaufender Staatsanleihen bester Bonität. Sie spiegelt die Erwartung an Wachstum und Inflation über zehn Jahre.",
    category: "yield",
    frequency: "business_daily",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/YC",
    resource: "YC",
    key: "B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y"
  },
  {
    id: "eur_usd",
    label: "EUR/USD",
    explanation:
      "Wie viele US-Dollar ein Euro kostet. Ein steigender Wert bedeutet einen stärkeren Euro.",
    category: "exchange_rate",
    frequency: "business_daily",
    unit: "ratio",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/EXR",
    resource: "EXR",
    key: "D.USD.EUR.SP00.A"
  }
];

export function findMacroSeries(id: string) {
  return macroSeriesCatalog.find((series) => series.id === id) ?? null;
}

/**
 * Baut die Abfrage-URL. `detail=dataonly` reduziert die Antwort auf Zeitpunkt
 * und Wert — die Metadatenspalten der EZB machen sonst ein Vielfaches der
 * Nutzlast aus.
 */
export function macroSeriesUrl(series: MacroSeriesDefinition, observations: number) {
  const url = new URL(`https://${ECB_DATA_HOST}/service/data/${series.resource}/${series.key}`);
  url.searchParams.set("format", "csvdata");
  url.searchParams.set("detail", "dataonly");
  url.searchParams.set("lastNObservations", `${Math.max(1, Math.min(240, Math.floor(observations)))}`);
  return url;
}
