import { assessDataQuality } from "@/lib/data-quality";
import { analyzePortfolio } from "@/lib/portfolio-analytics";
import { buildRiskReport } from "@/lib/risk-engine";
import { calculateProfessionalScores, calculateTotalScore } from "@/lib/scoring";
import type {
  AiAnalysis,
  AnalysisLayer,
  AlertRule,
  Asset,
  AssetDetail,
  AssetSummary,
  Candle,
  DashboardData,
  Fundamentals,
  MacroFactor,
  NewsItem,
  PortfolioSummary,
  ProfessionalScores,
  Quote,
  Scores,
  TechnicalIndicators,
  TimeRange
} from "@/lib/types";

type AssetDetailCore = Omit<
  AssetDetail,
  "professionalScores" | "dataQuality" | "riskReport" | "analysisLayers" | "macroFactors" | "aiAnalysis"
> & {
  aiAnalysis: AiAnalysisBase;
};

type AiAnalysisBase = Omit<
  AiAnalysis,
  "counterArguments" | "dataGaps" | "uncertainty" | "sources" | "weakDataWarning"
>;

const asOf = "2026-06-27T10:45:00+02:00";

const assets: Asset[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    type: "stock",
    exchange: "NASDAQ",
    currency: "USD",
    sector: "Halbleiter / KI",
    description:
      "NVIDIA liefert GPU-, Netzwerk- und Software-Plattformen für KI-Rechenzentren, Gaming und professionelle Visualisierung."
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "stock",
    exchange: "NASDAQ",
    currency: "USD",
    sector: "Consumer Tech",
    description:
      "Apple verbindet Hardware, Services und eigene Chips zu einem globalen Plattformgeschaft."
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    type: "stock",
    exchange: "NASDAQ",
    currency: "USD",
    sector: "Software / Cloud",
    description:
      "Microsoft skaliert Cloud, Produktivitat, Security und KI-Infrastruktur uber Azure und Copilot."
  },
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    type: "etf",
    exchange: "NYSE Arca",
    currency: "USD",
    sector: "US Large Cap ETF",
    description:
      "VOO bildet den S&P 500 ab und bietet breite Streuung uber die groessten US-Unternehmen."
  },
  {
    symbol: "BTC-USD",
    name: "Bitcoin",
    type: "crypto",
    exchange: "Crypto",
    currency: "USD",
    sector: "Digital Asset",
    description:
      "Bitcoin ist ein knappes, dezentrales digitales Asset mit zyklischer Liquiditäts- und Risiko-Sensitivität."
  },
  {
    symbol: "ETH-USD",
    name: "Ethereum",
    type: "crypto",
    exchange: "Crypto",
    currency: "USD",
    sector: "Smart Contracts",
    description:
      "Ethereum ist eine programmierbare Blockchain-Plattform für DeFi, Tokenisierung und dezentrale Anwendungen."
  }
];

const quoteMap: Record<string, Quote> = {
  NVDA: {
    price: 148.42,
    change: 4.18,
    changePercent: 2.9,
    dayHigh: 150.3,
    dayLow: 143.2,
    volume: 58200000,
    delayedByMinutes: 15,
    asOf
  },
  AAPL: {
    price: 221.14,
    change: -1.92,
    changePercent: -0.86,
    dayHigh: 224.8,
    dayLow: 219.9,
    volume: 38600000,
    delayedByMinutes: 15,
    asOf
  },
  MSFT: {
    price: 502.61,
    change: 3.86,
    changePercent: 0.77,
    dayHigh: 505.1,
    dayLow: 497.7,
    volume: 21400000,
    delayedByMinutes: 15,
    asOf
  },
  VOO: {
    price: 562.88,
    change: 1.21,
    changePercent: 0.22,
    dayHigh: 564.2,
    dayLow: 560.4,
    volume: 5200000,
    delayedByMinutes: 15,
    asOf
  },
  "BTC-USD": {
    price: 68420,
    change: 1260,
    changePercent: 1.88,
    dayHigh: 69140,
    dayLow: 66580,
    volume: 29800000000,
    delayedByMinutes: 5,
    asOf
  },
  "ETH-USD": {
    price: 3728,
    change: -83,
    changePercent: -2.18,
    dayHigh: 3826,
    dayLow: 3660,
    volume: 14200000000,
    delayedByMinutes: 5,
    asOf
  }
};

