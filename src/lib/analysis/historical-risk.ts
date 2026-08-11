import type { Candle, HistoricalRiskMetrics } from "@/lib/types";

const DEFAULT_TRADING_DAYS = 252;
const DEFAULT_MINIMUM_RETURNS = 60;
const DEFAULT_RISK_FREE_RATE_PERCENT = 0;

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function quantile(sorted: readonly number[], probability: number) {
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(probability * sorted.length)));
  return sorted[index];
}

function standardDeviation(values: readonly number[]) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function usableCandles(candles: readonly Candle[]) {
  const byTimestamp = new Map<number, Candle>();
  for (const candle of candles) {
    const timestamp = new Date(candle.timestamp || candle.time).getTime();
    if (!Number.isFinite(timestamp) || !Number.isFinite(candle.close) || candle.close <= 0) continue;
    byTimestamp.set(timestamp, candle);
  }
  return [...byTimestamp.entries()].sort(([left], [right]) => left - right).map(([, candle]) => candle);
}

function emptyMetrics(): HistoricalRiskMetrics["metrics"] {
  return {
    totalReturnPercent: null,
    annualizedReturnPercent: null,
    annualizedVolatilityPercent: null,
    downsideVolatilityPercent: null,
    maxDrawdownPercent: null,
    sharpeRatio: null,
    sortinoRatio: null,
    calmarRatio: null,
    valueAtRisk95Percent: null,
    conditionalValueAtRisk95Percent: null
  };
}

export function calculateHistoricalRiskMetrics(input: {
  candles: readonly Candle[];
  provider: string | null;
  integrityBlocked?: boolean;
  tradingDays?: number;
  minimumReturns?: number;
  riskFreeRatePercent?: number;
}): HistoricalRiskMetrics {
  const tradingDays = input.tradingDays ?? DEFAULT_TRADING_DAYS;
  const minimumReturns = input.minimumReturns ?? DEFAULT_MINIMUM_RETURNS;
  const riskFreeRatePercent = input.riskFreeRatePercent ?? DEFAULT_RISK_FREE_RATE_PERCENT;
  const candles = usableCandles(input.candles);
  const asOf = candles.at(-1)?.timestamp || candles.at(-1)?.time || new Date(0).toISOString();
  const returns = candles.slice(1).map((candle, index) => candle.close / candles[index].close - 1);
  const unavailable = !input.provider || input.integrityBlocked;
  const insufficient = returns.length < minimumReturns;

  if (unavailable || insufficient) {
    return {
      status: unavailable ? "unavailable" : "insufficient_data",
      provider: input.provider ?? "Kein verifizierter Historienprovider",
      quality: "unavailable",
      asOf,
      sampleSize: returns.length,
      tradingDays,
      riskFreeRatePercent,
      minimumReturns,
      metrics: emptyMetrics(),
      warnings: [
        input.integrityBlocked
          ? "Die Historie hat die Integritätsprüfung nicht bestanden."
          : !input.provider
            ? "Kein verifizierter Historienprovider verfügbar."
            : `Nur ${returns.length} von mindestens ${minimumReturns} Renditebeobachtungen verfügbar.`
      ]
    };
  }

  const first = candles[0].close;
  const last = candles.at(-1)?.close ?? first;
  const totalReturn = last / first - 1;
  const annualizedReturn = (last / first) ** (tradingDays / returns.length) - 1;
  const dailyMean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const dailyVolatility = standardDeviation(returns);
  const downsideReturns = returns.map((value) => Math.min(0, value));
  const downsideDeviation = Math.sqrt(
    downsideReturns.reduce((sum, value) => sum + value ** 2, 0) / downsideReturns.length
  );
  const annualizedVolatility = dailyVolatility === null ? null : dailyVolatility * Math.sqrt(tradingDays);
  const annualizedDownside = downsideDeviation * Math.sqrt(tradingDays);
  const annualizedExcessReturn = dailyMean * tradingDays - riskFreeRatePercent / 100;

  let peak = first;
  let maxDrawdown = 0;
  for (const candle of candles) {
    peak = Math.max(peak, candle.close);
    maxDrawdown = Math.min(maxDrawdown, candle.close / peak - 1);
  }

  const sortedReturns = [...returns].sort((left, right) => left - right);
  const tailThreshold = quantile(sortedReturns, 0.05);
  const tail = tailThreshold === null ? [] : sortedReturns.filter((value) => value <= tailThreshold);
  const cvar = tail.length ? tail.reduce((sum, value) => sum + value, 0) / tail.length : null;

  return {
    status: "available",
    provider: input.provider ?? "Kein verifizierter Historienprovider",
    quality: "historical",
    asOf,
    sampleSize: returns.length,
    tradingDays,
    riskFreeRatePercent,
    minimumReturns,
    metrics: {
      totalReturnPercent: round(totalReturn * 100),
      annualizedReturnPercent: round(annualizedReturn * 100),
      annualizedVolatilityPercent: annualizedVolatility === null ? null : round(annualizedVolatility * 100),
      downsideVolatilityPercent: round(annualizedDownside * 100),
      maxDrawdownPercent: round(maxDrawdown * 100),
      sharpeRatio: annualizedVolatility && annualizedVolatility > 0 ? round(annualizedExcessReturn / annualizedVolatility) : null,
      sortinoRatio: annualizedDownside > 0 ? round(annualizedExcessReturn / annualizedDownside) : null,
      calmarRatio: maxDrawdown < 0 ? round(annualizedReturn / Math.abs(maxDrawdown)) : null,
      valueAtRisk95Percent: tailThreshold === null ? null : round(Math.max(0, -tailThreshold * 100)),
      conditionalValueAtRisk95Percent: cvar === null ? null : round(Math.max(0, -cvar * 100))
    },
    warnings: [
      `Sharpe und Sortino verwenden einen transparenten risikofreien Modellzins von ${riskFreeRatePercent.toFixed(2)} %.`,
      "VaR und CVaR sind historische Ein-Tages-Schätzungen und keine Verlustobergrenzen."
    ]
  };
}
