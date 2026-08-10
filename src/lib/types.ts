export const chartRanges = ["1D", "5D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
export const timeRanges = chartRanges;

export type ChartRange = (typeof chartRanges)[number];
export type TimeRange = ChartRange;
export type AssetType = "stock" | "etf" | "crypto" | "forex" | "index";
export type MarketDataQuality =
  | "realtime"
  | "near_realtime"
  | "delayed"
  | "historical"
  | "mock"
  | "unavailable";
export type MarketStatus = "open" | "closed" | "pre_market" | "after_hours" | "unknown";
export type RefreshMode = "sse" | "websocket" | "polling" | "manual";
export type RefreshInterval = 1000 | 5000 | 10000 | 30000 | 60000 | 300000;
export type MarketConnectionStatus = "connected" | "reconnecting" | "polling" | "rate_limited" | "offline" | "error";
export type Sentiment = "positive" | "neutral" | "negative";
export type RiskLevel = "niedrig" | "mittel" | "hoch" | "extrem";
export type UncertaintyLevel = "niedrig" | "mittel" | "hoch";
export type AlertType =
  | "price"
  | "rsi"
  | "news"
  | "volume"
  | "earnings"
  | "ai-risk"
  | "ai-shift"
  | "portfolio-risk";
export type AlertExecutionStatus = "demo" | "created" | "paused" | "triggered" | "error" | "unavailable";
export type AlertFrequency = "manual" | "10s" | "30s" | "60s" | "5min";
export type AlertNotificationChannel = "none" | "in_app" | "email" | "push" | "webhook";

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  exchange: string;
  currency: string;
  sector: string;
  description: string;
}

export interface Quote {
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  delayedByMinutes: number;
  asOf: string;
  bid?: number;
  ask?: number;
  spread?: number;
  open?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  provider: string;
  quality: MarketDataQuality;
  latencyMs?: number;
  marketStatus: MarketStatus;
}

export interface NormalizedQuote {
  symbol: string;
  name?: string;
  assetType: AssetType;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  bid?: number;
  ask?: number;
  spread?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  freeFloat?: number;
  exchange?: string;
  timestamp: string;
  provider: string;
  quality: MarketDataQuality;
  latencyMs?: number;
  marketStatus: MarketStatus;
}

export interface MarketDataFreshness {
  mode: RefreshMode;
  intervalMs?: RefreshInterval;
  lastUpdatedAt: string;
  nextUpdateAt?: string;
  connectionStatus: MarketConnectionStatus;
  provider: string;
  quality: MarketDataQuality;
}

export type MarketUniverseAssetClass =
  | AssetType
  | "commodity"
  | "bond"
  | "future"
  | "option"
  | "warrant"
  | "fund";

export type InstrumentIdentifierType =
  | "ticker"
  | "provider_symbol"
  | "isin"
  | "figi"
  | "cusip"
  | "sedol"
  | "lei"
  | "mic"
  | "exchange";

export interface InstrumentIdentifier {
  type: InstrumentIdentifierType;
  value: string;
  provider?: string;
}

export type InstrumentResolutionStatus = "resolved" | "ambiguous" | "provider_only" | "invalid";
export type InstrumentAnalysisReadiness = "ready" | "limited" | "blocked";

export interface MarketUniverseInstrument {
  symbol: string;
  displaySymbol?: string;
  normalizedSymbol?: string;
  canonicalId?: string;
  name: string;
  assetClass: MarketUniverseAssetClass;
  exchange: string;
  country: string;
  currency: string;
  identifiers?: InstrumentIdentifier[];
  identityConfidence?: number;
  resolutionStatus?: InstrumentResolutionStatus;
  resolutionWarnings?: string[];
  searchScore?: number;
  matchReasons?: string[];
  detailHref?: string;
  analysisReadiness?: InstrumentAnalysisReadiness;
  analysisBlockers?: string[];
  provider: string;
  quality: MarketDataQuality;
  quoteQuality: MarketDataQuality;
  coverage: "available" | "prepared" | "license_required" | "provider_missing";
  subscribable: boolean;
  lastUpdatedAt: string;
  note: string;
  origin?: "instrument_master" | "provider_search";
  quoteStatus?: "unknown" | "available" | "restricted" | "error";
  quoteCheckedAt?: string | null;
  discoveredAt?: string;
}

