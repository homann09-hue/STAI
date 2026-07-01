import { getMockAsset, getMockDashboard, getMockPortfolio } from "@/lib/mock/market";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import { calculateVolatility } from "@/lib/scoring";
import type {
  AssetDetail,
  CryptoProfessionalProfile,
  DataQualityReport,
  ETFProfessionalProfile,
  EquityFundamentalsProfile,
  MarketDataQuality,
  NormalizedQuote,
  PerformanceRange,
  PortfolioScenario,
  ProfessionalAvailability,
  ProfessionalComparison,
  ProfessionalDataPoint,
  ProfessionalHolding,
  ProfessionalMarketReport,
  ProfessionalNewsEvent,
  ProfessionalPortfolioAnalytics,
  ProfessionalScreenerRow,
  ProfessionalWeight
} from "@/lib/types";

export interface ETFProvider {
  getETFProfile(symbol: string): Promise<ETFProfessionalProfile | null>;
}

export interface CryptoProvider {
  getCryptoProfile(symbol: string, quote: NormalizedQuote): Promise<CryptoProfessionalProfile | null>;
}

export interface PortfolioAnalyticsProvider {
  getProfessionalPortfolio(): Promise<ProfessionalPortfolioAnalytics>;
}

export interface ProfessionalDataProvider extends ETFProvider, CryptoProvider, PortfolioAnalyticsProvider {
  getMarketReport(): Promise<ProfessionalMarketReport>;
}

const mockProvider = "StockPilot Professional Mock Dataset";
const preparedProvider = "StockPilot Provider Contract Prepared";
const now = () => new Date().toISOString();

function point(input: {
  label: string;
  value: string | number | null;
  provider?: string;
  quality?: MarketDataQuality;
  updatedAt?: string;
  availability?: ProfessionalAvailability;
  note?: string;
  unit?: string;
}): ProfessionalDataPoint {
  return {
    label: input.label,
    value: input.value,
    unit: input.unit,
    provider: input.provider ?? mockProvider,
    quality: input.quality ?? "mock",
    updatedAt: input.updatedAt ?? now(),
    availability: input.availability ?? "mock",
    note: input.note ?? "Mock oder vorbereitet. Nicht als echte Anbieterangabe interpretieren."
  };
}

function unavailable(label: string, note = "Aktueller Provider liefert dieses Feld nicht.") {
  return point({
    label,
    value: null,
    provider: preparedProvider,
    quality: "unavailable",
    availability: "provider_missing",
    note
  });
}

function prepared(label: string, note = "Datenmodell vorbereitet, Anbieter/Lizenz noch nicht verbunden.") {
  return point({
    label,
    value: null,
    provider: preparedProvider,
    quality: "unavailable",
    availability: "prepared",
    note
  });
}

function weight(label: string, value: number, provider = mockProvider): ProfessionalWeight {
  return {
    label,
    weight: value,
    provider,
    quality: "mock"
  };
}

function holding(symbol: string, name: string, weightValue: number, sector: string, country: string): ProfessionalHolding {
  return {
    symbol,
    name,
    weight: weightValue,
    sector,
    country,
    provider: mockProvider,
    quality: "mock"
  };
}

function normalizedFromDetail(detail: AssetDetail): NormalizedQuote {
  return {
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    assetType: detail.asset.type,
    price: detail.quote.price,
    currency: detail.asset.currency,
    change: detail.quote.change,
    changePercent: detail.quote.changePercent,
    bid: detail.quote.bid,
    ask: detail.quote.ask,
    spread: detail.quote.spread,
    volume: detail.quote.volume,
    high: detail.quote.dayHigh,
    low: detail.quote.dayLow,
    open: detail.quote.open,
    previousClose: detail.quote.previousClose,
    fiftyTwoWeekHigh: detail.quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: detail.quote.fiftyTwoWeekLow,
    timestamp: detail.quote.asOf,
    provider: detail.quote.provider,
    quality: detail.quote.quality,
    latencyMs: detail.quote.latencyMs,
    marketStatus: detail.quote.marketStatus
  };
}