const scoreSeeds: Record<string, Omit<Scores, "total">> = {
  NVDA: { trend: 88, news: 82, fundamental: 76, technical: 84, risk: 62 },
  AAPL: { trend: 46, news: 52, fundamental: 73, technical: 43, risk: 72 },
  MSFT: { trend: 72, news: 68, fundamental: 82, technical: 66, risk: 75 },
  VOO: { trend: 63, news: 55, fundamental: 78, technical: 61, risk: 84 },
  "BTC-USD": { trend: 69, news: 57, fundamental: 48, technical: 70, risk: 38 },
  "ETH-USD": { trend: 39, news: 42, fundamental: 44, technical: 36, risk: 33 }
};

const fundamentalsMap: Record<string, Fundamentals> = {
  NVDA: {
    peRatio: 43.6,
    revenueGrowth: 34.2,
    earningsGrowth: 29.8,
    debtToEquity: 0.22,
    cashflow: 48600000000,
    dividendYield: 0.03,
    marketCap: 3650000000000
  },
  AAPL: {
    peRatio: 29.4,
    revenueGrowth: 5.7,
    earningsGrowth: 7.1,
    debtToEquity: 1.42,
    cashflow: 112000000000,
    dividendYield: 0.43,
    marketCap: 3380000000000
  },
  MSFT: {
    peRatio: 35.1,
    revenueGrowth: 16.4,
    earningsGrowth: 18.2,
    debtToEquity: 0.31,
    cashflow: 103000000000,
    dividendYield: 0.66,
    marketCap: 3740000000000
  },
  VOO: {
    peRatio: 24.8,
    revenueGrowth: 8.3,
    earningsGrowth: 9.1,
    debtToEquity: 0.0,
    cashflow: 0,
    dividendYield: 1.22,
    marketCap: 1250000000000
  },
  "BTC-USD": {
    peRatio: null,
    revenueGrowth: 0,
    earningsGrowth: 0,
    debtToEquity: 0,
    cashflow: 0,
    dividendYield: null,
    marketCap: 1340000000000
  },
  "ETH-USD": {
    peRatio: null,
    revenueGrowth: 0,
    earningsGrowth: 0,
    debtToEquity: 0,
    cashflow: 0,
    dividendYield: null,
    marketCap: 448000000000
  }
};

const newsItems: NewsItem[] = [
  {
    id: "n1",
    symbol: "NVDA",
    title: "Cloud-Nachfrage stutzt KI-Chip-Ausblick",
    source: "MarketWire Mock",
    publishedAt: "2026-06-27T08:12:00+02:00",
    relevance: 94,
    sentiment: "positive",
    impactScore: 78,
    summary:
      "Mehrere Hyperscaler melden weiterhin hohe Investitionen in KI-Infrastruktur. Das Modell bewertet die Nachricht als positiv, aber bereits teilweise eingepreist.",
    url: "#"
  },
  {
    id: "n2",
    symbol: "AAPL",
    title: "Regulatorische Prüfung belastet Service-Margen",
    source: "FinBrief Mock",
    publishedAt: "2026-06-27T07:48:00+02:00",
    relevance: 81,
    sentiment: "negative",
    impactScore: -41,
    summary:
      "Neue Vorgaben könnten App-Store-Gebühren in mehreren Regionen reduzieren. Kurzfristig steigt die Unsicherheit für Margenannahmen.",
    url: "#"
  },
  {
    id: "n3",
    symbol: "MSFT",
    title: "Azure-Wachstum bleibt uber Branchenschnitt",
    source: "TechLedger Mock",
    publishedAt: "2026-06-27T06:20:00+02:00",
    relevance: 88,
    sentiment: "positive",
    impactScore: 52,
    summary:
      "Cloud-Checks deuten auf robuste Nachfrage nach Datenbank-, Security- und KI-Diensten hin.",
    url: "#"
  },
  {
    id: "n4",
    symbol: "BTC-USD",
    title: "ETF-Zuflüsse nehmen zu, Volatilität bleibt erhöht",
    source: "ChainDesk Mock",
    publishedAt: "2026-06-27T05:54:00+02:00",
    relevance: 90,
    sentiment: "neutral",
    impactScore: 18,
    summary:
      "Institutionelle Zuflüsse sprechen für Nachfrage, während Hebelpositionen das Rückschlagrisiko erhöhen.",
    url: "#"
  },
  {
    id: "n5",
    symbol: "ETH-USD",
    title: "On-chain Aktivität schwächt sich gegenüber Vorwoche ab",
    source: "BlockSignal Mock",
    publishedAt: "2026-06-26T21:10:00+02:00",
    relevance: 76,
    sentiment: "negative",
    impactScore: -33,
    summary:
      "Geringere Gebühreneinnahmen und schwächere DeFi-Aktivität belasten das kurzfristige Momentum.",
    url: "#"
  }
];

