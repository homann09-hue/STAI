import { buildNormalizedQuote } from "@/lib/canonical-quote";
import { getMarketDataProvider } from "@/lib/providers/market-provider";
import {
  getCoinGeckoGlobalReference,
  getCoinGeckoMetadata,
  type CoinGeckoCachedResult,
  type CoinGeckoMetadataLookup,
} from "@/lib/providers/coingecko-client";
import type { CryptoGlobalReference } from "@/lib/crypto/coingecko-normalization";
import type {
  AssetDetail,
  DashboardData,
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
  ProfessionalMarketReport,
  ProfessionalNewsEvent,
  ProfessionalPortfolioAnalytics,
  ProfessionalScreenerRow
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

const preparedProvider = "StockPilot Provider Contract Prepared";
const now = () => new Date().toISOString();
const MAX_PROFESSIONAL_SYMBOLS = Math.max(12, Math.min(80, Number(process.env.STOCKPILOT_PROFESSIONAL_SYMBOL_LIMIT) || 36));

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
    provider: input.provider ?? preparedProvider,
    quality: input.quality ?? "unavailable",
    updatedAt: input.updatedAt ?? now(),
    availability: input.availability ?? "provider_missing",
    note: input.note ?? "Keine verifizierte Providerangabe verfügbar."
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

function unavailableFundamentalPoint(label: string, detail: AssetDetail, note = "Für dieses Symbol liegen aktuell keine verifizierten Fundamentaldaten vom aktiven Anbieter vor.") {
  return point({
    label,
    value: null,
    provider: preparedProvider,
    quality: "unavailable",
    updatedAt: detail.quote.asOf,
    availability: "provider_missing",
    note
  });
}

function hasUsableFundamentals(detail: AssetDetail) {
  return detail.dataQuality.sufficientForAnalysis && Number.isFinite(detail.fundamentals.marketCap) && detail.fundamentals.marketCap > 0;
}

function normalizedFromDetail(detail: AssetDetail): NormalizedQuote {
  return buildNormalizedQuote({
    instrumentId: null,
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    assetType: detail.asset.type,
    providerId: detail.quote.quality === "mock" ? "mock" : "unavailable",
    providerSymbol: detail.asset.symbol,
    venue: detail.asset.exchange,
    last: detail.quote.price,
    currency: detail.asset.currency,
    change: detail.quote.change,
    changePercent: detail.quote.changePercent,
    bid: detail.quote.bid,
    ask: detail.quote.ask,
    volume: detail.quote.volume,
    high: detail.quote.dayHigh,
    low: detail.quote.dayLow,
    open: detail.quote.open,
    previousClose: detail.quote.previousClose,
    fiftyTwoWeekHigh: detail.quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: detail.quote.fiftyTwoWeekLow,
    eventTimestamp: detail.quote.asOf,
    providerTimestamp: detail.quote.asOf,
    provider: detail.quote.provider,
    quality: detail.quote.quality,
    latencyMs: detail.quote.latencyMs,
    marketStatus: detail.quote.marketStatus
  });
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
    getPointQuality(quote, "Marktkapitalisierung", quote.marketCap ?? null),
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
  const dataIsUsable = hasUsableFundamentals(detail);

  if (!dataIsUsable) {
    const fp = (label: string, note?: string) => unavailableFundamentalPoint(label, detail, note);

    return {
      symbol: detail.asset.symbol,
      companyName: detail.asset.name,
      exchange: detail.asset.exchange,
      currency: detail.asset.currency,
      updatedAt: q,
      provider: preparedProvider,
      quality: "unavailable",
      revenue: fp("Umsatz"),
      netIncome: fp("Gewinn"),
      eps: fp("EPS"),
      peRatio: fp("KGV / P/E"),
      forwardPe: fp("Forward P/E"),
      pegRatio: fp("PEG Ratio"),
      priceToSales: fp("KUV / P/S"),
      priceToBook: fp("KBV / P/B"),
      ebitda: fp("EBITDA"),
      ebitMargin: fp("EBIT-Marge"),
      netMargin: fp("Nettomarge"),
      grossMargin: fp("Bruttomarge"),
      revenueGrowth: fp("Umsatzwachstum"),
      earningsGrowth: fp("Gewinnwachstum"),
      debtToEquity: fp("Verschuldung"),
      operatingCashflow: fp("Cashflow"),
      freeCashflow: fp("Free Cashflow"),
      dividendYield: fp("Dividendenrendite"),
      payoutRatio: fp("Ausschüttungsquote"),
      buybacks: prepared("Aktienrückkäufe"),
      analystConsensus: fp("Analysten-Konsens", "Analysten-Konsens wird nur angezeigt, wenn eine lizenzierte Quelle ihn liefert."),
      priceTargetLow: fp("Kursziel niedrig", "Kursziele werden nicht geschätzt."),
      priceTargetMedian: fp("Kursziel Median", "Kursziele werden nicht geschätzt."),
      priceTargetHigh: fp("Kursziel hoch", "Kursziele werden nicht geschätzt."),
      earningsDate: fp("Earnings-Termin"),
      guidance: prepared("Guidance"),
      insiderTransactions: prepared("Insider-Transaktionen"),
      institutionalHolders: prepared("Institutionelle Halter")
    };
  }

  const evidence = detail.fundamentalsEvidence;
  const verified = (field: keyof typeof f, label: string, unit?: string) =>
    evidence?.fields[field] === "provider"
      ? point({
          label,
          value: f[field],
          unit,
          provider: evidence.provider,
          quality: evidence.quality,
          updatedAt: evidence.fetchedAt,
          availability: "available",
          note: "Direkt geliefertes und verifiziertes Providerfeld; keine Ersatzschätzung."
        })
      : unavailableFundamentalPoint(label, detail);
  const missing = (label: string, note?: string) => unavailableFundamentalPoint(label, detail, note);

  return {
    symbol: detail.asset.symbol,
    companyName: detail.asset.name,
    exchange: detail.asset.exchange,
    currency: detail.asset.currency,
    updatedAt: q,
    provider: evidence?.provider ?? preparedProvider,
    quality: evidence?.quality ?? "unavailable",
    revenue: missing("Umsatz"),
    netIncome: missing("Gewinn"),
    eps: missing("EPS"),
    peRatio: verified("peRatio", "KGV / P/E"),
    forwardPe: missing("Forward P/E", "Forward P/E wird nicht aus dem historischen KGV geschätzt."),
    pegRatio: missing("PEG Ratio", "PEG wird nur aus explizit zeitlich konsistenten Providerfeldern berechnet."),
    priceToSales: missing("KUV / P/S"),
    priceToBook: missing("KBV / P/B"),
    ebitda: missing("EBITDA"),
    ebitMargin: missing("EBIT-Marge"),
    netMargin: missing("Nettomarge"),
    grossMargin: missing("Bruttomarge"),
    revenueGrowth: verified("revenueGrowth", "Umsatzwachstum", "%"),
    earningsGrowth: verified("earningsGrowth", "Gewinnwachstum", "%"),
    debtToEquity: verified("debtToEquity", "Verschuldung"),
    operatingCashflow: verified("cashflow", "Cashflow"),
    freeCashflow: missing("Free Cashflow", "Free Cashflow wird nicht als fester Anteil des operativen Cashflows geschätzt."),
    dividendYield: verified("dividendYield", "Dividendenrendite", "%"),
    payoutRatio: missing("Ausschüttungsquote"),
    buybacks: prepared("Aktienrückkäufe"),
    analystConsensus: missing("Analysten-Konsens"),
    priceTargetLow: missing("Kursziel niedrig"),
    priceTargetMedian: missing("Kursziel Median"),
    priceTargetHigh: missing("Kursziel hoch"),
    earningsDate: missing("Earnings-Termin"),
    guidance: prepared("Guidance"),
    insiderTransactions: prepared("Insider-Transaktionen"),
    institutionalHolders: prepared("Institutionelle Halter")
  };
}

function etfProfile(detail: AssetDetail): ETFProfessionalProfile {
  const updatedAt = detail.quote.asOf;
  const risk = detail.historicalRisk;
  const performanceValue = (range: keyof AssetDetail["candles"]) => {
    const candles = detail.candles[range];
    const first = candles[0]?.close;
    const last = candles.at(-1)?.close;
    return candles.length >= 2 && first && last ? Number((((last / first) - 1) * 100).toFixed(4)) : null;
  };
  const historicalPoint = (label: string, value: number | null, unit?: string) =>
    point({
      label,
      value,
      unit,
      provider: risk.provider,
      quality: value === null ? "unavailable" : "historical",
      updatedAt: risk.asOf,
      availability: value === null ? "provider_missing" : "available",
      note: value === null
        ? "Keine ausreichende verifizierte Historie für diese Kennzahl."
        : `Deterministisch aus ${risk.sampleSize} Renditebeobachtungen berechnet.`
    });
  const perf = (label: PerformanceRange, range: keyof AssetDetail["candles"] | null) =>
    historicalPoint(label, range ? performanceValue(range) : null, "%");
  const evidence = detail.fundamentalsEvidence;
  const dividendYield = evidence?.verifiedFields.includes("dividendYield")
    ? point({
        label: "Dividendenrendite",
        value: detail.fundamentals.dividendYield,
        unit: "%",
        provider: evidence.provider,
        quality: evidence.quality,
        updatedAt: evidence.fetchedAt,
        availability: "available",
        note: "Direkt geliefertes und verifiziertes Providerfeld."
      })
    : prepared("Dividendenrendite", "Keine verifizierte ETF-Dividendenrendite verfügbar.");

  return {
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    isin: prepared("ISIN"),
    wkn: prepared("WKN"),
    ticker: detail.asset.symbol,
    issuer: prepared("Anbieter"),
    indexName: prepared("Index"),
    replicationMethod: prepared("Replikationsmethode"),
    ter: prepared("TER / laufende Kosten"),
    aum: prepared("Fondsvolumen / AUM"),
    distributionPolicy: prepared("Ertragsverwendung"),
    dividendYield,
    distributionInterval: prepared("Ausschüttungsintervall"),
    trackingDifference: prepared("Tracking Difference"),
    trackingError: prepared("Tracking Error"),
    esgScore: prepared("ESG-Daten"),
    riskClass: prepared("Risiko-Klasse"),
    volatility: historicalPoint("Volatilität", risk.metrics.annualizedVolatilityPercent, "%"),
    sharpeRatio: historicalPoint("Sharpe Ratio", risk.metrics.sharpeRatio),
    maxDrawdown: historicalPoint("Max Drawdown", risk.metrics.maxDrawdownPercent, "%"),
    benchmark: "nicht verfügbar",
    performance: {
      "1M": perf("1M", "1M"),
      "3M": perf("3M", null),
      "6M": perf("6M", "6M"),
      YTD: perf("YTD", "YTD"),
      "1Y": perf("1Y", "1Y"),
      "3Y": perf("3Y", null),
      "5Y": perf("5Y", "5Y"),
      "10Y": perf("10Y", null),
      MAX: perf("MAX", "MAX")
    },
    topHoldings: [],
    sectorWeights: [],
    countryWeights: [],
    currencyWeights: [],
    marketCapWeights: [],
    provider: risk.provider,
    quality: risk.quality,
    updatedAt
  };
}

function cryptoProfile(
  detail: AssetDetail,
  quote: NormalizedQuote,
  reference: CoinGeckoCachedResult<CoinGeckoMetadataLookup> | null = null,
  globalReference: CoinGeckoCachedResult<CryptoGlobalReference> | null = null,
): CryptoProfessionalProfile {
  const updatedAt = quote.timestamp;
  const cp = (label: string, value: string | number | null, quality: MarketDataQuality = quote.quality, provider = quote.provider, note = "Normalisierte Krypto-Providerangabe oder vorbereitete Datenstruktur.") =>
    point({ label, value, quality, provider, updatedAt, availability: value === null ? "provider_missing" : "available", note });
  const risk = detail.historicalRisk;
  const trendPoint = detail.scoreEvidence?.dimensions.trend;
  const resolved = reference?.value.status === "resolved" ? reference.value.data : null;
  const referenceQuality = reference?.quality ?? "unavailable";
  const referenceUpdatedAt = resolved?.market.lastUpdated ?? resolved?.fetchedAt ?? updatedAt;
  const rp = (label: string, value: string | number | null, note: string) => point({
    label,
    value,
    provider: resolved ? "CoinGecko" : preparedProvider,
    quality: resolved ? referenceQuality : "unavailable",
    updatedAt: referenceUpdatedAt,
    availability: value === null ? "provider_missing" : "available",
    note,
  });
  const mappingNote = reference?.value.status === "ambiguous"
    ? `Mehrdeutiges Symbol: ${reference.value.candidates.map((candidate) => `${candidate.name} (${candidate.id})`).join(", ")}. Keine automatische Auswahl.`
    : reference?.value.status === "not_found"
      ? "Keine eindeutige CoinGecko-ID gefunden."
      : resolved
        ? resolved.mappingMethod === "verified_mapping"
          ? "Kanonische, geprüfte Coin-ID-Zuordnung."
          : "Eindeutiger exakter Symboltreffer in der CoinGecko-Suche."
        : "CoinGecko-Referenzquelle ist nicht verfügbar oder nicht freigeschaltet.";
  const totalCryptoMarketCap = globalReference?.value.totalMarketCapUsd ?? null;
  const dominance = resolved?.market.marketCap && totalCryptoMarketCap
    ? Number(((resolved.market.marketCap / totalCryptoMarketCap) * 100).toFixed(4))
    : null;

  return {
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    provider: quote.provider,
    quality: quote.quality,
    updatedAt,
    coinId: rp("CoinGecko-ID", resolved?.coinId ?? null, mappingNote),
    mappingStatus: rp("Identitäts-Zuordnung", resolved?.mappingMethod === "verified_mapping" ? "verifiziert" : resolved ? "eindeutiger Suchtreffer" : null, mappingNote),
    marketCapRank: rp("Market-Cap-Rang", resolved?.marketCapRank ?? null, "CoinGecko-Referenzrang; kein Live-Kurssignal."),
    categories: rp("Kategorien", resolved?.categories.length ? resolved.categories.slice(0, 5).join(", ") : null, "Provider-Kategorien, nicht von StockPilot erfunden."),
    blockchainAddresses: rp("Blockchain-Adressen", resolved?.blockchainAddresses.length ? resolved.blockchainAddresses.slice(0, 4).map((item) => `${item.network}: ${item.address}`).join(" · ") : null, "Vertragsadressen aus CoinGecko; vor Transaktionen immer unabhängig prüfen."),
    price: cp("Aktueller Kurs", quote.price, quote.quality, quote.provider, "Schneller Coinbase-/Binance-Quote mit explizitem Qualitätsstatus; keine Realtime-Garantie."),
    volume24h: rp("24h Volumen", resolved?.market.volume24h ?? null, "CoinGecko-Referenz-Snapshot; nicht der schnelle Börsen-Quote-Feed."),
    marketCap: rp("Market Cap", resolved?.market.marketCap ?? null, "CoinGecko-Referenz-Snapshot; nicht sekündlich realtime."),
    circulatingSupply: rp("Circulating Supply", resolved?.market.circulatingSupply ?? null, "Von CoinGecko gemeldeter Umlaufbestand."),
    totalSupply: rp("Total Supply", resolved?.market.totalSupply ?? null, "Von CoinGecko gemeldeter Gesamtbestand."),
    maxSupply: rp("Max Supply", resolved?.market.maxSupply ?? null, "Fehlt, wenn kein Maximalbestand definiert oder geliefert ist."),
    fullyDilutedValuation: rp("Fully Diluted Valuation", resolved?.market.fullyDilutedValuation ?? null, "CoinGecko-Referenzwert; keine StockPilot-Schätzung."),
    dominance: point({ label: "Dominanz", value: dominance, unit: "%", provider: dominance === null ? preparedProvider : "CoinGecko / StockPilot deterministic", quality: dominance === null ? "unavailable" : (globalReference?.quality ?? "delayed"), updatedAt: globalReference?.value.fetchedAt ?? updatedAt, availability: dominance === null ? "provider_missing" : "available", note: "Deterministisch aus Coin-Marktkapitalisierung und CoinGecko-Gesamtmarkt berechnet." }),
    fundingRates: prepared("Funding Rates"),
    openInterest: prepared("Open Interest"),
    onChainData: rp("On-Chain-Daten", resolved?.blockchainAddresses.length ? `${resolved.blockchainAddresses.length} gemeldete Netzwerkadresse(n)` : null, "Nur Stammdaten; keine On-Chain-Aktivitätsanalyse."),
    exchangeData: cp("Exchange-Daten", quote.spread !== undefined ? `Bid/Ask Spread ${quote.spread}` : null),
    exchangeCount: rp("Börsen-/Paar-Abdeckung", resolved?.exchanges.length ?? null, "Anzahl deduplizierter CoinGecko-Ticker im begrenzten Referenz-Snapshot."),
    volatility: point({
      label: "Volatilität",
      value: risk.metrics.annualizedVolatilityPercent,
      unit: "%",
      provider: risk.provider,
      quality: risk.quality,
      updatedAt: risk.asOf,
      availability: risk.metrics.annualizedVolatilityPercent === null ? "provider_missing" : "available",
      note: "Deterministisch aus verifizierten historischen Schlusskursen berechnet."
    }),
    trend: point({
      label: "Trend",
      value: trendPoint?.value === null || trendPoint?.value === undefined
        ? null
        : trendPoint.value >= 60
          ? "positiv"
          : trendPoint.value <= 40
            ? "negativ"
            : "neutral",
      provider: trendPoint?.sources[0] ?? "StockPilot Analysis Guard",
      quality: trendPoint?.value === null || trendPoint?.value === undefined ? "unavailable" : "historical",
      updatedAt: trendPoint?.asOf ?? updatedAt,
      availability: trendPoint?.value === null || trendPoint?.value === undefined ? "provider_missing" : "available",
      note: trendPoint?.rationale ?? "Keine verifizierte Trendhistorie verfügbar."
    }),
    events: prepared("News/Events")
  };
}

function rowFromDetail(
  detail: AssetDetail,
  quote: NormalizedQuote,
  cryptoReference: CoinGeckoCachedResult<CoinGeckoMetadataLookup> | null = null,
  globalReference: CoinGeckoCachedResult<CryptoGlobalReference> | null = null,
): ProfessionalScreenerRow {
  const row: ProfessionalScreenerRow = {
    asset: detail.asset,
    quote,
    marketCore: marketCore(detail, quote),
    scores: detail.scores,
    scoreEvidence: detail.scoreEvidence,
    aiRisk: detail.aiRisk,
    dataQuality: detail.dataQuality as DataQualityReport | null
  };

  if (detail.asset.type === "stock") row.equityFundamentals = equityFundamentals(detail);
  if (detail.asset.type === "etf") row.etfProfile = etfProfile(detail);
  if (detail.asset.type === "crypto") row.cryptoProfile = cryptoProfile(detail, quote, cryptoReference, globalReference);

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

function portfolioAnalytics(_scenarios: PortfolioScenario[]): ProfessionalPortfolioAnalytics {
  const updatedAt = now();

  return {
    totalValue: prepared("Gesamtwert", "Nutzerportfolio nur nach authentifiziertem Supabase-Abruf verfügbar."),
    dayPnL: prepared("Tagesgewinn/-verlust"),
    totalPnL: prepared("Gesamtgewinn/-verlust"),
    performanceSincePurchase: prepared("Performance seit Kauf"),
    costBasis: prepared("Einstandswert"),
    assetAllocation: [],
    countryAllocation: [],
    sectorAllocation: [],
    currencyRisk: prepared("Währungsrisiko"),
    dividendForecast: prepared("Dividendenprognose"),
    riskScore: prepared("Risiko-Score"),
    volatility: prepared("Volatilität"),
    drawdown: prepared("Drawdown"),
    correlations: prepared("Korrelationen", "Matrix vorbereitet; echte Zeitreihenanbieter erforderlich."),
    concentrationRisk: prepared("Klumpenrisiko"),
    rebalancingSuggestions: [],
    scenarioAnalysis: [],
    provider: "StockPilot Portfolio Guard",
    quality: "unavailable",
    updatedAt
  };
}

function newsEvents(): ProfessionalNewsEvent[] {
  return [];
}

function comparisons(rows: ProfessionalScreenerRow[]): ProfessionalComparison[] {
  void rows;
  return [];
}

function professionalUniverseSymbols(dashboard: DashboardData) {
  const configuredSymbols = (process.env.STOCKPILOT_PROFESSIONAL_SYMBOLS ?? process.env.STOCKPILOT_MARKET_SYMBOLS ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9./:-]{1,32}$/.test(symbol));
  const dashboardSymbols = [
    ...dashboard.watchlist,
    ...dashboard.gainers,
    ...dashboard.losers,
    ...dashboard.mostActive,
    ...dashboard.trendingAssets
  ].map((item) => item.asset.symbol);

  return [...new Set([...configuredSymbols, ...dashboardSymbols])].slice(0, MAX_PROFESSIONAL_SYMBOLS);
}

async function loadProfessionalDetails(provider: ReturnType<typeof getMarketDataProvider>, symbols: string[]) {
  const details = await Promise.all(symbols.map((symbol) => provider.getAsset(symbol).catch(() => null)));

  return details.filter((detail): detail is AssetDetail => Boolean(detail));
}

class StockPilotProfessionalDataProvider implements ProfessionalDataProvider {
  async getETFProfile(symbol: string) {
    const detail = await getMarketDataProvider().getAsset(symbol).catch(() => null);
    if (!detail || detail.asset.type !== "etf") return null;
    return etfProfile(detail);
  }

  async getCryptoProfile(symbol: string, quote: NormalizedQuote) {
    const detail = await getMarketDataProvider().getAsset(symbol).catch(() => null);
    if (!detail || detail.asset.type !== "crypto") return null;
    return cryptoProfile(detail, quote);
  }

  async getProfessionalPortfolio() {
    return portfolioAnalytics([]);
  }

  async getMarketReport(): Promise<ProfessionalMarketReport> {
    const provider = getMarketDataProvider();
    const dashboard = await provider.getDashboard();
    const details = await loadProfessionalDetails(provider, professionalUniverseSymbols(dashboard));
    const cryptoDetails = details.filter((detail) => detail.asset.type === "crypto");
    const [cryptoReferences, globalReference] = await Promise.all([
      Promise.all(cryptoDetails.map(async (detail) => [
        detail.asset.symbol,
        await getCoinGeckoMetadata(detail.asset.symbol).catch(() => null),
      ] as const)),
      cryptoDetails.length ? getCoinGeckoGlobalReference().catch(() => null) : Promise.resolve(null),
    ]);
    const cryptoReferenceBySymbol = new Map(cryptoReferences);
    const rows = details.map((detail) => rowFromDetail(
      detail,
      normalizedFromDetail(detail),
      cryptoReferenceBySymbol.get(detail.asset.symbol) ?? null,
      globalReference,
    ));
    const bySymbol = new Map(rows.map((row) => [row.asset.symbol, row]));
    const selectRows = (items: typeof dashboard.watchlist) => items.map((item) => bySymbol.get(item.asset.symbol)).filter((row): row is ProfessionalScreenerRow => Boolean(row));
    const updatedAt = now();
    const qualityRows = rows.filter((row) => row.dataQuality !== null);
    const dataQualityRisk = qualityRows.length
      ? Math.round(qualityRows.reduce((sum, row) => sum + (100 - (row.dataQuality?.score ?? 0)), 0) / qualityRows.length)
      : null;

    return {
      updatedAt,
      providerStack: [...new Set([provider.providerName, ...rows.map((row) => row.quote.provider)])],
      qualitySummary: qualitySummary(rows),
      globalOverview: [
        point({
          label: "Aktive Instrumente im Report",
          value: rows.length,
          provider: "StockPilot Security Master",
          quality: rows.length ? "near_realtime" : "unavailable",
          updatedAt,
          availability: rows.length ? "available" : "provider_missing",
          note: "Report wird aus Provider-/Universe-Symbolen erzeugt. STOCKPILOT_PROFESSIONAL_SYMBOLS kann serverseitig erweitert werden."
        }),
        prepared("S&P 500", "Kein lizenzierter Indexfeed im aktuellen Report."),
        prepared("Nasdaq 100", "Kein lizenzierter Indexfeed im aktuellen Report."),
        prepared("DAX", "Kein lizenzierter Indexfeed im aktuellen Report."),
        globalReference
          ? point({ label: "Krypto-Gesamtmarkt", value: globalReference.value.totalMarketCapUsd, provider: "CoinGecko", quality: globalReference.quality, updatedAt: globalReference.value.providerUpdatedAt ?? globalReference.value.fetchedAt, availability: globalReference.value.totalMarketCapUsd === null ? "provider_missing" : "available", note: "CoinGecko-Referenz-Snapshot; kein sekündlicher Live-Kurs." })
          : prepared("Krypto-Gesamtmarkt", "CoinGecko ist nicht verfügbar oder nicht freigeschaltet."),
        globalReference
          ? point({ label: "Aktive Kryptowährungen", value: globalReference.value.activeCryptocurrencies, provider: "CoinGecko", quality: globalReference.quality, updatedAt: globalReference.value.providerUpdatedAt ?? globalReference.value.fetchedAt, availability: globalReference.value.activeCryptocurrencies === null ? "provider_missing" : "available", note: "Vom Referenzprovider gemeldete Marktbreite." })
          : prepared("Aktive Kryptowährungen"),
        globalReference
          ? point({ label: "Krypto-24h-Volumen", value: globalReference.value.totalVolumeUsd, provider: "CoinGecko", quality: globalReference.quality, updatedAt: globalReference.value.providerUpdatedAt ?? globalReference.value.fetchedAt, availability: globalReference.value.totalVolumeUsd === null ? "provider_missing" : "available", note: "Aggregierter CoinGecko-Referenzwert." })
          : prepared("Krypto-24h-Volumen")
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
        point({
          label: "Datenqualitäts-Risiko",
          value: dataQualityRisk,
          provider: "StockPilot Data Quality Engine",
          quality: dataQualityRisk === null ? "unavailable" : "historical",
          updatedAt,
          availability: dataQualityRisk === null ? "provider_missing" : "available",
          note: "100 minus durchschnittlicher, feldweise belegter Datenqualitätsscore der geladenen Instrumente."
        }),
        prepared("Klumpenrisiko", "Nur aus einem authentifizierten Nutzerportfolio berechenbar."),
        prepared("Krypto-Gewicht", "Nur aus einem authentifizierten Nutzerportfolio berechenbar."),
        prepared("Korrelationsmatrix", "Echte historische Zeitreihen erforderlich."),
        prepared("Makro-Termine", "Fed/EZB/Kalenderprovider erforderlich.")
      ],
      portfolio: portfolioAnalytics([]),
      comparisons: comparisons(rows)
    };
  }
}

export function getProfessionalDataProvider(): ProfessionalDataProvider {
  return new StockPilotProfessionalDataProvider();
}
