import type {
  Candle,
  Fundamentals,
  NewsItem,
  ProfessionalScores,
  Quote,
  RiskLevel,
  Scores,
  Sentiment,
  TechnicalIndicators
} from "./types";

export const legalDisclaimer =
  "Keine Anlageberatung. Alle Analysen sind modellbasierte Einschätzungen, können falsch sein und ersetzen keine eigene Prüfung. Investieren ist mit Risiko verbunden.";

export const probabilityDisclaimer =
  "Diese Wahrscheinlichkeit ist keine Garantie und kann falsch sein.";

export const mockDataDisclaimer =
  "Mock-Daten: Werte dienen der Produktentwicklung und dürfen nicht als reale Marktdaten interpretiert werden.";

function finiteOrNull(value: number) {
  return Number.isFinite(value) ? value : null;
}

function safeCurrency(currency: string) {
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

export function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function formatCurrency(value: number, currency = "USD") {
  const safeValue = finiteOrNull(value);
  if (safeValue === null) return "n/a";

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: safeCurrency(currency),
    maximumFractionDigits: safeValue > 1000 ? 0 : 2
  }).format(safeValue);
}

export function formatCompact(value: number) {
  const safeValue = finiteOrNull(value);
  if (safeValue === null) return "n/a";

  return new Intl.NumberFormat("de-DE", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(safeValue);
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function scoreLabel(score: number) {
  if (score >= 80) return "Mögliche Chance hoch, Risiko streng prüfen";
  if (score >= 60) return "Mögliche Chance erhöht";
  if (score >= 40) return "Unklar / neutral";
  if (score >= 20) return "Schwaches Chancenprofil";
  return "Sehr schwaches Chancenprofil";
}

export function scoreTone(score: number) {
  if (score >= 70) return "text-profit";
  if (score >= 50) return "text-amber";
  return "text-loss";
}

export function riskTone(level: RiskLevel) {
  const tones: Record<RiskLevel, string> = {
    niedrig: "text-profit border-profit/30 bg-profit/10",
    mittel: "text-amber border-amber/30 bg-amber/10",
    hoch: "text-loss border-loss/30 bg-loss/10",
    extrem: "text-loss border-loss/50 bg-loss/15"
  };
  return tones[level];
}

export function sentimentTone(sentiment: Sentiment) {
  const tones: Record<Sentiment, string> = {
    positive: "text-profit border-profit/30 bg-profit/10",
    neutral: "text-amber border-amber/30 bg-amber/10",
    negative: "text-loss border-loss/30 bg-loss/10"
  };
  return tones[sentiment];
}

export function calculateTotalScore(scores: Omit<Scores, "total">) {
  const opportunity =
    scores.trend * 0.22 +
    scores.news * 0.18 +
    scores.fundamental * 0.24 +
    scores.technical * 0.22;
  const riskPenalty = (100 - scores.risk) * 0.14;
  return Math.max(0, Math.min(100, Math.round(opportunity + riskPenalty)));
}

export function calculateVolatility(candles: Candle[]) {
  const cleanCandles = candles.filter(
    (candle) => Number.isFinite(candle.close) && candle.close > 0
  );

  if (cleanCandles.length < 3) return 0;

  const returns = cleanCandles.slice(1).map((candle, index) => {
    const previous = cleanCandles[index].close || 1;
    return Math.abs(((candle.close - previous) / previous) * 100);
  }).filter(Number.isFinite);

  if (!returns.length) return 0;

  return Number((returns.reduce((sum, value) => sum + value, 0) / returns.length).toFixed(2));
}

function averageSentimentScore(news: NewsItem[]) {
  if (!news.length) return 50;

  const sentimentValues: Record<Sentiment, number> = {
    positive: 72,
    neutral: 50,
    negative: 28
  };

  const weighted = news.reduce(
    (sum, item) => sum + sentimentValues[item.sentiment] * (item.relevance / 100),
    0
  );
  const weights = news.reduce((sum, item) => sum + item.relevance / 100, 0);
  return Math.round(weighted / Math.max(weights, 0.01));
}

function eventRiskScore(earningsDate: string | null, news: NewsItem[], now = new Date()) {
  const negativeNewsRisk = news.some((item) => item.sentiment === "negative" && item.relevance >= 75)
    ? 18
    : 0;

  if (!earningsDate) return clamp(25 + negativeNewsRisk);

  const daysUntilEarnings = Math.ceil(
    (new Date(`${earningsDate}T12:00:00Z`).getTime() - now.getTime()) / 86400000
  );
  const earningsRisk = daysUntilEarnings >= 0 && daysUntilEarnings <= 14 ? 42 : 18;

  return clamp(earningsRisk + negativeNewsRisk);
}

export function calculateProfessionalScores(input: {
  baseScores: Scores;
  quote: Quote;
  candles: Candle[];
  indicators: TechnicalIndicators;
  fundamentals: Fundamentals;
  news: NewsItem[];
  earningsDate: string | null;
  now?: Date;
}): ProfessionalScores {
  const volatility = calculateVolatility(input.candles);
  const sentiment = averageSentimentScore(input.news);
  const latest = input.candles[input.candles.length - 1];
  const first = input.candles[0];
  const momentumChange = first ? ((latest.close - first.close) / Math.max(first.close, 0.01)) * 100 : 0;
  const momentum = clamp(50 + momentumChange * 2.1 + input.quote.changePercent * 2);
  const technical = clamp(
    input.baseScores.technical +
      (input.indicators.rsi > 70 ? -12 : 0) +
      (input.indicators.rsi < 30 ? -8 : 0) +
      (input.indicators.macd.histogram > 0 ? 7 : -5)
  );
  const fundamental = clamp(
    input.baseScores.fundamental +
      Math.min(14, Math.max(-14, input.fundamentals.revenueGrowth / 2)) +
      (input.fundamentals.debtToEquity > 1 ? -8 : 4)
  );
  const newsScore = clamp(
    input.baseScores.news +
      input.news.reduce((sum, item) => sum + item.impactScore * (item.relevance / 100), 0) / 12
  );
  const volatilityRisk = clamp(volatility * 14 + Math.abs(input.quote.changePercent) * 3);
  const liquidityRisk = clamp(
    input.quote.volume < 1000000 ? 78 : input.quote.volume < 5000000 ? 48 : input.quote.volume < 20000000 ? 24 : 12
  );
  const eventRisk = eventRiskScore(input.earningsDate, input.news, input.now);

  const opportunityTotal = Math.round(
    clamp(technical * 0.24 + fundamental * 0.22 + newsScore * 0.18 + sentiment * 0.16 + momentum * 0.2)
  );
  const riskTotal = Math.round(
    clamp(volatilityRisk * 0.34 + liquidityRisk * 0.24 + eventRisk * 0.24 + (100 - input.baseScores.risk) * 0.18)
  );
  const adjustedOpportunity = clamp(opportunityTotal - riskTotal * 0.28);
  let probabilityUp = Math.round(clamp(24 + adjustedOpportunity * 0.48 - riskTotal * 0.08, 5, 78));
  let probabilityDown = Math.round(clamp(18 + riskTotal * 0.42 - opportunityTotal * 0.08, 5, 78));

  if (probabilityUp + probabilityDown > 95) {
    const scale = 95 / (probabilityUp + probabilityDown);
    probabilityUp = Math.round(probabilityUp * scale);
    probabilityDown = 95 - probabilityUp;
  }

  const probabilitySideways = Math.max(5, 100 - probabilityUp - probabilityDown);

  return {
    technical: Math.round(technical),
    fundamental: Math.round(fundamental),
    news: Math.round(newsScore),
    sentiment: Math.round(sentiment),
    momentum: Math.round(momentum),
    volatilityRisk: Math.round(volatilityRisk),
    liquidityRisk: Math.round(liquidityRisk),
    eventRisk: Math.round(eventRisk),
    opportunityTotal,
    riskTotal,
    probabilityUp,
    probabilityDown,
    probabilitySideways,
    explanation: [
      `Volatilität ${volatility.toFixed(2)}% durchschnittliche Kerzenbewegung`,
      `Momentum ${momentumChange.toFixed(2)}% im betrachteten Zeitraum`,
      `Sentiment basiert auf ${input.news.length} nach Relevanz gewichteten Mock-News`,
      probabilityDisclaimer
    ]
  };
}