function getPointQuality(quote: NormalizedQuote, label: string, value: string | number | null) {
  return point({
    label,
    value,
    provider: quote.provider,
    quality: quote.quality,
    updatedAt: quote.timestamp,
    availability: value === null ? "provider_missing" : "available",
    note: value === null ? "Aktueller Kursprovider liefert dieses Feld nicht." : "Normalisierte Anbieterangabe."
  });
}

function marketCore(detail: AssetDetail, quote: NormalizedQuote): ProfessionalDataPoint[] {
  return [
    getPointQuality(quote, "Aktueller Kurs", quote.price),
    getPointQuality(quote, "Bid", quote.bid ?? null),
    getPointQuality(quote, "Ask", quote.ask ?? null),
    getPointQuality(quote, "Spread", quote.spread ?? null),
    getPointQuality(quote, "Handelsvolumen", quote.volume ?? null),
    getPointQuality(quote, "Tageshoch", quote.high ?? null),
    getPointQuality(quote, "Tagestief", quote.low ?? null),
    getPointQuality(quote, "Open", quote.open ?? null),
    getPointQuality(quote, "Previous Close", quote.previousClose ?? null),
    getPointQuality(quote, "52-Wochen-Hoch", quote.fiftyTwoWeekHigh ?? null),
    getPointQuality(quote, "52-Wochen-Tief", quote.fiftyTwoWeekLow ?? null),
    point({
      label: "Marktkapitalisierung",
      value: detail.fundamentals.marketCap,
      provider: mockProvider,
      quality: "mock",
      availability: "mock",
      note: "Aus Mock-Fundamentals, nicht vom Live-Kursprovider."
    }),
    unavailable("Free Float"),
    point({ label: "Handelsplatz", value: detail.asset.exchange, provider: quote.provider, quality: quote.quality, updatedAt: quote.timestamp, availability: "available", note: "Asset-Stammdaten." }),
    point({ label: "Währung", value: quote.currency, provider: quote.provider, quality: quote.quality, updatedAt: quote.timestamp, availability: "available", note: "Normalisierte Anbieterangabe." }),
    point({ label: "Marktstatus", value: quote.marketStatus, provider: quote.provider, quality: quote.quality, updatedAt: quote.timestamp, availability: "available", note: "Provider- oder Assetklassenstatus." }),
    point({ label: "Letzte Aktualisierung", value: quote.timestamp, provider: quote.provider, quality: quote.quality, updatedAt: quote.timestamp, availability: "available", note: "Timestamp des normalisierten Quotes." }),
    point({ label: "Datenquelle", value: quote.provider, provider: quote.provider, quality: quote.quality, updatedAt: quote.timestamp, availability: "available", note: "Serverseitig normalisiert, kein API-Key im Frontend." }),
    point({ label: "Datenqualität", value: quote.quality, provider: quote.provider, quality: quote.quality, updatedAt: quote.timestamp, availability: "available", note: "Realtime, near-realtime, delayed, mock oder unavailable." }),
    quote.marketStatus === "pre_market" || quote.marketStatus === "after_hours"
      ? getPointQuality(quote, "Pre-/After-Hours", quote.marketStatus)
      : unavailable("Pre-/After-Hours", "Aktueller Provider liefert keine separate Pre-/After-Hours-Angabe.")
  ];
}

