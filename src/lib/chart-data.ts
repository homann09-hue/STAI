import type { Asset, Candle, ChartRange, NormalizedQuote, Quote, TechnicalIndicators } from "@/lib/types";

type UiRange = "1T" | "1W" | "1M" | "3M" | "1J" | "5J" | "Alle";

export function rangeToDataKeys(range: UiRange): ChartRange[] {
  if (range === "1T") return ["1D"];
  if (range === "1W") return ["1W", "5D"];
  if (range === "3M") return ["3M", "6M"];
  if (range === "1J") return ["1Y", "YTD"];
  if (range === "5J") return ["5Y"];
  if (range === "Alle") return ["MAX"];
  return ["1M"];
}

export function fallbackCandles(asset: Asset, quote: Quote | NormalizedQuote, range: UiRange): Candle[] {
  const count = range === "1T" ? 36 : range === "1W" ? 48 : range === "Alle" ? 110 : 72;
  const timestamp = "timestamp" in quote ? quote.timestamp : quote.asOf;
  const base = quote.price - quote.change;
  const drift = quote.change / Math.max(1, count - 1);
  const volatility = Math.max(Math.abs(quote.change), quote.price * 0.006);

  return Array.from({ length: count }, (_, index) => {
    const close = base + drift * index + Math.sin(index * 0.71) * volatility * 0.24;
    const open = index === 0 ? close - drift : base + drift * Math.max(0, index - 1);

    return {
      symbol: asset.symbol,
      range: "1D",
      timestamp,
      time: index % 8 === 0 ? String(index) : "",
      open: Number(open.toFixed(2)),
      high: Number((Math.max(open, close) + volatility * 0.18).toFixed(2)),
      low: Number((Math.min(open, close) - volatility * 0.18).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round((quote.volume ?? 1000000) / count)
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
    if (candles?.length) return candles;
  }

  return fallbackCandles(asset, quote, range);
}

export function deriveIndicators(candles: Candle[]): TechnicalIndicators {
  const last = candles[candles.length - 1]?.close ?? 0;
  const average = (windowSize: number) => {
    const slice = candles.slice(-windowSize);
    return Number((slice.reduce((sum, candle) => sum + candle.close, 0) / Math.max(1, slice.length)).toFixed(2));
  };
  const gains = candles.slice(-14).filter((candle) => candle.close >= candle.open).length;
  const rsi = Math.round(30 + (gains / 14) * 45);

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
