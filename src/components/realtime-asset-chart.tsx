"use client";

import { useMemo, useState } from "react";
import { CandlestickChart, PriceLineChart } from "@/components/charts";
import { ConnectionBadge, DataQualityBadge, PriceChangeLabel, RealtimePrice } from "@/components/live-market-widgets";
import { NO_INDICATORS } from "@/lib/analysis/technical";
import { deriveIndicators, selectCandles } from "@/lib/chart-data";
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
const chartDateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Berlin"
});

function formatChartTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? chartDateTimeFormatter.format(date) : "Zeitpunkt nicht verfügbar";
}

export function RangeSelector({ value, onChange }: { value: UiRange; onChange: (range: UiRange) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-stroke bg-coal p-1" role="group" aria-label="Chart-Zeitraum wählen">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          aria-label={`Zeitraum ${range} anzeigen`}
          onClick={() => onChange(range)}
          className={`min-h-11 min-w-11 rounded-xl px-3 text-xs font-semibold transition ${
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
    <div className="flex gap-1 rounded-2xl border border-stroke bg-coal p-1" role="group" aria-label="Charttyp wählen">
      {chartTypes.map((type) => (
        <button
          key={type.key}
          type="button"
          aria-pressed={value === type.key}
          aria-label={`Charttyp ${type.label} anzeigen`}
          onClick={() => onChange(type.key)}
          className={`min-h-11 min-w-16 rounded-xl px-3 text-xs font-semibold transition ${
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

/**
 * Anzeige der Indikatoren.
 *
 * „Zu wenig Daten" steht bewusst da, wo vorher eine Zahl stand. Der Nutzer
 * erfährt damit den Grund und nicht bloß ein `n/a` — und die Zeile „Bollinger:
 * modelliert / vorbereitet" ist verschwunden, weil die Bänder jetzt gerechnet
 * werden.
 */
export function TechnicalIndicatorsPanel({ indicators, currency }: { indicators: TechnicalIndicators; currency: string }) {
  const tooShort = "Zu wenig Daten";
  const price = (value: number | null) => (value === null ? tooShort : formatCurrency(value, currency));
  const levels = (values: number[]) =>
    values.length ? values.map((value) => formatCurrency(value, currency)).join(" · ") : tooShort;

  const items: Array<[string, string]> = [
    ["RSI 14", indicators.rsi === null ? tooShort : indicators.rsi.toFixed(1)],
    ["SMA 20", price(indicators.movingAverages.ma20)],
    ["SMA 50", price(indicators.movingAverages.ma50)],
    ["SMA 200", price(indicators.movingAverages.ma200)],
    [
      "MACD",
      indicators.macd ? `${indicators.macd.value.toFixed(2)} / ${indicators.macd.signal.toFixed(2)}` : tooShort
    ],
    [
      "Bollinger",
      indicators.bollingerBands
        ? `${formatCurrency(indicators.bollingerBands.lower, currency)} – ${formatCurrency(indicators.bollingerBands.upper, currency)}`
        : tooShort
    ],
    ["Unterstützung", levels(indicators.support)],
    ["Widerstand", levels(indicators.resistance)]
  ];

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-stroke bg-panel/68 p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${value === tooShort ? "text-muted" : "text-mist"}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">
        {indicators.sampleSize === 0
          ? "Keine Kurshistorie verfügbar — es werden keine Indikatoren berechnet."
          : `Berechnet aus ${indicators.sampleSize} Kerzen.${
              indicators.unavailable.length ? ` Nicht berechenbar: ${indicators.unavailable.join(", ")}.` : ""
            }`}
      </p>
    </div>
  );
}

/**
 * Leeres Zeitfenster.
 *
 * Der Nutzer erfährt den Grund statt eine erfundene Kurve zu sehen. Beim
 * Tagesfenster ist der Grund ein anderer als sonst und wird deshalb auch
 * anders benannt: Tagesschlusskurse enthalten keinen Intraday-Verlauf.
 */
export function EmptyChartNotice({ range }: { range: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stroke bg-coal/40 p-6 text-center">
      <p className="text-sm font-semibold text-mist">Keine Kurshistorie für dieses Zeitfenster</p>
      <p className="mt-2 text-xs leading-5 text-muted">
        {range === "1T"
          ? "Der Anbieter liefert Tagesschlusskurse. Ein Intraday-Verlauf liegt damit nicht vor."
          : "Für dieses Instrument sind im aktuellen Anbietertarif keine historischen Kurse enthalten."}
        <br />
        Es wird bewusst kein Ersatzverlauf gezeichnet.
      </p>
    </div>
  );
}

export function VolumeBars({ candles }: { candles: Candle[] }) {
  const visible = candles
    .slice(-36)
    .map((candle) => ({
      ...candle,
      volume: Number.isFinite(candle.volume) && (candle.volume ?? 0) > 0 ? candle.volume : 0,
      open: Number.isFinite(candle.open) ? candle.open : candle.close,
      close: Number.isFinite(candle.close) ? candle.close : candle.open
    }));
  const maxVolume = Math.max(...visible.map((candle) => candle.volume ?? 0), 1);
  const lastVolume = visible[visible.length - 1]?.volume ?? 0;

  return (
    <div
      className="flex h-16 items-end gap-1 rounded-2xl border border-stroke bg-coal/70 p-2"
      role="img"
      aria-label={`Volumenbalken mit ${visible.length} Datenpunkten. Letztes Volumen ${formatCompact(lastVolume)}.`}
    >
      {visible.map((candle, index) => (
        <div
          key={`${candle.timestamp}-${index}`}
          aria-hidden="true"
          className={candle.close >= candle.open ? "flex-1 rounded-t bg-profit/35" : "flex-1 rounded-t bg-loss/35"}
          style={{ height: `${Math.min(100, Math.max(10, ((candle.volume ?? 0) / maxVolume) * 100))}%` }}
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
  const latency = typeof quote.latencyMs === "number" ? `${quote.latencyMs} ms` : "n/a";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-stroke bg-panel/60 p-3 text-xs text-muted">
      <ConnectionBadge status={connectionStatus} mode={refreshMode} intervalMs={intervalMs} />
      <DataQualityBadge quality={quote.quality} marketStatus={quote.marketStatus} />
      <span>Provider: {quote.provider}</span>
      <span>Last Updated: {formatChartTimestamp(timestamp)}</span>
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
  const mergedQuote = useMemo(
    () =>
      liveQuote
        ? {
            ...quote,
            price: liveQuote.price,
            change: liveQuote.change,
            changePercent: liveQuote.changePercent,
            asOf: liveQuote.timestamp,
            provider: liveQuote.provider,
            quality: liveQuote.quality,
            latencyMs: liveQuote.latencyMs ?? undefined,
            marketStatus: liveQuote.marketStatus,
            volume: liveQuote.volume ?? quote.volume,
            dayHigh: liveQuote.high ?? quote.dayHigh,
            dayLow: liveQuote.low ?? quote.dayLow,
            bid: liveQuote.bid ?? undefined,
            ask: liveQuote.ask ?? undefined,
            spread: liveQuote.spread ?? undefined
          }
        : quote,
    [liveQuote, quote]
  );
  const candles = useMemo(() => selectCandles(candlesByRange, range), [candlesByRange, range]);
  const activeIndicators = useMemo(
    () => indicators ?? (candles.length ? deriveIndicators(candles) : NO_INDICATORS),
    [candles, indicators]
  );

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

      {candles.length ? (
        <>
          {chartType === "candlestick" ? <CandlestickChart candles={candles} /> : <PriceLineChart candles={candles} />}
          <VolumeBars candles={candles} />
        </>
      ) : (
        <EmptyChartNotice range={range} />
      )}
      <TechnicalIndicatorsPanel indicators={activeIndicators} currency={asset.currency} />
      <ChartStatusBar quote={mergedQuote} connectionStatus={connectionStatus} refreshMode={refreshMode} intervalMs={intervalMs} />
    </section>
  );
}