function equityFundamentals(detail: AssetDetail): EquityFundamentalsProfile {
  const f = detail.fundamentals;
  const q = detail.quote.asOf;
  const fp = (label: string, value: string | number | null, note?: string) =>
    point({ label, value, updatedAt: q, note: note ?? "Mock-Fundamentals. Nach Anbieteranbindung an Finnhub, EODHD, FactSet-ähnliche Quellen oder andere Anbieter anbinden." });

  return {
    symbol: detail.asset.symbol,
    companyName: detail.asset.name,
    exchange: detail.asset.exchange,
    currency: detail.asset.currency,
    updatedAt: q,
    provider: mockProvider,
    quality: "mock",
    revenue: fp("Umsatz", Math.round(f.marketCap * 0.18)),
    netIncome: fp("Gewinn", Math.round(f.marketCap * 0.035)),
    eps: fp("EPS", f.peRatio ? Number((detail.quote.price / f.peRatio).toFixed(2)) : null),
    peRatio: fp("KGV / P/E", f.peRatio),
    forwardPe: fp("Forward P/E", f.peRatio ? Number((f.peRatio * 0.86).toFixed(2)) : null),
    pegRatio: fp("PEG Ratio", f.earningsGrowth ? Number((Number(f.peRatio ?? 0) / Math.max(1, f.earningsGrowth)).toFixed(2)) : null),
    priceToSales: fp("KUV / P/S", Number((f.marketCap / Math.max(1, f.marketCap * 0.18)).toFixed(2))),
    priceToBook: fp("KBV / P/B", Number((2.2 + f.debtToEquity).toFixed(2))),
    ebitda: fp("EBITDA", Math.round(f.cashflow * 1.18)),
    ebitMargin: fp("EBIT-Marge", Number((18 + f.revenueGrowth * 0.18).toFixed(2)), "%"),
    netMargin: fp("Nettomarge", Number((12 + f.earningsGrowth * 0.12).toFixed(2)), "%"),
    grossMargin: fp("Bruttomarge", Number((42 + f.revenueGrowth * 0.08).toFixed(2)), "%"),
    revenueGrowth: fp("Umsatzwachstum", f.revenueGrowth, "%"),
    earningsGrowth: fp("Gewinnwachstum", f.earningsGrowth, "%"),
    debtToEquity: fp("Verschuldung", f.debtToEquity),
    operatingCashflow: fp("Cashflow", f.cashflow),
    freeCashflow: fp("Free Cashflow", Math.round(f.cashflow * 0.72)),
    dividendYield: fp("Dividendenrendite", f.dividendYield, "%"),
    payoutRatio: fp("Ausschüttungsquote", f.dividendYield ? Number((28 + f.dividendYield * 4).toFixed(2)) : null, "%"),
    buybacks: prepared("Aktienrückkäufe"),
    analystConsensus: fp("Analysten-Konsens", detail.analystOpinion?.consensus ?? null),
    priceTargetLow: fp("Kursziel niedrig", detail.analystOpinion?.targetLow ?? null),
    priceTargetMedian: fp("Kursziel Median", detail.analystOpinion?.targetMedian ?? null),
    priceTargetHigh: fp("Kursziel hoch", detail.analystOpinion?.targetHigh ?? null),
    earningsDate: fp("Earnings-Termin", detail.earningsDate ?? null),
    guidance: prepared("Guidance"),
    insiderTransactions: prepared("Insider-Transaktionen"),
    institutionalHolders: prepared("Institutionelle Halter")
  };
}