const analysisMap: Record<string, AiAnalysisBase> = {
  NVDA: {
    summary:
      "NVIDIA zeigt starkes Momentum, getragen von KI-Infrastruktur und hoher Nachfrage nach Beschleunigern. Das Bewertungsniveau bleibt der zentrale Risikofaktor.",
    upsideDrivers: [
      "Weiter steigende Rechenzentrumsbudgets",
      "Hohe Bruttomargen durch Plattformbindung",
      "Positive Analystenrevisionen nach Auftragseingangen"
    ],
    downsideDrivers: [
      "Sehr hohe Erwartungen im Kurs",
      "Export- und Lieferkettenrisiken",
      "Mogliche Margennormalisierung bei mehr Wettbewerb"
    ],
    bullCase:
      "KI-Ausgaben bleiben uber mehrere Jahre strukturell hoch und NVIDIA verteidigt die dominante Plattformposition.",
    bearCase:
      "Capex-Wachstum kuhlt ab, Kunden optimieren Bestande und die Bewertung kontrahiert.",
    neutralCase:
      "Gewinne wachsen weiter, aber der Kurs konsolidiert, bis die Bewertung wieder mehr Puffer bietet.",
    shortTerm: "Positiv, aber anfällig für Gewinnmitnahmen.",
    mediumTerm: "Positiv, solange Rechenzentrumsumsatze uber Konsens wachsen.",
    longTerm: "Strukturell attraktiv, mit hoher Bewertungs- und Zykliksensitivitat.",
    riskLevel: "hoch",
    probabilities: { up: 54, down: 28, sideways: 18 },
    modelNote:
      "Modellbasierte Schatzung aus Mock-Kursen, Nachrichten, Fundamentaldaten und technischen Signalen. Keine Garantie."
  },
  AAPL: {
    summary:
      "Apple bleibt qualitativ stark, aber das kurzfristige Momentum ist gemischt. Services, Buybacks und Cashflow stabilisieren, regulatorische Risiken bremsen.",
    upsideDrivers: [
      "Stabile Margen und hoher freier Cashflow",
      "Neue Produktzyklen",
      "Services-Umsatz mit hoher Wiederkehr"
    ],
    downsideDrivers: [
      "Regulatorischer Druck auf App-Store-Modelle",
      "Schwaches Hardware-Wachstum",
      "Hohe Abhangigkeit vom iPhone-Zyklus"
    ],
    bullCase: "KI-Funktionen und Services reaktivieren Wachstum bei stabilen Margen.",
    bearCase: "Regulierung und Hardware-Sattigung drucken Bewertungsmultiples.",
    neutralCase: "Aktie bleibt defensiv, aber ohne klaren kurzfristigen Ausbruch.",
    shortTerm: "Neutral bis leicht schwach.",
    mediumTerm: "Neutral, bis Umsatzwachstum wieder beschleunigt.",
    longTerm: "Qualitat bleibt hoch, Rendite hangt an Innovations- und Servicewachstum.",
    riskLevel: "mittel",
    probabilities: { up: 34, down: 36, sideways: 30 },
    modelNote:
      "Modellbasierte Schatzung aus Mock-Kursen, Nachrichten, Fundamentaldaten und technischen Signalen. Keine Garantie."
  },
  MSFT: {
    summary:
      "Microsoft kombiniert Cloud-Wachstum, KI-Monetarisierung und robuste Margen. Der Score ist positiv mit vergleichsweise moderatem Risiko.",
    upsideDrivers: [
      "Azure und Security wachsen robust",
      "Copilot-Umsätze könnten Margen erweitern",
      "Diversifiziertes Enterprise-Geschaft"
    ],
    downsideDrivers: [
      "Hohe Capex-Anforderungen für KI",
      "Bewertung oberhalb historischer Durchschnitte",
      "Cloud-Wachstum konnte normalisieren"
    ],
    bullCase: "KI-Produkte werden breit monetarisiert und Azure gewinnt Marktanteile.",
    bearCase: "KI-Capex belastet Cashflow, während Wachstumserwartungen sinken.",
    neutralCase: "Solides Wachstum wird von hoher Bewertung ausgeglichen.",
    shortTerm: "Leicht positiv.",
    mediumTerm: "Positiv bei stabilen Cloud-Signalen.",
    longTerm: "Attraktiv dank Plattformbreite und Enterprise-Bindung.",
    riskLevel: "mittel",
    probabilities: { up: 48, down: 24, sideways: 28 },
    modelNote:
      "Modellbasierte Schatzung aus Mock-Kursen, Nachrichten, Fundamentaldaten und technischen Signalen. Keine Garantie."
  },
  VOO: {
    summary:
      "VOO bietet breite US-Large-Cap-Exponierung. Das Einzelwertrisiko ist niedriger, aber die Bewertung des Gesamtmarktes bleibt relevant.",
    upsideDrivers: [
      "Breite Marktpartizipation",
      "Niedrige Kostenstruktur",
      "Gewinnwachstum der Indexschwergewichte"
    ],
    downsideDrivers: [
      "Konzentration in Mega-Cap-Technologie",
      "Zins- und Bewertungsrisiko",
      "Index kann Drawdowns nicht aktiv begrenzen"
    ],
    bullCase: "US-Gewinne steigen breit und Liquidität bleibt freundlich.",
    bearCase: "Bewertung sinkt bei hoheren Realzinsen oder Gewinnrevisionen.",
    neutralCase: "Index läuft seitwärts, während Sektoren rotieren.",
    shortTerm: "Neutral bis positiv.",
    mediumTerm: "Positiv, wenn Marktbreite zunimmt.",
    longTerm: "Breit diversifiziert, aber marktabhangig.",
    riskLevel: "niedrig",
    probabilities: { up: 43, down: 22, sideways: 35 },
    modelNote:
      "Modellbasierte Schatzung aus Mock-Kursen, Nachrichten, Fundamentaldaten und technischen Signalen. Keine Garantie."
  },
  "BTC-USD": {
    summary:
      "Bitcoin profitiert von ETF-Nachfrage und knapper Angebotslogik, bleibt aber stark von Liquidität, Hebel und Regulatorik beeinflusst.",
    upsideDrivers: [
      "ETF-Zuflüsse und institutionelle Nachfrage",
      "Makro-Liquidität",
      "Narrativ als knappes digitales Asset"
    ],
    downsideDrivers: [
      "Hohe Volatilität und Liquidationscluster",
      "Regulatorische Schlagzeilen",
      "Starke Korrelation mit Risikoassets"
    ],
    bullCase: "ETF-Zuflüsse beschleunigen und Liquidität bleibt risikofreundlich.",
    bearCase: "Hebelabbau lost schnelle Korrektur aus.",
    neutralCase: "Kurs konsolidiert in breiter Range.",
    shortTerm: "Positiv, aber sehr volatil.",
    mediumTerm: "Neutral bis positiv.",
    longTerm: "Chancenreich, mit extremen Drawdown-Risiken.",
    riskLevel: "hoch",
    probabilities: { up: 46, down: 32, sideways: 22 },
    modelNote:
      "Modellbasierte Schatzung aus Mock-Kursen, Nachrichten, Fundamentaldaten und technischen Signalen. Keine Garantie."
  },
  "ETH-USD": {
    summary:
      "Ethereum zeigt schwaches kurzfristiges Momentum. Die langfristige Plattformthese bleibt intakt, braucht aber wieder bessere On-chain Aktivität.",
    upsideDrivers: [
      "Tokenisierung und Layer-2-Wachstum",
      "Staking-Ertrage",
      "Mogliche institutionelle Produktzuflusse"
    ],
    downsideDrivers: [
      "Schwache Netzwerkgebuhren",
      "Konkurrenz durch alternative Chains",
      "Hohe Beta-Sensitivität bei Kryptomarktstress"
    ],
    bullCase: "On-chain Nachfrage kehrt zuruck und ETH profitiert von Angebotsdynamik.",
    bearCase: "Aktivität bleibt schwach und Kapital rotiert in andere Assets.",
    neutralCase: "ETH folgt Bitcoin, ohne eigene relative Starke.",
    shortTerm: "Schwach.",
    mediumTerm: "Neutral, bis Aktivität und Momentum drehen.",
    longTerm: "Potenzialreich, aber mit hohem Ausfuhrungsrisiko.",
    riskLevel: "hoch",
    probabilities: { up: 30, down: 42, sideways: 28 },
    modelNote:
      "Modellbasierte Schatzung aus Mock-Kursen, Nachrichten, Fundamentaldaten und technischen Signalen. Keine Garantie."
  }
};

