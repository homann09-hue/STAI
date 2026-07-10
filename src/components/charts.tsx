"use client";

import type { Candle } from "@/lib/types";

const chartNumberFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 2
});

function formatChartNumber(value: number | undefined) {
  return Number.isFinite(value) ? chartNumberFormatter.format(value ?? 0) : "n/a";
}

function finiteNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function cleanCandles(candles: Candle[]) {
  return candles
    .filter((candle) => Number.isFinite(candle.close) && candle.close > 0)
    .map((candle) => {
      const close = finiteNumber(candle.close, 1);
      const open = finiteNumber(candle.open, close);
      const high = Math.max(open, close, finiteNumber(candle.high, close));
      const low = Math.min(open, close, finiteNumber(candle.low, close));

      return {
        ...candle,
        open,
        high,
        low,
        close,
        volume: Math.max(0, finiteNumber(candle.volume, 0))
      };
    });
}

function getBounds(candles: Candle[]) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const candle of candles) {
    min = Math.min(min, candle.high, candle.low, candle.close);
    max = Math.max(max, candle.high, candle.low, candle.close);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }

  const padding = (max - min) * 0.12 || 1;
  const paddedMin = min - padding;
  const paddedMax = max + padding;
  return paddedMax > paddedMin ? { min: paddedMin, max: paddedMax } : { min: 0, max: 1 };
}

function movingAverage(candles: Candle[], windowSize: number) {
  let rollingSum = 0;

  return candles.map((candle, index) => {
    rollingSum += candle.close;

    if (index >= windowSize) {
      rollingSum -= candles[index - windowSize].close;
    }

    return rollingSum / Math.min(index + 1, windowSize);
  });
}