function etfProfile(detail: AssetDetail): ETFProfessionalProfile {
  const updatedAt = detail.quote.asOf;
  const perf = (label: PerformanceRange, value: number | null) => point({ label, value, updatedAt, unit: "%" });

  return {
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    isin: point({ label: "ISIN", value: "US9229083632", updatedAt }),
    wkn: point({ label: "WKN", value: "A1JX53", updatedAt }),
    ticker: detail.asset.symbol,
    issuer: point({ label: "Anbieter", value: "Vanguard", updatedAt }),
    indexName: point({ label: "Index", value: "S&P 500", updatedAt }),
    replicationMethod: point({ label: "Replikationsmethode", value: "Physisch", updatedAt }),
    ter: point({ label: "TER / laufende Kosten", value: 0.03, unit: "%", updatedAt }),
    aum: point({ label: "Fondsvolumen / AUM", value: 1250000000000, updatedAt }),
    distributionPolicy: point({ label: "Ertragsverwendung", value: "Ausschüttend", updatedAt }),
    dividendYield: point({ label: "Dividendenrendite", value: detail.fundamentals.dividendYield, unit: "%", updatedAt }),
    distributionInterval: point({ label: "Ausschüttungsintervall", value: "Quartalsweise", updatedAt }),
    trackingDifference: point({ label: "Tracking Difference", value: -0.04, unit: "%", updatedAt }),
    trackingError: point({ label: "Tracking Error", value: 0.06, unit: "%", updatedAt }),
    esgScore: prepared("ESG-Daten"),
    riskClass: point({ label: "Risiko-Klasse", value: "4/7", updatedAt }),
    volatility: point({ label: "Volatilität", value: calculateVolatility(detail.candles["1Y"]), unit: "%", updatedAt }),
    sharpeRatio: point({ label: "Sharpe Ratio", value: 0.78, updatedAt }),
    maxDrawdown: point({ label: "Max Drawdown", value: -23.4, unit: "%", updatedAt }),
    benchmark: "S&P 500",
    performance: {
      "1M": perf("1M", 1.8),
      "3M": perf("3M", 4.9),
      "6M": perf("6M", 8.4),
      YTD: perf("YTD", 12.1),
      "1Y": perf("1Y", 18.7),
      "3Y": perf("3Y", 37.9),
      "5Y": perf("5Y", 86.2),
      "10Y": perf("10Y", 212.5),
      MAX: perf("MAX", 512.4)
    },
    topHoldings: [
      holding("MSFT", "Microsoft", 7.1, "Software", "USA"),
      holding("NVDA", "NVIDIA", 6.8, "Semiconductors", "USA"),
      holding("AAPL", "Apple", 6.2, "Consumer Tech", "USA"),
      holding("AMZN", "Amazon", 3.9, "Consumer", "USA"),
      holding("META", "Meta Platforms", 2.8, "Communication", "USA"),
      holding("GOOGL", "Alphabet", 2.4, "Communication", "USA"),
      holding("AVGO", "Broadcom", 2.2, "Semiconductors", "USA"),
      holding("BRK.B", "Berkshire Hathaway", 1.8, "Financials", "USA"),
      holding("JPM", "JPMorgan Chase", 1.4, "Financials", "USA"),
      holding("LLY", "Eli Lilly", 1.3, "Health Care", "USA")
    ],
    sectorWeights: [weight("Information Technology", 31.4), weight("Financials", 13.1), weight("Health Care", 11.2), weight("Consumer Discretionary", 10.3), weight("Communication Services", 8.9)],
    countryWeights: [weight("USA", 99.2), weight("Other", 0.8)],
    currencyWeights: [weight("USD", 100)],
    marketCapWeights: [weight("Large Cap", 86.5), weight("Mega Cap", 12.1), weight("Mid Cap", 1.4)],
    provider: mockProvider,
    quality: "mock",
    updatedAt
  };
}