export interface MarketUniverseCoverage {
  label: string;
  assetClasses: MarketUniverseAssetClass[];
  exchanges: string[];
  providerCandidates: string[];
  status: "connected" | "prepared" | "license_required";
  note: string;
}

export interface Candle {
  symbol: string;
  range: ChartRange;
  timestamp: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /**
   * Vom Anbieter gelieferter angepasster Schlusskurs.
   *
   * Fehlt der Wert, darf niemand aus `close` ableiten, dass Splits,
   * Ausschüttungen oder andere Corporate Actions berücksichtigt wurden.
   */
  adjustedClose?: number;
  volume: number;
}

/**
 * Technische Indikatoren.
 *
 * `null` heißt hier durchgehend: **die Zeitreihe war zu kurz**, nicht „null".
 * Vorher waren alle Felder pflichtig, weshalb jede Quelle etwas erfinden
 * musste, um den Typ zu erfüllen — genau das ist passiert. Die Nullbarkeit ist
 * deshalb kein Detail, sondern die Stelle, an der der Typ die Ehrlichkeit
 * erzwingt.
 */
export interface TechnicalIndicators {
  rsi: number | null;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  } | null;
  movingAverages: {
    ma20: number | null;
    ma50: number | null;
    ma200: number | null;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  } | null;
  support: number[];
  resistance: number[];
  /** Trendstärke nach Wilder. `adx` sagt nichts über die Richtung — dafür sind +DI/−DI da. */
  adx: { adx: number; plusDi: number; minusDi: number } | null;
  /**
   * Trendkanal aus einer Regressionsgeraden.
   *
   * `fit` gehört zwingend mit angezeigt: eine Gerade durch reines Rauschen hat
   * ebenfalls eine Steigung.
   */
  trendChannel: {
    direction: "up" | "down" | "sideways";
    upper: number;
    lower: number;
    middle: number;
    changePercent: number;
    fit: number;
    reliable: boolean;
  } | null;
  /**
   * Ausbruch aus der Spanne der Vorperioden.
   *
   * `null` heißt „lässt sich nicht sagen", `{ status: "none" }` heißt „kein
   * Ausbruch". Der Unterschied ist Absicht.
   */
  breakout:
    | { status: "none" }
    | {
        status: "breakout";
        direction: "up" | "down";
        level: number;
        strengthInAtr: number;
        volumeConfirmed: boolean;
      }
    | null;
  /** Wie viele Kerzen zugrunde lagen. Bestimmt, was überhaupt möglich war. */
  sampleSize: number;
  /** Was nicht berechnet werden konnte — mit lesbarem Namen. */
  unavailable: string[];
}

export interface Fundamentals {
  peRatio: number | null;
  revenueGrowth: number;
  earningsGrowth: number;
  debtToEquity: number;
  cashflow: number;
  dividendYield: number | null;
  marketCap: number;
}

export type FundamentalsFieldSource = "provider" | "mock" | "unavailable";

/**
 * Feldweise Herkunft der Fundamentals. Zahlen ohne `provider`-Status dürfen
 * weder als Unternehmenskennzahl angezeigt noch für Analysen verwendet werden.
 */
export interface FundamentalsEvidence {
  provider: string;
  quality: MarketDataQuality;
  fetchedAt: string;
  fields: Partial<Record<keyof Fundamentals, FundamentalsFieldSource>>;
  verifiedFields: Array<keyof Fundamentals>;
  excludedMockFields: Array<keyof Fundamentals>;
  unavailableFields: Array<keyof Fundamentals>;
  verifiedCount: number;
  totalFields: number;
  coveragePercent: number;
  caveat: string | null;
  warning: string | null;
}

