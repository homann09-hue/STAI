"use client";

import { useMemo, useState } from "react";
import { CandlestickChart, PriceLineChart } from "@/components/charts";
import { ConnectionBadge, DataQualityBadge, PriceChangeLabel, RealtimePrice } from "@/components/live-market-widgets";
import { formatCompact, formatCurrency } from "@/lib/scoring";
import type { Asset, Candle, ChartRange, MarketConnectionStatus, NormalizedQuote, Quote, RefreshInterval, RefreshMode, TechnicalIndicators } from "@/lib/types";

type UiRange = "1T" | "1W" | "1M" | "3M" | "1J" | "5J" | "Alle";
type ChartType = "line" | "area" | "candlestick";

const ranges: UiRange[] = ["1T", "1W", "1M", "3M", "1J", "5J", "Alle"];
const chartTypes: Array<{ key: ChartType; label: string }> = [
  { key: "area", label: "Area" },
  { key: "line", label: "Linie" },
  { key: "candlestick", label: "Candle" }
];

function rangeToDataKeys(range: UiRange): ChartRange[] {
  if (range === "1T") return ["1D"];
  if (range === "1W") return ["1W", "5D"];
  if (range === "3M") return ["3M", "6M"];
  if (range === "1J") return ["1Y", "YTD"];
  if (range === "5J") return ["5Y"];
  if (range === "Alle") return ["MAX"];
  return ["1M"];
}