function cryptoProfile(detail: AssetDetail, quote: NormalizedQuote): CryptoProfessionalProfile {
  const updatedAt = quote.timestamp;
  const volatility = calculateVolatility(detail.candles["1M"]);
  const cp = (label: string, value: string | number | null, quality: MarketDataQuality = quote.quality, provider = quote.provider, note = "Normalisierte Krypto-Providerangabe oder vorbereitete Datenstruktur.") =>
    point({ label, value, quality, provider, updatedAt, availability: value === null ? "provider_missing" : "available", note });

  return {
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    provider: quote.provider,
    quality: quote.quality,
    updatedAt,
    price: cp("Preis live", quote.price),
    volume24h: cp("24h Volumen", quote.volume ?? null),
    marketCap: point({ label: "Market Cap", value: detail.fundamentals.marketCap, provider: mockProvider, quality: "mock", updatedAt: detail.quote.asOf, availability: "mock", note: "Mock-Market-Cap, bis CoinMarketCap/CoinGecko/Kaiko/aehnliche Quelle angebunden ist." }),
    circulatingSupply: point({ label: "Circulating Supply", value: detail.asset.symbol === "BTC-USD" ? 19700000 : 120000000, provider: mockProvider, quality: "mock", updatedAt: detail.quote.asOf, availability: "mock", note: "Mock-Supply, nicht als echte On-Chain-Angabe nutzen." }),
    maxSupply: point({ label: "Max Supply", value: detail.asset.symbol === "BTC-USD" ? 21000000 : null, provider: mockProvider, quality: "mock", updatedAt: detail.quote.asOf, availability: detail.asset.symbol === "BTC-USD" ? "mock" : "provider_missing", note: "BTC begrenzt, ETH ohne feste Max Supply." }),
    fullyDilutedValuation: point({ label: "Fully Diluted Valuation", value: detail.asset.symbol === "BTC-USD" ? quote.price * 21000000 : null, provider: mockProvider, quality: "mock", updatedAt: detail.quote.asOf, availability: "mock", note: "Aus Mock-/Quote-Daten abgeleitet." }),
    dominance: prepared("Dominanz"),
    fundingRates: prepared("Funding Rates"),
    openInterest: prepared("Open Interest"),
    onChainData: prepared("On-Chain-Daten"),
    exchangeData: cp("Exchange-Daten", quote.spread !== undefined ? `Bid/Ask Spread ${quote.spread}` : null),
    volatility: cp("Volatilität", volatility, "mock", mockProvider, "Aus Mock-Kerzen abgeleitet, bis echte historische Krypto-Candles angebunden sind."),
    trend: cp("Trend", detail.professionalScores.momentum >= 60 ? "positiv" : detail.professionalScores.momentum <= 40 ? "negativ" : "neutral", "mock", mockProvider),
    events: prepared("News/Events")
  };
}

function rowFromDetail(detail: AssetDetail, quote: NormalizedQuote): ProfessionalScreenerRow {
  const row: ProfessionalScreenerRow = {
    asset: detail.asset,
    quote,
    marketCore: marketCore(detail, quote),
    scores: detail.scores,
    aiRisk: detail.aiRisk,
    dataQuality: detail.dataQuality as DataQualityReport | null
  };

  if (detail.asset.type === "stock") row.equityFundamentals = equityFundamentals(detail);
  if (detail.asset.type === "etf") row.etfProfile = etfProfile(detail);
  if (detail.asset.type === "crypto") row.cryptoProfile = cryptoProfile(detail, quote);

  return row;
}

function qualitySummary(rows: ProfessionalScreenerRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.quote.quality === "realtime") summary.realtime += 1;
      if (row.quote.quality === "near_realtime") summary.nearRealtime += 1;
      if (row.quote.quality === "delayed" || row.quote.quality === "historical") summary.delayed += 1;
      if (row.quote.quality === "mock") summary.mock += 1;
      if (row.quote.quality === "unavailable") summary.unavailable += 1;
      return summary;
    },
    { realtime: 0, nearRealtime: 0, delayed: 0, mock: 0, unavailable: 0 }
  );
}