function makeScores(symbol: string): Scores {
  const seed = scoreSeeds[symbol];
  return {
    ...seed,
    total: calculateTotalScore(seed)
  };
}

function makeCandles(base: number, trend: number, volatility: number, points: number): Candle[] {
  return Array.from({ length: points }, (_, index) => {
    const drift = (index - points / 2) * trend;
    const wave = Math.sin(index * 0.63) * volatility;
    const pulse = Math.cos(index * 0.27) * volatility * 0.55;
    const close = Math.max(base * 0.12, base + drift + wave + pulse);
    const open = Math.max(base * 0.12, close - Math.sin(index * 0.47) * volatility * 0.8);
    const high = Math.max(open, close) + volatility * (0.75 + (index % 5) * 0.08);
    const low = Math.min(open, close) - volatility * (0.7 + (index % 4) * 0.07);

    return {
      time: index % 8 === 0 ? `${index}` : "",
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(800000 + Math.abs(Math.sin(index * 0.37)) * 4200000)
    };
  });
}

function candleRanges(symbol: string, price: number): Record<TimeRange, Candle[]> {
  const score = scoreSeeds[symbol].trend - 50;
  const baseTrend = price * (score / 10000);
  const vol = symbol.includes("USD") ? price * 0.018 : price * 0.012;

  return {
    "1D": makeCandles(price * 0.99, baseTrend * 0.3, vol * 0.35, 34),
    "1W": makeCandles(price * 0.97, baseTrend * 0.7, vol * 0.55, 42),
    "1M": makeCandles(price * 0.94, baseTrend, vol * 0.8, 58),
    "6M": makeCandles(price * 0.86, baseTrend * 1.8, vol * 1.3, 72),
    "1J": makeCandles(price * 0.78, baseTrend * 2.4, vol * 1.6, 86),
    "5J": makeCandles(price * 0.45, baseTrend * 4.2, vol * 2.2, 112)
  };
}