function fallbackCandles(asset: Asset, quote: Quote | NormalizedQuote, range: UiRange): Candle[] {
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

function selectCandles(candlesByRange: Partial<Record<ChartRange, Candle[]>> | undefined, asset: Asset, quote: Quote | NormalizedQuote, range: UiRange) {
  for (const key of rangeToDataKeys(range)) {
    const candles = candlesByRange?.[key];
    if (candles?.length) return candles;
  }

  return fallbackCandles(asset, quote, range);
}

function deriveIndicators(candles: Candle[]): TechnicalIndicators {
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

export function RangeSelector({ value, onChange }: { value: UiRange; onChange: (range: UiRange) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-stroke bg-coal p-1">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
            value === range ? "bg-profit/15 text-profit" : "text-muted hover:bg-panel hover:text-mist"
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}

export function ChartTypeToggle({ value, onChange }: { value: ChartType; onChange: (type: ChartType) => void }) {
  return (
    <div className="flex gap-1 rounded-2xl border border-stroke bg-coal p-1">
      {chartTypes.map((type) => (
        <button
          key={type.key}
          type="button"
          onClick={() => onChange(type.key)}
          className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
            value === type.key ? "bg-cyan/15 text-cyan" : "text-muted hover:bg-panel hover:text-mist"
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

export function ChartToolbar({
  range,
  chartType,
  onRangeChange,
  onChartTypeChange
}: {
  range: UiRange;
  chartType: ChartType;
  onRangeChange: (range: UiRange) => void;
  onChartTypeChange: (type: ChartType) => void;
}) {
  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <RangeSelector value={range} onChange={onRangeChange} />
      <ChartTypeToggle value={chartType} onChange={onChartTypeChange} />
    </div>
  );
}

export function TechnicalIndicatorsPanel({ indicators, currency }: { indicators: TechnicalIndicators; currency: string }) {
  const items = [
    ["RSI", indicators.rsi],
    ["SMA 20", formatCurrency(indicators.movingAverages.ma20, currency)],
    ["SMA 50", formatCurrency(indicators.movingAverages.ma50, currency)],
    ["SMA 200", formatCurrency(indicators.movingAverages.ma200, currency)],
    ["MACD", `${indicators.macd.value} / ${indicators.macd.signal}`],
    ["Bollinger", "vorbereitet"],
    ["Support", indicators.support.map((value) => formatCurrency(value, currency)).join(" · ")],
    ["Resistance", indicators.resistance.map((value) => formatCurrency(value, currency)).join(" · ")]
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-stroke bg-panel/68 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
          <p className="mt-1 text-sm font-semibold text-mist">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function VolumeBars({ candles }: { candles: Candle[] }) {
  const visible = candles.slice(-36);
  const maxVolume = Math.max(...visible.map((candle) => candle.volume ?? 0), 1);

  return (
    <div className="flex h-16 items-end gap-1 rounded-2xl border border-stroke bg-coal/70 p-2">
      {visible.map((candle, index) => (
        <div
          key={`${candle.timestamp}-${index}`}
          className={candle.close >= candle.open ? "flex-1 rounded-t bg-profit/35" : "flex-1 rounded-t bg-loss/35"}
          style={{ height: `${Math.max(10, ((candle.volume ?? 0) / maxVolume) * 100)}%` }}
          title={`Volumen ${formatCompact(candle.volume ?? 0)}`}
        />
      ))}
    </div>
  );
}

export function ChartStatusBar({
  quote,
  connectionStatus,
  refreshMode,
  intervalMs
}: {
  quote: Quote | NormalizedQuote;
  connectionStatus: MarketConnectionStatus;
  refreshMode: RefreshMode;
  intervalMs: RefreshInterval;
}) {
  const timestamp = "timestamp" in quote ? quote.timestamp : quote.asOf;
  const latency = quote.latencyMs !== undefined ? `${quote.latencyMs} ms` : "n/a";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stroke bg-panel/60 p-3 text-xs text-muted">
      <ConnectionBadge status={connectionStatus} mode={refreshMode} intervalMs={intervalMs} />
      <DataQualityBadge quality={quote.quality} marketStatus={quote.marketStatus} />
      <span>Provider: {quote.provider}</span>
      <span>Last Updated: {new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "medium" }).format(new Date(timestamp))}</span>
      <span>Latency: {latency}</span>
    </div>
  );
}

export function RealtimeAssetChart({
  asset,
  quote,
  liveQuote,
  candlesByRange,
  indicators,
  connectionStatus = "polling",
  refreshMode = "polling",
  intervalMs = 10000
}: {
  asset: Asset;
  quote: Quote;
  liveQuote?: NormalizedQuote;
  candlesByRange?: Partial<Record<ChartRange, Candle[]>>;
  indicators?: TechnicalIndicators;
  connectionStatus?: MarketConnectionStatus;
  refreshMode?: RefreshMode;
  intervalMs?: RefreshInterval;
}) {
  const [range, setRange] = useState<UiRange>("1T");
  const [chartType, setChartType] = useState<ChartType>("area");
  const mergedQuote = liveQuote
    ? {
        ...quote,
        price: liveQuote.price,
        change: liveQuote.change,
        changePercent: liveQuote.changePercent,
        asOf: liveQuote.timestamp,
        provider: liveQuote.provider,
        quality: liveQuote.quality,
        latencyMs: liveQuote.latencyMs,
        marketStatus: liveQuote.marketStatus,
        volume: liveQuote.volume ?? quote.volume,
        dayHigh: liveQuote.high ?? quote.dayHigh,
        dayLow: liveQuote.low ?? quote.dayLow,
        bid: liveQuote.bid,
        ask: liveQuote.ask,
        spread: liveQuote.spread
      }
    : quote;
  const candles = useMemo(() => selectCandles(candlesByRange, asset, mergedQuote, range), [asset, candlesByRange, mergedQuote, range]);
  const activeIndicators = indicators ?? deriveIndicators(candles);

  return (
    <section className="space-y-4 rounded-[2rem] border border-stroke bg-[radial-gradient(circle_at_20%_0%,rgba(39,224,183,0.16),transparent_28%),linear-gradient(145deg,rgba(10,15,24,0.98),rgba(4,7,12,0.98))] p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-2xl font-semibold text-mist sm:text-3xl">{asset.symbol}</h2>
            <DataQualityBadge quality={mergedQuote.quality} marketStatus={mergedQuote.marketStatus} />
            <span className="rounded-full border border-stroke bg-coal px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted">{asset.type}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{asset.name} · {asset.exchange}</p>
        </div>
        <div className="text-left xl:text-right">
          <RealtimePrice price={mergedQuote.price} currency={asset.currency} />
          <div className="mt-1">
            <PriceChangeLabel change={mergedQuote.change} changePercent={mergedQuote.changePercent} currency={asset.currency} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Hoch/Tief {formatCurrency(mergedQuote.dayHigh, asset.currency)} / {formatCurrency(mergedQuote.dayLow, asset.currency)}
          </p>
        </div>
      </div>

      <ChartToolbar range={range} chartType={chartType} onRangeChange={setRange} onChartTypeChange={setChartType} />

      {chartType === "candlestick" ? <CandlestickChart candles={candles} /> : <PriceLineChart candles={candles} />}
      <VolumeBars candles={candles} />
      <TechnicalIndicatorsPanel indicators={activeIndicators} currency={asset.currency} />
      <ChartStatusBar quote={mergedQuote} connectionStatus={connectionStatus} refreshMode={refreshMode} intervalMs={intervalMs} />
    </section>
  );
}
