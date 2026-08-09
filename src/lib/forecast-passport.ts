import { buildAssetReadiness } from "@/lib/asset-readiness";
import type { AssetDetail, Candle, MarketDataQuality } from "@/lib/types";

export type ForecastPassportStatus = "ready" | "limited" | "blocked";
export type ForecastHorizon = "1W" | "1M" | "3M" | "12M";

export interface ForecastScenario {
  id: "bull" | "base" | "bear";
  label: string;
  horizon: ForecastHorizon;
  probability: number;
  projectedPrice: number | null;
  projectedReturnPercent: number | null;
  rationale: string;
}

export interface ForecastHorizonBand {
  horizon: ForecastHorizon;
  label: string;
  medianReturnPercent: number | null;
  lowerReturnPercent: number | null;
  upperReturnPercent: number | null;
  expectedVolatilityPercent: number | null;
  expectedDrawdownPercent: number | null;
}

export interface ForecastPassport {
  symbol: string;
  modelVersion: string;
  generatedAt: string;
  dataCutoff: string;
  status: ForecastPassportStatus;
  label: string;
  basePrice: number | null;
  currency: string;
  provider: string;
  quality: MarketDataQuality;
  confidence: number;
  qualityScore: number;
  probabilityUp: number;
  probabilityDown: number;
  probabilitySideways: number;
  bands: ForecastHorizonBand[];
  scenarios: ForecastScenario[];
  drivers: string[];
  risks: string[];
  blockers: string[];
  sources: string[];
  userMessage: string;
}

const MODEL_VERSION = "stockpilot-forecast-v1.0-deterministic";

function clamp(value: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}

function round(value: number, digits = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isUsableCandle(candle: Candle) {
  return (
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    candle.close > 0 &&
    candle.high >= candle.low
  );
}

function selectCandles(detail: AssetDetail) {
  const preferred = ["6M", "3M", "1M", "1Y", "5D", "5Y", "MAX", "1D", "1W", "YTD"] as const;

  for (const range of preferred) {
    const candles = (detail.candles[range] ?? []).filter(isUsableCandle);
    if (candles.length >= 8) return candles;
  }

  return Object.values(detail.candles)
    .flat()
    .filter(isUsableCandle)
    .slice(-90);
}

function normalizeProbabilities(up: number, down: number, sideways: number) {
  const raw = [up, down, sideways].map((value) => clamp(value, 0, 100));
  const total = raw.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { up: 34, down: 33, sideways: 33 };
  }

  const normalizedUp = Math.round((raw[0] / total) * 100);
  const normalizedDown = Math.round((raw[1] / total) * 100);
  const normalizedSideways = 100 - normalizedUp - normalizedDown;

  return {
    up: clamp(normalizedUp, 0, 100),
    down: clamp(normalizedDown, 0, 100),
    sideways: clamp(normalizedSideways, 0, 100)
  };
}

