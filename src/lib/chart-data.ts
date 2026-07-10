import type { Asset, Candle, ChartRange, NormalizedQuote, Quote, TechnicalIndicators } from "@/lib/types";

type UiRange = "1T" | "1W" | "1M" | "3M" | "1J" | "5J" | "Alle";
const MAX_CLEAN_CANDLES = 2000;

function finiteNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveNumber(value: number | undefined, fallback: number) {
  const parsed = finiteNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function safeTimestamp(value: string | undefined) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function cleanCandles(candles: Candle[]) {
  return candles
    .slice(-MAX_CLEAN_CANDLES)
    .filter((candle) => Number.isFinite(candle.close) && candle.close > 0)
    .map((candle) => {
      const close = positiveNumber(candle.close, 1);
      const open = positiveNumber(candle.open, close);
      const high = Math.max(open, close, finiteNumber(candle.high, close));
      const low = Math.max(0.01, Math.min(open, close, finiteNumber(candle.low, close)));

      return {
        ...candle,
        timestamp: safeTimestamp(candle.timestamp),
        open,
        high,
        low,
        close,
        volume: Math.max(0, finiteNumber(candle.volume, 0))
      };
    })
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

export function rangeToDataKeys(range: UiRange): ChartRange[] {
  if (range === "1T") return ["1D"];
  if (range === "1W") return ["1W", "5D"];
  if (range === "3M") return ["3M", "6M"];
  if (range === "1J") return ["1Y", "YTD"];
  if (range === "5J") return ["5Y"];
  if (range === "Alle") return ["MAX"];
  return ["1M"];
}

function fallbackRange(range: UiRange): ChartRange {
  return rangeToDataKeys(range)[0] ?? "1M";
}

function fallbackStepMs(range: UiRange) {
  if (range === "1T") return 1000 * 60 * 10;
  if (range === "1W") return 1000 * 60 * 60 * 3;
  if (range === "1M") return 1000 * 60 * 60 * 10;
  if (range === "3M") return 1000 * 60 * 60 * 24;
  if (range === "1J") return 1000 * 60 * 60 * 24 * 5;
  if (range === "5J") return 1000 * 60 * 60 * 24 * 20;
  return 1000 * 60 * 60 * 24 * 45;
}

export function fallbackCandles(asset: Asset, quote: Quote | NormalizedQuote, range: UiRange): Candle[] {
  const count = range === "1T" ? 36 : range === "1W" ? 48 : range === "Alle" ? 110 : 72;
  const anchorTimestamp = new Date(safeTimestamp("timestamp" in quote ? quote.timestamp : quote.asOf)).getTime();
  const stepMs = fallbackStepMs(range);
  const chartRange = fallbackRange(range);
  const price = positiveNumber(quote.price, 1);
  const change = finiteNumber(quote.change, 0);
  const base = Math.max(0.01, price - change);
  const drift = change / Math.max(1, count - 1);
  const volatility = Math.max(Math.abs(change), price * 0.006, 0.01);
  const volume = Math.max(0, finiteNumber(quote.volume, 1000000));

  return Array.from({ length: count }, (_, index) => {
    const close = Math.max(0.01, base + drift * index + Math.sin(index * 0.71) * volatility * 0.24);
    const open = Math.max(0.01, index === 0 ? close - drift : base + drift * Math.max(0, index - 1));
    const high = Math.max(open, close) + volatility * 0.18;
    const low = Math.max(0.01, Math.min(open, close) - volatility * 0.18);

    return {
      symbol: asset.symbol,
      range: chartRange,
      timestamp: new Date(anchorTimestamp - (count - 1 - index) * stepMs).toISOString(),
      time: index % 8 === 0 ? String(index) : "",
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(volume / count)
    };
  });
}

export function selectCandles(
  candlesByRange: Partial<Record<ChartRange, Candle[]>> | undefined,
  asset: Asset,
  quote: Quote | NormalizedQuote,
  range: UiRange
) {
  for (const key of rangeToDataKeys(range)) {
    const candles = candlesByRange?.[key];
    const clean = candles?.length ? cleanCandles(candles) : [];
    if (clean.length) return clean;
  }

  return fallbackCandles(asset, quote, range);
}

export function deriveIndicators(candles: Candle[]): TechnicalIndicators {
  const clean = cleanCandles(candles);
  const last = clean[clean.length - 1]?.close ?? 0;

  if (!clean.length || last <= 0) {
    return {
      rsi: 50,
      macd: {
        value: 0,
        signal: 0,
        histogram: 0
      },
      movingAverages: {
        ma20: 0,
        ma50: 0,
        ma200: 0
      },
      bollingerBands: {
        upper: 0,
        middle: 0,
        lower: 0
      },
      support: [],
      resistance: []
    };
  }

  const average = (windowSize: number) => {
    const slice = clean.slice(-windowSize);
    return Number((slice.reduce((sum, candle) => sum + candle.close, 0) / Math.max(1, slice.length)).toFixed(2));
  };
  const rsiWindow = clean.slice(-14);
  const gains = rsiWindow.filter((candle) => candle.close >= candle.open).length;
  const rsi = rsiWindow.length ? Math.round(30 + (gains / rsiWindow.length) * 45) : 50;

  return {
    rsi,
    macd: {
      value: Number(((average(12) - average(26)) || 0).toFixed(2)),
      signal: Number(((average(9) - last) * 0.05).toFixed(2)),
      histogram: Number(((average(12) - average(26)) * 0.35).toFixed(2))
    },
    movingAverages: {
      ma20: average(20),
      ma50: average(50),
      ma200: average(200)
    },
    bollingerBands: {
      upper: Number((average(20) * 1.035).toFixed(2)),
      middle: average(20),
      lower: Number((average(20) * 0.965).toFixed(2))
    },
    support: [Number((last * 0.96).toFixed(2)), Number((last * 0.92).toFixed(2))],
    resistance: [Number((last * 1.04).toFixed(2)), Number((last * 1.08).toFixed(2))]
  };
}
