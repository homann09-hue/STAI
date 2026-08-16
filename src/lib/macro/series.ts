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

export type MacroCategory =
  | "policy_rate"
  | "inflation"
  | "yield"
  | "exchange_rate"
  | "labour"
  | "growth"
  | "consumption"
  | "money";

/**
 * Erhebungsfrequenz. Sie bestimmt, ab wann ein Wert als veraltet gilt — eine
 * Monatsreihe ist nach zwei Wochen nicht alt, eine Tagesreihe schon.
 */
export type MacroFrequency = "daily" | "business_daily" | "weekly" | "monthly" | "quarterly";

export type MacroSeriesDefinition = {
  id: string;
  label: string;
  /** Was der Wert bedeutet, in einem Satz und ohne Fachjargon. */
  explanation: string;
  category: MacroCategory;
  frequency: MacroFrequency;
  /** Einheit des Werts, wie er geliefert wird. */
  unit: "percent" | "ratio" | "index";
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
  },

  // Ab hier die Erweiterung fuer §28, am 2026-08-08 einzeln gegen die Live-API
  // gemessen. Der falsche Schluesselversuch fuer die Arbeitslosenquote
  // (LFSI/M.I9.S.UNEH.RTT000.4.000) antwortete mit 404 und steht deshalb nicht
  // im Katalog -- aufgenommen wird nur, was nachweislich liefert.
  {
    id: "ea_core_inflation",
    label: "Kerninflation Euroraum",
    explanation:
      "Inflation ohne Energie und Lebensmittel. Sie schwankt weniger und zeigt deshalb den zugrunde liegenden Preisdruck deutlicher als die Gesamtrate.",
    category: "inflation",
    frequency: "monthly",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/ICP",
    resource: "ICP",
    key: "M.U2.N.XEF000.4.ANR"
  },
  {
    id: "ea_unemployment",
    label: "Arbeitslosenquote Euroraum",
    explanation:
      "Anteil der Erwerbslosen an allen Erwerbspersonen zwischen 15 und 74 Jahren. Ein wichtiger Gegenspieler der Inflation im Auftrag der Notenbank.",
    category: "labour",
    frequency: "monthly",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/LFSI",
    resource: "LFSI",
    key: "M.I9.S.UNEHRT.TOTAL0.15_74.T"
  },
  {
    id: "ea_gdp_growth",
    label: "BIP-Wachstum Euroraum",
    explanation:
      "Veränderung der Wirtschaftsleistung gegenüber dem Vorjahresquartal. Die Grundgröße dafür, ob die Wirtschaft wächst oder schrumpft.",
    category: "growth",
    frequency: "quarterly",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/MNA",
    resource: "MNA",
    key: "Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY"
  },
  {
    id: "ea_industrial_production",
    label: "Industrieproduktion Euroraum",
    explanation:
      "Indexstand der industriellen Erzeugung. Er reagiert früher auf Konjunkturwenden als das BIP und dient deshalb als Frühindikator.",
    category: "growth",
    frequency: "monthly",
    unit: "index",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/STS",
    resource: "STS",
    key: "M.I9.Y.PROD.NS0020.4.000"
  },
  {
    id: "ea_retail_turnover",
    label: "Einzelhandelsumsätze Euroraum",
    explanation:
      "Indexstand der Umsätze im Einzelhandel. Er zeigt, wie viel private Haushalte tatsächlich ausgeben.",
    category: "consumption",
    frequency: "monthly",
    unit: "index",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/STS",
    resource: "STS",
    key: "M.I9.Y.TOVT.NS0020.4.000"
  },
  {
    id: "ea_money_supply_m3",
    label: "Geldmenge M3 Euroraum",
    explanation:
      "Wachstum der breiten Geldmenge gegenüber dem Vorjahr. Sie beschreibt, wie viel Geld im Umlauf ist, und wirkt mit Verzögerung auf die Preise.",
    category: "money",
    frequency: "monthly",
    unit: "percent",
    region: "euro_area",
    source: "ECB Data Portal",
    sourceUrl: "https://data.ecb.europa.eu/data/datasets/BSI",
    resource: "BSI",
    key: "M.U2.Y.V.M30.X.I.U2.2300.Z01.A"
  }
];

/**
 * Marktbasierte Makro-Indikatoren.
 *
 * §28 nennt Öl, Gold, VIX und den Dollar-Index. Sie sind keine Statistikreihen,
 * sondern Kurse — und kommen deshalb nicht von der EZB, sondern über den
 * Kursanbieter.
 *
 * Am 2026-08-08 einzeln geprüft. **Nicht enthalten:** WTI (`CLUSD`), der
 * Dollar-Index (`DX-Y.NYB`, `^DXY`, `USDX`) und die 10-Jahres-Rendite
 * (`^TNX`) — alle antworteten mit HTTP 402, also Tarifgrenze. Sie fehlen hier,
 * statt durch einen ähnlichen Wert ersetzt zu werden: Brent ist nicht WTI, und
 * EUR/USD ist nicht der Dollar-Index gegen einen Währungskorb.
 */
export type MarketMacroIndicator = {
  id: string;
  label: string;
  explanation: string;
  /** Symbol beim Kursanbieter, wie gemessen. */
  symbol: string;
  category: "commodity" | "volatility" | "equity_index";
};

export const marketMacroIndicators: MarketMacroIndicator[] = [
  {
    id: "gold",
    label: "Gold",
    explanation: "Preis je Feinunze. Gold gilt als Zufluchtswert und reagiert auf Realzinsen und Währungsrisiken.",
    symbol: "GCUSD",
    category: "commodity"
  },
  {
    id: "brent",
    label: "Brent-Öl",
    explanation: "Nordseesorte Brent, der internationale Referenzpreis für Rohöl. Er wirkt direkt auf die Energiepreise.",
    symbol: "BZUSD",
    category: "commodity"
  },
  {
    id: "silver",
    label: "Silber",
    explanation: "Preis je Feinunze. Silber ist zugleich Edelmetall und Industriemetall und schwankt deshalb stärker als Gold.",
    symbol: "SIUSD",
    category: "commodity"
  },
  {
    id: "vix",
    label: "VIX",
    explanation:
      "Erwartete Schwankung des S&P 500 über die kommenden 30 Tage, abgeleitet aus Optionspreisen. Hohe Werte zeigen Nervosität, keine Richtung.",
    symbol: "^VIX",
    category: "volatility"
  },
  {
    id: "sp500",
    label: "S&P 500",
    explanation: "Index der 500 größten US-Unternehmen. Die gebräuchlichste Messgröße für den US-Aktienmarkt.",
    symbol: "^GSPC",
    category: "equity_index"
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
  // Obergrenze, damit eine Fehlkonfiguration nicht versehentlich die gesamte
  // Historie zieht. 1200 Tagesbeobachtungen decken gut drei Jahre ab und
  // bleiben in der Groessenbegrenzung des Providers.
  url.searchParams.set("lastNObservations", `${Math.max(1, Math.min(1200, Math.floor(observations)))}`);
  return url;
}