function portfolioAnalytics(scenarios: PortfolioScenario[]): ProfessionalPortfolioAnalytics {
  const portfolio = getMockPortfolio();
  const updatedAt = now();
  const pp = (label: string, value: string | number | null, note?: string) =>
    point({ label, value, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: note ?? "Portfolio-Demo-Daten, nach Anbieteranbindung mit Supabase-Nutzerportfolio verbinden." });

  return {
    totalValue: pp("Gesamtwert", portfolio.totalValue),
    dayPnL: pp("Tagesgewinn/-verlust", Number((portfolio.totalValue * 0.006).toFixed(2))),
    totalPnL: pp("Gesamtgewinn/-verlust", portfolio.totalPnL),
    performanceSincePurchase: pp("Performance seit Kauf", portfolio.totalPnLPercent, "%"),
    costBasis: pp("Einstandswert", portfolio.totalCost),
    assetAllocation: portfolio.assetAllocation.map((item) => weight(item.label, item.weight)),
    countryAllocation: [weight("USA", 72), weight("Global", 18), weight("Krypto global", 10)],
    sectorAllocation: portfolio.sectorAllocation.map((item) => weight(item.label, item.weight)),
    currencyRisk: pp("Währungsrisiko", "USD-lastig"),
    dividendForecast: pp("Dividendenprognose", Math.round(portfolio.totalValue * 0.012)),
    riskScore: pp("Risiko-Score", portfolio.totalRisk),
    volatility: pp("Volatilität", 18.4, "%"),
    drawdown: pp("Drawdown", -14.8, "%"),
    correlations: prepared("Korrelationen", "Matrix vorbereitet; echte Zeitreihenanbieter erforderlich."),
    concentrationRisk: pp("Klumpenrisiko", portfolio.maxPositionWeight, "%"),
    rebalancingSuggestions: [
      "Mega-Cap-Konzentration pruefen und Zielgewichte definieren.",
      "Krypto-Gewicht nur innerhalb eines festen Risikobudgets halten.",
      "ETF-Kernquote kann Drawdown und Einzelwertrisiko stabilisieren."
    ],
    scenarioAnalysis: scenarios,
    provider: mockProvider,
    quality: "mock",
    updatedAt
  };
}

function newsEvents(): ProfessionalNewsEvent[] {
  return getMockDashboard().latestNews.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.symbol.includes("USD") ? "macro" : "company",
    symbol: item.symbol,
    source: item.source,
    publishedAt: item.publishedAt,
    relevance: item.relevance,
    impact: item.sentiment === "positive" ? "positive" : item.sentiment === "negative" ? "negative" : "neutral",
    quality: "mock",
    checked: false,
    note: "Mock-News mit KI-Relevanzbewertung. Nicht ungeprüft als Fakt verwenden."
  }));
}

function comparisons(rows: ProfessionalScreenerRow[]): ProfessionalComparison[] {
  const bySymbol = new Map(rows.map((row) => [row.asset.symbol, row]));
  const make = (title: string, left: string, right: string, benchmark: string): ProfessionalComparison => ({
    title,
    left,
    right,
    benchmark,
    points: [
      point({ label: "Performance 1M", value: Number(((bySymbol.get(left)?.quote.changePercent ?? 0) - (bySymbol.get(right)?.quote.changePercent ?? 0)).toFixed(2)), provider: mockProvider, quality: "mock" }),
      point({ label: "Risiko", value: `${bySymbol.get(left)?.aiRisk ?? "n/a"} vs ${bySymbol.get(right)?.aiRisk ?? "n/a"}`, provider: mockProvider, quality: "mock" }),
      point({ label: "Benchmark", value: benchmark, provider: mockProvider, quality: "mock" })
    ]
  });

  return [
    make("Asset vs Benchmark", "NVDA", "VOO", "S&P 500"),
    make("ETF vs ETF", "VOO", "MSFT", "MSCI World vorbereitet"),
    make("Krypto vs Aktie", "BTC-USD", "NVDA", "Risk Asset Basket"),
    make("Portfolio vs Index", "VOO", "AAPL", "MSCI World/S&P 500/Nasdaq vorbereitet")
  ];
}

class StockPilotProfessionalDataProvider implements ProfessionalDataProvider {
  async getETFProfile(symbol: string) {
    const detail = getMockAsset(symbol);
    if (!detail || detail.asset.type !== "etf") return null;
    return etfProfile(detail);
  }

