export const timeRanges = ["1D", "1W", "1M", "6M", "1J", "5J"] as const;

export type TimeRange = (typeof timeRanges)[number];
export type AssetType = "stock" | "etf" | "crypto";
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
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  movingAverages: {
    ma20: number;
    ma50: number;
    ma200: number;
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
  };
  support: number[];
  resistance: number[];
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

export interface NewsItem {
  id: string;
  symbol: string;
  title: string;
  source: string;
  publishedAt: string;
  relevance: number;
  sentiment: Sentiment;
  impactScore: number;
  summary: string;
  url: string;
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