function dailyReturns(candles: Candle[]) {
  return candles
    .slice(1)
    .map((candle, index) => Math.log(candle.close / Math.max(0.0001, candles[index].close)))
    .filter(Number.isFinite);
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function maxDrawdown(candles: Candle[]) {
  if (!candles.length) return 0;
  let peak = candles[0].close;
  let drawdown = 0;

  candles.forEach((candle) => {
    peak = Math.max(peak, candle.close);
    drawdown = Math.min(drawdown, ((candle.close - peak) / Math.max(0.0001, peak)) * 100);
  });

  return drawdown;
}

function capConfidenceForQuality(confidence: number, quality: MarketDataQuality, status: ForecastPassportStatus) {
  if (status === "blocked") return 0;
  if (quality === "mock" || quality === "unavailable") return Math.min(confidence, 20);
  if (quality === "delayed" || quality === "historical") return Math.min(confidence, 65);
  if (status === "limited") return Math.min(confidence, 72);
  return confidence;
}

function qualityStatus(quality: MarketDataQuality) {
  return quality === "mock" || quality === "unavailable";
}

function horizonScale(horizon: ForecastHorizon) {
  if (horizon === "1W") return 0.2;
  if (horizon === "1M") return 0.45;
  if (horizon === "3M") return 0.85;
  return 1.9;
}

function horizonLabel(horizon: ForecastHorizon) {
  if (horizon === "1W") return "1 Woche";
  if (horizon === "1M") return "1 Monat";
  if (horizon === "3M") return "3 Monate";
  return "12 Monate";
}

function priceFromReturn(basePrice: number | null, returnPercent: number | null) {
  if (basePrice === null || returnPercent === null) return null;
  return round(basePrice * (1 + returnPercent / 100), 2);
}

export function buildForecastPassport(detail: AssetDetail, now = new Date()): ForecastPassport {
  const readiness = buildAssetReadiness(detail);
  const candles = selectCandles(detail);
  const returns = dailyReturns(candles);
  const basePrice = Number.isFinite(detail.quote.price) && detail.quote.price > 0 ? detail.quote.price : null;
  const dataCutoff = Number.isFinite(new Date(detail.quote.asOf).getTime()) ? new Date(detail.quote.asOf).toISOString() : now.toISOString();
  const probabilities = normalizeProbabilities(
    detail.professionalScores.probabilityUp,
    detail.professionalScores.probabilityDown,
    detail.professionalScores.probabilitySideways
  );
  const blockers = [
    readiness.status === "blocked" ? readiness.detail : null,
    qualityStatus(detail.quote.quality) ? "Kursdaten sind nicht verifiziert oder nicht verfügbar." : null,
    basePrice === null ? "Kein gültiger Basiskurs vorhanden." : null,
    candles.length < 8 ? "Nicht genügend historische Kerzen für eine belastbare Bandbreite." : null,
    ...readiness.missingAreas.map((area) => `Fehlt: ${area}.`),
    ...detail.dataQuality.issues,
    ...detail.dataQuality.contradictions
  ].filter((item): item is string => Boolean(item));
  const blocked =
    readiness.status === "blocked" ||
    detail.dataQuality.confidence < 30 ||
    qualityStatus(detail.quote.quality) ||
    basePrice === null ||
    candles.length < 8;
  const limited =
    !blocked &&
    (readiness.status === "limited" ||
      detail.quote.quality === "delayed" ||
      detail.quote.quality === "historical" ||
      detail.dataQuality.stale ||
      detail.dataQuality.confidence < 60 ||
      readiness.missingAreas.length > 0);
  const status: ForecastPassportStatus = blocked ? "blocked" : limited ? "limited" : "ready";
  const confidence = capConfidenceForQuality(
    Math.round(detail.dataQuality.confidence * 0.55 + detail.dataQuality.score * 0.35 + Math.min(100, candles.length) * 0.1),
    detail.quote.quality,
    status
  );
  const volatilityDaily = standardDeviation(returns);
  const volatilityAnnualPercent = returns.length >= 2 ? clamp(volatilityDaily * Math.sqrt(252) * 100, 2, 180) : null;
  const recentReturnPercent = candles.length >= 2 ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100 : 0;
  const probabilityBias = (probabilities.up - probabilities.down) / 100;
  const momentumBias = clamp(recentReturnPercent / 100, -0.25, 0.25);
  const expectedBaseReturn = clamp(probabilityBias * 8 + momentumBias * 12 + (detail.professionalScores.momentum - 50) / 12, -35, 35);
  const drawdownPercent = candles.length >= 2 ? maxDrawdown(candles) : 0;
  const horizons: ForecastHorizon[] = ["1W", "1M", "3M", "12M"];
  const bands = horizons.map((horizon) => {
    if (status === "blocked" || basePrice === null || volatilityAnnualPercent === null) {
      return {
        horizon,
        label: horizonLabel(horizon),
        medianReturnPercent: null,
        lowerReturnPercent: null,
        upperReturnPercent: null,
        expectedVolatilityPercent: null,
        expectedDrawdownPercent: null
      };
    }

    const scale = horizonScale(horizon);
    const dataPenalty = status === "limited" ? 1.3 : 1;
    const medianReturnPercent = round(expectedBaseReturn * scale);
    const rangeWidth = clamp((volatilityAnnualPercent / 100) * Math.sqrt(scale) * 100 * dataPenalty, 2.5, 85);

    return {
      horizon,
      label: horizonLabel(horizon),
      medianReturnPercent,
      lowerReturnPercent: round(medianReturnPercent - rangeWidth),
      upperReturnPercent: round(medianReturnPercent + rangeWidth),
      expectedVolatilityPercent: round(volatilityAnnualPercent * Math.sqrt(scale)),
      expectedDrawdownPercent: round(drawdownPercent * Math.sqrt(scale) * dataPenalty)
    };
  });
  const oneMonth = bands.find((band) => band.horizon === "1M") ?? bands[0];
  const sources = [
    `${detail.quote.provider}:quote:${dataCutoff}`,
    ...detail.dataQuality.sources.map((source) => `${source.name}:${source.type}:${source.status}:${source.fetchedAt}`),
    `${MODEL_VERSION}:derived:${now.toISOString()}`
  ];
  const scenarios: ForecastScenario[] = [
    {
      id: "bull",
      label: "Bull Case",
      horizon: oneMonth.horizon,
      probability: probabilities.up,
      projectedPrice: priceFromReturn(basePrice, oneMonth.upperReturnPercent),
      projectedReturnPercent: oneMonth.upperReturnPercent,
      rationale: "Positives Szenario, wenn Momentum, News-/Sentiment-Lage und Marktumfeld gleichzeitig tragen."
    },
    {
      id: "base",
      label: "Base Case",
      horizon: oneMonth.horizon,
      probability: probabilities.sideways,
      projectedPrice: priceFromReturn(basePrice, oneMonth.medianReturnPercent),
      projectedReturnPercent: oneMonth.medianReturnPercent,
      rationale: "Mittleres Szenario aus aktueller Score-Lage, historischer Volatilität und Datenkonfidenz."
    },
    {
      id: "bear",
      label: "Bear Case",
      horizon: oneMonth.horizon,
      probability: probabilities.down,
      projectedPrice: priceFromReturn(basePrice, oneMonth.lowerReturnPercent),
      projectedReturnPercent: oneMonth.lowerReturnPercent,
      rationale: "Negatives Szenario, falls Risiko-, Liquiditäts-, Ereignis- oder Trendfaktoren dominieren."
    }
  ];

  return {
    symbol: detail.asset.symbol,
    modelVersion: MODEL_VERSION,
    generatedAt: now.toISOString(),
    dataCutoff,
    status,
    label: status === "blocked" ? "Prognose blockiert" : status === "limited" ? "Prognose eingeschränkt" : "Prognose nutzbar",
    basePrice,
    currency: detail.asset.currency,
    provider: detail.quote.provider,
    quality: detail.quote.quality,
    confidence,
    qualityScore: readiness.qualityScore,
    probabilityUp: status === "blocked" ? 0 : probabilities.up,
    probabilityDown: status === "blocked" ? 0 : probabilities.down,
    probabilitySideways: status === "blocked" ? 0 : probabilities.sideways,
    bands,
    scenarios: status === "blocked" ? scenarios.map((scenario) => ({ ...scenario, projectedPrice: null, projectedReturnPercent: null })) : scenarios,
    drivers: detail.aiAnalysis.upsideDrivers.slice(0, 4),
    risks: [...detail.aiAnalysis.downsideDrivers, ...detail.riskReport.findings.map((finding) => finding.title)].slice(0, 5),
    blockers: [...new Set(blockers)].slice(0, 8),
    sources: [...new Set(sources)].slice(0, 10),
    userMessage:
      status === "blocked"
        ? "Für eine belastbare Prognose liegen derzeit nicht genügend verifizierte Daten vor. STAI zeigt deshalb nur Datenlücken, keine Kursbandbreite."
        : status === "limited"
          ? "Diese Prognose ist eine eingeschränkte, modellbasierte Schätzung. Datenqualität, Verzögerung und Quellenlage reduzieren die Aussagekraft."
          : "Diese Prognose ist eine modellbasierte Research-Schätzung mit Bandbreiten, Quellenstatus und Unsicherheit. Sie ist keine Anlageberatung."
  };
}