function indicators(symbol: string): TechnicalIndicators {
  const quote = quoteMap[symbol];
  const price = quote.price;
  const technical = scoreSeeds[symbol].technical;
  const bias = (technical - 50) / 100;

  return {
    rsi: Math.round(50 + bias * 38),
    macd: {
      value: Number((bias * price * 0.012).toFixed(2)),
      signal: Number((bias * price * 0.009).toFixed(2)),
      histogram: Number((bias * price * 0.003).toFixed(2))
    },
    movingAverages: {
      ma20: Number((price * (1 - bias * 0.012)).toFixed(2)),
      ma50: Number((price * (1 - bias * 0.021)).toFixed(2)),
      ma200: Number((price * (1 - bias * 0.044)).toFixed(2))
    },
    bollingerBands: {
      upper: Number((price * 1.045).toFixed(2)),
      middle: Number(price.toFixed(2)),
      lower: Number((price * 0.955).toFixed(2))
    },
    support: [Number((price * 0.96).toFixed(2)), Number((price * 0.91).toFixed(2))],
    resistance: [Number((price * 1.04).toFixed(2)), Number((price * 1.09).toFixed(2))]
  };
}

function riskLevel(symbol: string) {
  const risk = scoreSeeds[symbol].risk;
  if (risk >= 78) return "niedrig";
  if (risk >= 56) return "mittel";
  if (risk >= 30) return "hoch";
  return "extrem";
}