export interface NewsItem {
  id: string;
  symbol: string;
  title: string;
  source: string;
  publishedAt: string;
  /**
   * Der Übereinstimmungswert des Anbieters — **nicht** auf 0–100 kalibriert.
   *
   * Vorher war das eine Zahl aus der Listenposition: `74 + |sentiment| × 22 −
   * index × 2`. Der zweite Treffer war damit immer relevanter als der dritte,
   * unabhängig vom Inhalt. `null` heißt: der Anbieter liefert keine Relevanz.
   */
  relevance: number | null;
  sentiment: Sentiment;
  /** Aus Sentiment und Relevanz abgeleitet. Ohne Relevanz nicht bildbar. */
  impactScore: number | null;
  summary: string;
  url: string;
  /** Erkannte Ereignisarten, jeweils mit dem auslösenden Wortlaut. */
  events: NewsEvent[];
  /** Bezüge der Meldung: Unternehmen, Branche, Land, Index, Rohstoff, Währung, Krypto. */
  subjects: NewsSubjectRef[];
  /** Weitere Quellen, die dieselbe Meldung gebracht haben. */
  duplicateSources: string[];
}

export interface NewsEvent {
  type: string;
  label: string;
  /** Der Wortlaut, der die Einordnung ausgelöst hat. Ohne ihn wäre es eine Black Box. */
  matchedText: string;
}

export interface NewsSubjectRef {
  type: "company" | "industry" | "country" | "index" | "commodity" | "currency" | "crypto";
  id: string;
  label: string;
  /** `provider` ist belastbar, `symbol` ist abgeleitet. */
  origin: "provider" | "symbol";
  matchScore: number | null;
}

export interface DataSource {
  name: string;
  type: "mock" | "provider" | "cache" | "derived";
  rank: number;
  fetchedAt: string;
  status: "fresh" | "delayed" | "stale" | "missing" | "conflicting";
  note: string;
}

export interface DataQualityReport {
  score: number;
  freshness: "fresh" | "delayed" | "stale";
  sourceLabel: string;
  isMock: boolean;
  updatedAt: string;
  stale: boolean;
  sufficientForAnalysis: boolean;
  confidence: number;
  issues: string[];
  warnings: string[];
  contradictions: string[];
  sources: DataSource[];
}

export interface ProfessionalScores {
  technical: number;
  fundamental: number;
  news: number;
  sentiment: number;
  momentum: number;
  volatilityRisk: number;
  liquidityRisk: number;
  eventRisk: number;
  opportunityTotal: number;
  riskTotal: number;
  probabilityUp: number;
  probabilityDown: number;
  probabilitySideways: number;
  explanation: string[];
}

export interface AnalysisLayer {
  label: string;
  value: string;
  status: "positive" | "neutral" | "negative" | "risk";
  detail: string;
  source: string;
  updatedAt: string;
}

export interface MacroFactor {
  label: string;
  impact: Sentiment;
  detail: string;
  source: string;
}

export interface RiskFinding {
  id: string;
  category:
    | "volatility"
    | "liquidity"
    | "news"
    | "earnings"
    | "pump-dump"
    | "volume"
    | "technical"
    | "market"
    | "sector"
    | "portfolio"
    | "data-quality";
  title: string;
  severity: RiskLevel;
  detail: string;
  evidence: string;
  action: string;
}

export interface RiskEngineReport {
  level: RiskLevel;
  score: number;
  summary: string;
  blockedAnalysis: boolean;
  findings: RiskFinding[];
}

export interface AnalystOpinion {
  consensus: "Constructive" | "Neutral" | "Cautious" | "Outperform";
  count: number;
  targetLow: number;
  targetMedian: number;
  targetHigh: number;
}