  async getCryptoProfile(symbol: string, quote: NormalizedQuote) {
    const detail = getMockAsset(symbol);
    if (!detail || detail.asset.type !== "crypto") return null;
    return cryptoProfile(detail, quote);
  }

  async getProfessionalPortfolio() {
    return portfolioAnalytics(getMockPortfolio().scenarios);
  }

  async getMarketReport(): Promise<ProfessionalMarketReport> {
    const dashboard = getMockDashboard();
    const details = dashboard.watchlist
      .map((item) => getMockAsset(item.asset.symbol))
      .filter((item): item is AssetDetail => Boolean(item));
    const provider = getMarketDataProvider();
    const liveQuotes = await provider.getQuotes(details.map((detail) => detail.asset.symbol));
    const quoteMap = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));
    const rows = details.map((detail) => rowFromDetail(detail, quoteMap.get(detail.asset.symbol) ?? normalizedFromDetail(detail)));
    const bySymbol = new Map(rows.map((row) => [row.asset.symbol, row]));
    const selectRows = (items: typeof dashboard.watchlist) => items.map((item) => bySymbol.get(item.asset.symbol)).filter((row): row is ProfessionalScreenerRow => Boolean(row));
    const updatedAt = now();

    return {
      updatedAt,
      providerStack: [...new Set(rows.map((row) => row.quote.provider))],
      qualitySummary: qualitySummary(rows),
      globalOverview: [
        point({ label: "S&P 500", value: dashboard.marketOverview[0]?.value ?? null, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: "Indexübersicht ist Mock, bis echter Indexprovider verbunden ist." }),
        point({ label: "Nasdaq 100", value: dashboard.marketOverview[1]?.value ?? null, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: "Indexübersicht ist Mock, bis echter Indexprovider verbunden ist." }),
        point({ label: "DAX", value: dashboard.marketOverview[2]?.value ?? null, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: "Indexübersicht ist Mock, bis echter Indexprovider verbunden ist." }),
        point({ label: "Krypto Markt", value: "Binance/Coinbase near-realtime für Bid/Ask vorbereitet", provider: rows.find((row) => row.asset.type === "crypto")?.quote.provider ?? mockProvider, quality: rows.find((row) => row.asset.type === "crypto")?.quote.quality ?? "mock", updatedAt, availability: "available", note: "Krypto-Quotes können near-realtime über Public APIs kommen." })
      ],
      equityScreener: rows.filter((row) => row.asset.type === "stock"),
      etfScreener: rows.filter((row) => row.asset.type === "etf"),
      cryptoScreener: rows.filter((row) => row.asset.type === "crypto"),
      watchlist: selectRows(dashboard.watchlist),
      topGainers: selectRows(dashboard.gainers),
      topLosers: selectRows(dashboard.losers),
      mostActive: selectRows(dashboard.mostActive),
      newsTerminal: newsEvents(),
      riskDashboard: [
        point({ label: "Datenqualitäts-Risiko", value: dashboard.dataQualitySummary.score, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: "Score aus gemischten Mock-/Providerdaten." }),
        point({ label: "Klumpenrisiko", value: getMockPortfolio().maxPositionWeight, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: "Portfolio-Demo-Daten." }),
        point({ label: "Krypto-Gewicht", value: getMockPortfolio().cryptoWeight, provider: mockProvider, quality: "mock", updatedAt, availability: "mock", note: "Portfolio-Demo-Daten." }),
        prepared("Korrelationsmatrix", "Echte historische Zeitreihen erforderlich."),
        prepared("Makro-Termine", "Fed/EZB/Kalenderprovider erforderlich.")
      ],
      portfolio: portfolioAnalytics(getMockPortfolio().scenarios),
      comparisons: comparisons(rows)
    };
  }
}

export function getProfessionalDataProvider(): ProfessionalDataProvider {
  return new StockPilotProfessionalDataProvider();
}