function makeSummary(asset: Asset): AssetSummary {
  return {
    asset,
    quote: quoteMap[asset.symbol],
    scores: makeScores(asset.symbol),
    aiRisk: riskLevel(asset.symbol)
  };
}

export const assetSummaries = assets.map(makeSummary);

function makeMacroFactors(symbol: string): MacroFactor[] {
  const crypto = symbol.includes("USD");
  return [
    {
      label: crypto ? "US-Dollar Liquiditaet" : "Zinsniveau",
      impact: crypto ? "neutral" : "negative",
      detail: crypto
        ? "Liquiditätsbedingungen bleiben ein zentraler Treiber für digitale Assets."
        : "Höhere Realzinsen können Bewertungsmultiples belasten.",
      source: "StockPilot Macro Mock"
    },
    {
      label: crypto ? "Regulatorik" : "US-Konsum / Enterprise IT",
      impact: symbol === "BTC-USD" ? "neutral" : "positive",
      detail: crypto
        ? "Regulatorische Schlagzeilen können kurzfristig hohe Volatilität erzeugen."
        : "Nachfrageindikatoren bleiben im Mock-Szenario grundsaetzlich stabil.",
      source: "StockPilot Macro Mock"
    }
  ];
}

function makeAnalysisLayers(detail: AssetDetailCore & { professionalScores: ProfessionalScores }): AnalysisLayer[] {
  const marketTrend = detail.quote.changePercent >= 1 ? "positive" : detail.quote.changePercent <= -1 ? "negative" : "neutral";
  const sectorWeak = detail.asset.symbol === "AAPL" || detail.asset.symbol === "ETH-USD";
  const sentiment = detail.news[0]?.sentiment ?? "neutral";
  const volatility =
    detail.professionalScores?.volatilityRisk && detail.professionalScores.volatilityRisk > 65
      ? "risk"
      : "neutral";

  return [
    {
      label: "Markttrend",
      value: marketTrend === "positive" ? "freundlich" : marketTrend === "negative" ? "belastet" : "neutral",
      status: marketTrend,
      detail: "Abgeleitet aus Tagesbewegung, Index-Mockdaten und Watchlist-Momentum.",
      source: "StockPilot Mock Market Feed",
      updatedAt: detail.quote.asOf
    },
    {
      label: "Sektortrend",
      value: sectorWeak ? "schwach" : "stabil",
      status: sectorWeak ? "negative" : "positive",
      detail: `${detail.asset.sector} wird im Mock-Szenario ${sectorWeak ? "als risikobehaftet" : "als relativ stabil"} eingestuft.`,
      source: "StockPilot Sector Mock",
      updatedAt: detail.quote.asOf
    },
    {
      label: "Sentiment",
      value: sentiment === "positive" ? "positiv" : sentiment === "negative" ? "negativ" : "neutral",
      status: sentiment,
      detail: "Nach Relevanz gewichtete News-Stimmung.",
      source: "StockPilot Mock News Feed",
      updatedAt: detail.news[0]?.publishedAt ?? detail.quote.asOf
    },
    {
      label: "Volatilitaet",
      value: volatility === "risk" ? "erhoeht" : "normal",
      status: volatility,
      detail: "Bewertet aus 1M-Kerzenbewegung und Tagesausschlag.",
      source: "Derived Technical Engine",
      updatedAt: detail.quote.asOf
    }
  ];
}