export interface InsiderActivity {
  date: string;
  person: string;
  action: "Buy" | "Sell";
  value: number;
}

export interface Scores {
  trend: number;
  news: number;
  fundamental: number;
  technical: number;
  risk: number;
  total: number;
}

export interface AiAnalysis {
  summary: string;
  upsideDrivers: string[];
  downsideDrivers: string[];
  counterArguments: string[];
  dataGaps: string[];
  bullCase: string;
  bearCase: string;
  neutralCase: string;
  shortTerm: string;
  mediumTerm: string;
  longTerm: string;
  riskLevel: RiskLevel;
  uncertainty: UncertaintyLevel;
  probabilities: {
    up: number;
    down: number;
    sideways: number;
  };
  sources: string[];
  weakDataWarning: string | null;
  modelNote: string;
}

export interface AssetSummary {
  asset: Asset;
  quote: Quote;
  scores: Scores;
  professionalScores?: ProfessionalScores;
  dataQuality?: DataQualityReport;
  riskReport?: RiskEngineReport;
  aiRisk: RiskLevel;
}

export interface AssetDetail extends AssetSummary {
  candles: Record<TimeRange, Candle[]>;
  indicators: TechnicalIndicators;
  fundamentals: Fundamentals;
  fundamentalsEvidence?: FundamentalsEvidence;
  news: NewsItem[];
  aiAnalysis: AiAnalysis;
  professionalScores: ProfessionalScores;
  dataQuality: DataQualityReport;
  riskReport: RiskEngineReport;
  analysisLayers: AnalysisLayer[];
  macroFactors: MacroFactor[];
  analystOpinion: AnalystOpinion | null;
  insiderActivity: InsiderActivity[];
  earningsDate: string | null;
}

export interface MarketOverviewItem {
  label: string;
  value: string;
  changePercent: number;
  status: "open" | "closed" | "volatile";
}

export interface SignalSummary {
  fundamental: string;
  technical: string;
  momentum: string;
  sentiment: string;
  valuation: string;
  macro: string;
  risk: string;
  overall: string;
  rationale: string;
}

export interface MarketDashboardTile {
  label: string;
  value: string;
  detail: string;
  status: "positive" | "neutral" | "negative" | "warning";
}

export interface RiskWarning {
  id: string;
  symbol: string;
  title: string;
  severity: RiskLevel;
  detail: string;
}

export interface DashboardData {
  watchlist: AssetSummary[];
  gainers: AssetSummary[];
  losers: AssetSummary[];
  mostActive: AssetSummary[];
  trendingAssets: AssetSummary[];
  marketOverview: MarketOverviewItem[];
  trends: string[];
  dataQualitySummary: {
    label: string;
    score: number;
    staleSources: number;
    mockSources: number;
  };
  aiSentiment: {
    label: string;
    score: number;
    summary: string;
  };
  signalSummary: SignalSummary;
  marketDashboard: MarketDashboardTile[];
  riskWarnings: RiskWarning[];
  latestNews: NewsItem[];
}

export interface AlertRule {
  id: string;
  symbol: string;
  type: AlertType;
  label: string;
  condition: string;
  enabled: boolean;
  status?: AlertExecutionStatus;
  threshold?: number;
  frequency?: AlertFrequency;
  notificationChannel?: AlertNotificationChannel;
}

export interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  sector: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
  riskScore: number;
}

export interface PortfolioTradeInput {
  symbol: string;
  name?: string;
  side: "buy" | "sell";
  assetType: AssetType;
  sector: string;
  quantity: number;
  price: number;
  currency: string;
  riskScore: number;
}

export interface AllocationSlice {
  label: string;
  value: number;
  weight: number;
}

export interface PortfolioScenario {
  label: string;
  shockPercent: number;
  estimatedValue: number;
  estimatedPnL: number;
}

export interface PortfolioWarning {
  id: string;
  severity: RiskLevel;
  title: string;
  detail: string;
}