function pointsFor(values: number[], min: number, max: number, width: number, height: number) {
  const cleanValues = values.filter(Number.isFinite);
  const spread = max - min || 1;

  return cleanValues
    .map((value, index) => {
      const x = (index / Math.max(1, cleanValues.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function Sparkline({ candles, positive }: { candles: Candle[]; positive: boolean }) {
  const clean = cleanCandles(candles);

  if (!clean.length) {
    return (
      <div className="h-14 w-full rounded-md border border-dashed border-stroke bg-panel/45" aria-hidden="true" />
    );
  }

  const { min, max } = getBounds(clean);
  const width = 180;
  const height = 54;
  const spread = max - min || 1;
  const points = clean
    .map((candle, index) => {
      const x = (index / Math.max(1, clean.length - 1)) * width;
      const y = height - ((candle.close - min) / spread) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible" aria-hidden="true" focusable="false">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#35d07f" : "#ff5c5c"}
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

type PriceLineChartProps = {
  candles: Candle[];
  benchmarkCandles?: Candle[];
  benchmarkLabel?: string;
  showBenchmark?: boolean;
  showSma?: boolean;
  showVolume?: boolean;
  showCrosshair?: boolean;
};

export function PriceLineChart({
  candles,
  benchmarkCandles = [],
  benchmarkLabel = "Benchmark",
  showBenchmark = false,
  showSma = true,
  showVolume = true,
  showCrosshair = true
}: PriceLineChartProps) {
  const clean = cleanCandles(candles);

  if (!clean.length) {
    return (
      <div className="overflow-hidden rounded-md border border-stroke bg-panel p-4 text-sm text-muted shadow-panel" role="status">
        Keine Chartdaten verfügbar.
      </div>
    );
  }

  const { min, max } = getBounds(clean);
  const width = 720;
  const height = 260;
  const volumeHeight = 54;
  const chartHeight = height - volumeHeight;
  const spread = max - min || 1;
  const points = clean
    .map((candle, index) => {
      const x = (index / Math.max(1, clean.length - 1)) * width;
      const y = chartHeight - ((candle.close - min) / spread) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `0,${chartHeight} ${points} ${width},${chartHeight}`;
  const last = clean[clean.length - 1];
  const first = clean[0];
  const positive = last.close >= first.close;
  const chartDescription = `Linienchart mit ${clean.length} Datenpunkten. Startkurs ${formatChartNumber(first.close)}, letzter Kurs ${formatChartNumber(last.close)}, Hoch ${formatChartNumber(max)}, Tief ${formatChartNumber(min)}. Trend ${positive ? "positiv" : "negativ"}.`;
  const maxVolume = Math.max(...clean.map((candle) => candle.volume ?? 0), 1);
  const ma20 = pointsFor(movingAverage(clean, 20), min, max, width, chartHeight);
  const ma50 = pointsFor(movingAverage(clean, 50), min, max, width, chartHeight);
  const ma200 = pointsFor(movingAverage(clean, 200), min, max, width, chartHeight);
  const benchmarkWindow = cleanCandles(benchmarkCandles).slice(-clean.length);
  const benchmarkBase = benchmarkWindow[0]?.close || 0;
  const normalizedBenchmark = benchmarkBase
    ? benchmarkWindow.map((candle) => first.close * (candle.close / benchmarkBase))
    : [];
  const benchmarkPoints = normalizedBenchmark.length
    ? pointsFor(normalizedBenchmark, min, max, width, chartHeight)
    : "";
  const lastY = chartHeight - ((last.close - min) / spread) * chartHeight;
  const labelParts = [
    showVolume ? "Volumen" : null,
    showSma ? "SMA 20 50 200" : null,
    showBenchmark && benchmarkPoints ? benchmarkLabel : null
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-md border border-stroke bg-panel shadow-panel">
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[16/9] w-full" role="img" aria-label={chartDescription}>
        <title>{chartDescription}</title>
        <defs>
          <linearGradient id="priceArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={positive ? "#35d07f" : "#ff5c5c"} stopOpacity="0.35" />
            <stop offset="100%" stopColor={positive ? "#35d07f" : "#ff5c5c"} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1="0"
            x2={width}
            y1={chartHeight * line}
            y2={chartHeight * line}
            stroke="#22332d"
            strokeDasharray="8 8"
          />
        ))}
        {showVolume ? clean.map((candle, index) => {
          const slot = width / clean.length;
          const barHeight = ((candle.volume ?? 0) / maxVolume) * (volumeHeight - 10);
          return (
            <rect
              key={`${candle.timestamp}-volume-${index}`}
              x={index * slot}
              y={height - barHeight}
              width={Math.max(1, slot * 0.62)}
              height={barHeight}
              fill={candle.close >= candle.open ? "#35d07f" : "#ff5c5c"}
              opacity="0.2"
            />
          );
        }) : null}
        <polygon points={area} fill="url(#priceArea)" />
        {showSma ? (
          <>
            <polyline points={ma20} fill="none" stroke="#78e7ff" strokeLinecap="round" strokeWidth="1.8" opacity="0.78" />
            <polyline points={ma50} fill="none" stroke="#f5c542" strokeLinecap="round" strokeWidth="1.5" opacity="0.72" />
            <polyline points={ma200} fill="none" stroke="#c58cff" strokeLinecap="round" strokeWidth="1.3" opacity="0.58" />
          </>
        ) : null}
        {showBenchmark && benchmarkPoints ? (
          <polyline points={benchmarkPoints} fill="none" stroke="#8aa4ff" strokeDasharray="10 7" strokeLinecap="round" strokeWidth="2.2" opacity="0.82" />
        ) : null}
        <polyline
          points={points}
          fill="none"
          stroke={positive ? "#35d07f" : "#ff5c5c"}
          strokeLinecap="round"
          strokeWidth="4"
        />
        {showCrosshair ? (
          <g>
            <line x1={width - 1} x2={width - 1} y1="0" y2={chartHeight} stroke="#e5f3ff" strokeDasharray="4 6" opacity="0.32" />
            <circle cx={width - 1} cy={lastY} r="5" fill={positive ? "#35d07f" : "#ff5c5c"} stroke="#07111f" strokeWidth="2" />
            <text x={width - 126} y={Math.max(18, lastY - 10)} fill="#e5f3ff" fontSize="12">
              {formatChartNumber(last.close)}
            </text>
          </g>
        ) : null}
        <text x="12" y={height - 12} fill="#88918d" fontSize="12">
          {labelParts.join(" / ") || "Preisverlauf"}
        </text>
      </svg>
    </div>
  );
}

export function CandlestickChart({ candles }: { candles: Candle[] }) {
  const clean = cleanCandles(candles);

  if (!clean.length) {
    return (
      <div className="rounded-md border border-stroke bg-panel p-4 text-sm text-muted" role="status">
        Keine Candlestick-Daten verfügbar.
      </div>
    );
  }

  const visible = clean.slice(-34);
  const { min, max } = getBounds(visible);
  const width = 720;
  const height = 220;
  const slot = width / visible.length;
  const spread = max - min || 1;
  const first = visible[0];
  const last = visible[visible.length - 1];
  const positive = last.close >= first.open;
  const chartDescription = `Candlestick-Chart mit ${visible.length} Kerzen. Eröffnung ${formatChartNumber(first.open)}, letzter Schlusskurs ${formatChartNumber(last.close)}, Hoch ${formatChartNumber(max)}, Tief ${formatChartNumber(min)}. Trend ${positive ? "positiv" : "negativ"}.`;

  return (
    <div className="rounded-md border border-stroke bg-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Candlestick + Volumen</p>
        <p className="text-xs text-muted">OHLC, Provider-Qualität siehe Kursbadge</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[16/7] w-full" role="img" aria-label={chartDescription}>
        <title>{chartDescription}</title>
        {[0.25, 0.5, 0.75].map((line) => (
          <line
            key={line}
            x1="0"
            x2={width}
            y1={height * line}
            y2={height * line}
            stroke="#22332d"
            strokeDasharray="8 8"
          />
        ))}
        {visible.map((candle, index) => {
          const x = index * slot + slot / 2;
          const high = height - ((candle.high - min) / spread) * height;
          const low = height - ((candle.low - min) / spread) * height;
          const open = height - ((candle.open - min) / spread) * height;
          const close = height - ((candle.close - min) / spread) * height;
          const green = candle.close >= candle.open;
          const bodyTop = Math.min(open, close);
          const bodyHeight = Math.max(3, Math.abs(close - open));
          const barHeight = Math.min(44, candle.volume / 120000);

          return (
            <g key={`${candle.time}-${index}`}>
              <rect
                x={x - slot * 0.28}
                y={height - barHeight}
                width={Math.max(2, slot * 0.56)}
                height={barHeight}
                fill="#78e7ff"
                opacity="0.18"
              />
              <line
                x1={x}
                x2={x}
                y1={high}
                y2={low}
                stroke={green ? "#35d07f" : "#ff5c5c"}
                strokeWidth="2"
              />
              <rect
                x={x - slot * 0.25}
                y={bodyTop}
                width={Math.max(3, slot * 0.5)}
                height={bodyHeight}
                rx="2"
                fill={green ? "#35d07f" : "#ff5c5c"}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ScoreMeter({ score, label }: { score: number; label: string }) {
  const safeScore = Math.round(Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0)));

  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-mono text-2xl font-semibold text-mist">{safeScore}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stroke">
        <div
          role="meter"
          aria-label={`${label}: ${safeScore} von 100`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeScore}
          className="h-full rounded-full bg-gradient-to-r from-loss via-amber to-profit"
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}