function enrichAnalysis(symbol: string, base: AiAnalysisBase, dataQualityScore: number): AiAnalysis {
  const weak = dataQualityScore < 70;

  return {
    ...base,
    counterArguments: [
      "Das Modell kann Kausalitaet aus Nachrichten und Kursbewegungen nicht beweisen.",
      "Mock-Daten können echte Marktbreite, Orderbuch und Intraday-Liquidität nicht ersetzen.",
      "Makro- und Sektorannahmen können sich schnell ändern."
    ],
    dataGaps: [
      "Echte Realtime-Kurse fehlen noch.",
      "Institutionelle Flows und vollstaendige Insiderdaten sind nur als Adapter vorbereitet.",
      "Makro-Faktoren sind aktuell Mock-Signale."
    ],
    uncertainty: weak ? "hoch" : symbol.includes("USD") ? "hoch" : "mittel",
    sources: [
      "StockPilot Mock Market Feed",
      "StockPilot Mock News Feed",
      "Derived Technical Engine",
      "StockPilot Macro Mock"
    ],
    weakDataWarning: weak
      ? "Warnung: Die Datenlage ist schwach. Die KI-Auswertung sollte nicht als belastbar genutzt werden."
      : null
  };
}

export function getMockAsset(symbol: string): AssetDetail | null {
  const normalized = decodeURIComponent(symbol).toUpperCase();
  const asset = assets.find((item) => item.symbol.toUpperCase() === normalized);
  if (!asset) return null;

  const relatedNews = newsItems
    .filter((item) => item.symbol === asset.symbol)
    .sort((a, b) => b.relevance - a.relevance);

  const core: AssetDetailCore = {
    ...makeSummary(asset),
    candles: candleRanges(asset.symbol, quoteMap[asset.symbol].price),
    indicators: indicators(asset.symbol),
    fundamentals: fundamentalsMap[asset.symbol],
    news: relatedNews.length ? relatedNews : newsItems.slice(0, 2),
    aiAnalysis: analysisMap[asset.symbol],
    analystOpinion: asset.type === "crypto"
      ? null
      : {
          consensus: asset.symbol === "AAPL" ? "Neutral" : "Constructive",
          count: asset.symbol === "VOO" ? 8 : 34,
          targetLow: Number((quoteMap[asset.symbol].price * 0.88).toFixed(2)),
          targetMedian: Number((quoteMap[asset.symbol].price * 1.12).toFixed(2)),
          targetHigh: Number((quoteMap[asset.symbol].price * 1.32).toFixed(2))
        },
    insiderActivity:
      asset.type === "stock"
        ? [
            {
              date: "2026-06-18",
              person: "Executive Officer",
              action: asset.symbol === "AAPL" ? "Sell" : "Buy",
              value: asset.symbol === "AAPL" ? 1800000 : 950000
            }
          ]
        : [],
    earningsDate: asset.type === "stock" ? "2026-07-29" : null
  };
  const professionalScores = calculateProfessionalScores({
    baseScores: core.scores,
    quote: core.quote,
    candles: core.candles["1M"],
    indicators: core.indicators,
    fundamentals: core.fundamentals,
    news: core.news,
    earningsDate: core.earningsDate
  });
  const dataQuality = assessDataQuality(core);
  const enrichedCore = {
    ...core,
    professionalScores,
    dataQuality,
    analysisLayers: makeAnalysisLayers({
      ...core,
      professionalScores
    }),
    macroFactors: makeMacroFactors(asset.symbol)
  };
  const riskReport = buildRiskReport(enrichedCore, dataQuality);

  return {
    ...enrichedCore,
    riskReport,
    aiAnalysis: enrichAnalysis(asset.symbol, core.aiAnalysis, dataQuality.score)
  };
}