export interface PortfolioSummary {
  positions: PortfolioPosition[];
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalRisk: number;
  diversificationScore: number;
  maxPositionWeight: number;
  cryptoWeight: number;
  sectorAllocation: AllocationSlice[];
  assetAllocation: AllocationSlice[];
  scenarios: PortfolioScenario[];
  warnings: PortfolioWarning[];
}

export type ProfessionalAvailability = "available" | "provider_missing" | "prepared" | "mock";
export type PerformanceRange = "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "10Y" | "MAX";

export interface ProfessionalDataPoint {
  label: string;
  value: string | number | null;
  unit?: string;
  provider: string;
  quality: MarketDataQuality;
  updatedAt: string;
  availability: ProfessionalAvailability;
  note: string;
}

export interface ProfessionalWeight {
  label: string;
  weight: number;
  provider: string;
  quality: MarketDataQuality;
}

export interface ProfessionalHolding {
  symbol: string;
  name: string;
  weight: number;
  sector: string;
  country: string;
  provider: string;
  quality: MarketDataQuality;
}

export interface EquityFundamentalsProfile {
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  updatedAt: string;
  provider: string;
  quality: MarketDataQuality;
  revenue: ProfessionalDataPoint;
  netIncome: ProfessionalDataPoint;
  eps: ProfessionalDataPoint;
  peRatio: ProfessionalDataPoint;
  forwardPe: ProfessionalDataPoint;
  pegRatio: ProfessionalDataPoint;
  priceToSales: ProfessionalDataPoint;
  priceToBook: ProfessionalDataPoint;
  ebitda: ProfessionalDataPoint;
  ebitMargin: ProfessionalDataPoint;
  netMargin: ProfessionalDataPoint;
  grossMargin: ProfessionalDataPoint;
  revenueGrowth: ProfessionalDataPoint;
  earningsGrowth: ProfessionalDataPoint;
  debtToEquity: ProfessionalDataPoint;
  operatingCashflow: ProfessionalDataPoint;
  freeCashflow: ProfessionalDataPoint;
  dividendYield: ProfessionalDataPoint;
  payoutRatio: ProfessionalDataPoint;
  buybacks: ProfessionalDataPoint;
  analystConsensus: ProfessionalDataPoint;
  priceTargetLow: ProfessionalDataPoint;
  priceTargetMedian: ProfessionalDataPoint;
  priceTargetHigh: ProfessionalDataPoint;
  earningsDate: ProfessionalDataPoint;
  guidance: ProfessionalDataPoint;
  insiderTransactions: ProfessionalDataPoint;
  institutionalHolders: ProfessionalDataPoint;
}

export interface ETFProfessionalProfile {
  symbol: string;
  name: string;
  isin: ProfessionalDataPoint;
  wkn: ProfessionalDataPoint;
  ticker: string;
  issuer: ProfessionalDataPoint;
  indexName: ProfessionalDataPoint;
  replicationMethod: ProfessionalDataPoint;
  ter: ProfessionalDataPoint;
  aum: ProfessionalDataPoint;
  distributionPolicy: ProfessionalDataPoint;
  dividendYield: ProfessionalDataPoint;
  distributionInterval: ProfessionalDataPoint;
  trackingDifference: ProfessionalDataPoint;
  trackingError: ProfessionalDataPoint;
  esgScore: ProfessionalDataPoint;
  riskClass: ProfessionalDataPoint;
  volatility: ProfessionalDataPoint;
  sharpeRatio: ProfessionalDataPoint;
  maxDrawdown: ProfessionalDataPoint;
  benchmark: string;
  performance: Record<PerformanceRange, ProfessionalDataPoint>;
  topHoldings: ProfessionalHolding[];
  sectorWeights: ProfessionalWeight[];
  countryWeights: ProfessionalWeight[];
  currencyWeights: ProfessionalWeight[];
  marketCapWeights: ProfessionalWeight[];
  provider: string;
  quality: MarketDataQuality;
  updatedAt: string;
}

