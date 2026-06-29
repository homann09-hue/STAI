"use client";

import type { Candle } from "@/lib/types";

function getBounds(candles: Candle[]) {
  const values = candles.flatMap((candle) => [candle.high, candle.low, candle.close]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.12 || 1;
  return { min: min - padding, max: max + padding };
}

export function Sparkline({ candles, positive }: { candles: Candle[]; positive: boolean }) {
  const { min, max } = getBounds(candles);
  const width = 180;
  const height = 54;
  const points = candles
    .map((candle, index) => {
      const x = (index / Math.max(1, candles.length - 1)) * width;
      const y = height - ((candle.close - min) / (max - min)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible">
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

export function PriceLineChart({ candles }: { candles: Candle[] }) {
  const { min, max } = getBounds(candles);
  const width = 720;
  const height = 260;
  const points = candles
    .map((candle, index) => {
      const x = (index / Math.max(1, candles.length - 1)) * width;
      const y = height - ((candle.close - min) / (max - min)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  const last = candles[candles.length - 1];
  const first = candles[0];
  const positive = last.close >= first.close;

  return (
    <div className="overflow-hidden rounded-md border border-stroke bg-panel shadow-panel">
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[16/9] w-full">
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
            y1={height * line}
            y2={height * line}
            stroke="#22332d"
            strokeDasharray="8 8"
          />
        ))}
        <polygon points={area} fill="url(#priceArea)" />
        <polyline
          points={points}
          fill="none"
          stroke={positive ? "#35d07f" : "#ff5c5c"}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

export function CandlestickChart({ candles }: { candles: Candle[] }) {
  const visible = candles.slice(-34);
  const { min, max } = getBounds(visible);
  const width = 720;
  const height = 220;
  const slot = width / visible.length;

  return (
    <div className="rounded-md border border-stroke bg-panel p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Candlestick + Volumen</p>
        <p className="text-xs text-muted">Mock OHLC</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[16/7] w-full">
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
          const high = height - ((candle.high - min) / (max - min)) * height;
          const low = height - ((candle.low - min) / (max - min)) * height;
          const open = height - ((candle.open - min) / (max - min)) * height;
          const close = height - ((candle.close - min) / (max - min)) * height;
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
  return (
    <div className="rounded-md border border-stroke bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-mono text-2xl font-semibold text-mist">{score}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stroke">
        <div
          className="h-full rounded-full bg-gradient-to-r from-loss via-amber to-profit"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