export function getMockDashboard(): DashboardData {
  const detailed = assetSummaries
    .map((summary) => getMockAsset(summary.asset.symbol))
    .filter((item): item is AssetDetail => Boolean(item));
  const staleSources = detailed.reduce(
    (sum, item) => sum + item.dataQuality.sources.filter((source) => source.status === "stale").length,
    0
  );
  const mockSources = detailed.reduce(
    (sum, item) => sum + item.dataQuality.sources.filter((source) => source.type === "mock").length,
    0
  );

  return {
    watchlist: detailed.slice(0, 5),
    gainers: [detailed[0], detailed[4], detailed[2]],
    losers: [detailed[5], detailed[1]],
    marketOverview: [
      { label: "S&P 500", value: "6.118", changePercent: 0.43, status: "open" },
      { label: "Nasdaq 100", value: "22.340", changePercent: 0.82, status: "open" },
      { label: "DAX", value: "18.924", changePercent: -0.18, status: "closed" },
      { label: "Krypto", value: "Risk-on", changePercent: 1.14, status: "volatile" }
    ],
    trends: [
      "KI-Infrastruktur",
      "ETF-Zuflüsse",
      "Cloud-Security",
      "Mega-Cap Rotation",
      "Volatilität bei Krypto"
    ],
    dataQualitySummary: {
      label: "Mock-validiert",
      score: Math.round(detailed.reduce((sum, item) => sum + item.dataQuality.score, 0) / detailed.length),
      staleSources,
      mockSources
    },
    aiSentiment: {
      label: "Vorsichtig positiv",
      score: 66,
      summary:
        "Momentum und News sind freundlich, aber Bewertungen und Krypto-Volatilität erhöhen das Rückschlagrisiko."
    },
    riskWarnings: [
      {
        id: "r1",
        symbol: "NVDA",
        title: "Bewertung nah am oberen Modellband",
        severity: "hoch",
        detail: "Starke operative Daten, aber geringe Fehlertoleranz bei Wachstumsenttauschungen."
      },
      {
        id: "r2",
        symbol: "ETH-USD",
        title: "Technisches Momentum schwach",
        severity: "hoch",
        detail: "RSI und MACD liegen unter neutralen Schwellen, Nachrichtenlage ist leicht negativ."
      }
    ],
    latestNews: [...newsItems].sort((a, b) => b.relevance - a.relevance).slice(0, 4)
  };
}

export function getMockNews(symbol?: string): NewsItem[] {
  const filtered = symbol
    ? newsItems.filter((item) => item.symbol.toUpperCase() === symbol.toUpperCase())
    : newsItems;

  return [...filtered].sort((a, b) => b.relevance - a.relevance);
}

export function getMockPortfolio(): PortfolioSummary {
  const positions = [
    {
      id: "p1",
      symbol: "NVDA",
      name: "NVIDIA Corp.",
      assetType: "stock" as const,
      sector: "Halbleiter / KI",
      quantity: 12,
      averagePrice: 118.5,
      currentPrice: quoteMap.NVDA.price,
      currency: "USD",
      riskScore: 72
    },
    {
      id: "p2",
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      assetType: "etf" as const,
      sector: "US Large Cap ETF",
      quantity: 18,
      averagePrice: 508.4,
      currentPrice: quoteMap.VOO.price,
      currency: "USD",
      riskScore: 28
    },
    {
      id: "p3",
      symbol: "BTC-USD",
      name: "Bitcoin",
      assetType: "crypto" as const,
      sector: "Digital Asset",
      quantity: 0.18,
      averagePrice: 61200,
      currentPrice: quoteMap["BTC-USD"].price,
      currency: "USD",
      riskScore: 84
    }
  ];

  return analyzePortfolio(positions);
}

export const mockAlerts: AlertRule[] = [
  {
    id: "a1",
    symbol: "NVDA",
    type: "price",
    label: "Kursalarm",
    condition: "uber 155,00 USD",
    enabled: true
  },
  {
    id: "a2",
    symbol: "BTC-USD",
    type: "volume",
    label: "Starker Volumenanstieg",
    condition: "24h-Volumen +35%",
    enabled: true
  },
  {
    id: "a3",
    symbol: "ETH-USD",
    type: "ai-risk",
    label: "KI-Risikoalarm",
    condition: "Risiko-Level hoch oder extrem",
    enabled: true
  },
  {
    id: "a4",
    symbol: "MSFT",
    type: "earnings",
    label: "Earnings Reminder",
    condition: "3 Tage vor Termin",
    enabled: false
  },
  {
    id: "a5",
    symbol: "NVDA",
    type: "ai-shift",
    label: "KI-Einschätzung verändert",
    condition: "Chancen-Score +/- 12 Punkte",
    enabled: true
  },
  {
    id: "a6",
    symbol: "PORTFOLIO",
    type: "portfolio-risk",
    label: "Portfolio-Risikoalarm",
    condition: "Gesamtrisiko ueber 70/100",
    enabled: true
  }
];