export interface CryptoProfessionalProfile {
  symbol: string;
  name: string;
  provider: string;
  quality: MarketDataQuality;
  updatedAt: string;
  price: ProfessionalDataPoint;
  volume24h: ProfessionalDataPoint;
  marketCap: ProfessionalDataPoint;
  circulatingSupply: ProfessionalDataPoint;
  maxSupply: ProfessionalDataPoint;
  fullyDilutedValuation: ProfessionalDataPoint;
  dominance: ProfessionalDataPoint;
  fundingRates: ProfessionalDataPoint;
  openInterest: ProfessionalDataPoint;
  onChainData: ProfessionalDataPoint;
  exchangeData: ProfessionalDataPoint;
  volatility: ProfessionalDataPoint;
  trend: ProfessionalDataPoint;
  events: ProfessionalDataPoint;
}

export interface ProfessionalScreenerRow {
  asset: Asset;
  quote: NormalizedQuote;
  marketCore: ProfessionalDataPoint[];
  scores: Scores;
  aiRisk: RiskLevel;
  dataQuality: DataQualityReport | null;
  equityFundamentals?: EquityFundamentalsProfile;
  etfProfile?: ETFProfessionalProfile;
  cryptoProfile?: CryptoProfessionalProfile;
}

export interface ProfessionalPortfolioAnalytics {
  totalValue: ProfessionalDataPoint;
  dayPnL: ProfessionalDataPoint;
  totalPnL: ProfessionalDataPoint;
  performanceSincePurchase: ProfessionalDataPoint;
  costBasis: ProfessionalDataPoint;
  assetAllocation: ProfessionalWeight[];
  countryAllocation: ProfessionalWeight[];
  sectorAllocation: ProfessionalWeight[];
  currencyRisk: ProfessionalDataPoint;
  dividendForecast: ProfessionalDataPoint;
  riskScore: ProfessionalDataPoint;
  volatility: ProfessionalDataPoint;
  drawdown: ProfessionalDataPoint;
  correlations: ProfessionalDataPoint;
  concentrationRisk: ProfessionalDataPoint;
  rebalancingSuggestions: string[];
  scenarioAnalysis: PortfolioScenario[];
  provider: string;
  quality: MarketDataQuality;
  updatedAt: string;
}

export interface ProfessionalNewsEvent {
  id: string;
  title: string;
  category: "company" | "macro" | "earnings" | "dividend" | "split" | "analyst" | "central-bank";
  symbol?: string;
  source: string;
  publishedAt: string;
  /** `null`, wenn der Nachrichtenanbieter keine Relevanz liefert. */
  relevance: number | null;
  impact: "positive" | "neutral" | "negative" | "unclear";
  quality: MarketDataQuality;
  checked: boolean;
  note: string;
}

export interface ProfessionalComparison {
  title: string;
  left: string;
  right: string;
  benchmark: string;
  points: ProfessionalDataPoint[];
}

export interface ProfessionalMarketReport {
  updatedAt: string;
  providerStack: string[];
  qualitySummary: {
    realtime: number;
    nearRealtime: number;
    delayed: number;
    mock: number;
    unavailable: number;
  };
  globalOverview: ProfessionalDataPoint[];
  equityScreener: ProfessionalScreenerRow[];
  etfScreener: ProfessionalScreenerRow[];
  cryptoScreener: ProfessionalScreenerRow[];
  watchlist: ProfessionalScreenerRow[];
  topGainers: ProfessionalScreenerRow[];
  topLosers: ProfessionalScreenerRow[];
  mostActive: ProfessionalScreenerRow[];
  newsTerminal: ProfessionalNewsEvent[];
  riskDashboard: ProfessionalDataPoint[];
  portfolio: ProfessionalPortfolioAnalytics;
  comparisons: ProfessionalComparison[];
}
