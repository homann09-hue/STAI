import { Activity, BarChart3, LineChart, Radar, Waves } from "lucide-react";
import { calculateVolatility, formatCompact, formatCurrency, formatPercent } from "@/lib/scoring";
import type { AssetDetail, Candle } from "@/lib/types";

function rangeMomentum(candles: Candle[]) {
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) return 0;
  return ((last.close - first.close) / Math.max(first.close, 0.01)) * 100;
}

function trendFromMomentum(value: number) {
  if (value >= 4) return "Aufwaertstrend";
  if (value <= -4) return "Abwaertstrend";
  return "Seitwaerts";
}

function volumeTrend(candles: Candle[]) {
  if (candles.length < 8) return 0;
  const half = Math.floor(candles.length / 2);
  const older = candles.slice(0, half).reduce((sum, candle) => sum + (candle.volume ?? 0), 0) / half;
  const newer = candles.slice(half).reduce((sum, candle) => sum + (candle.volume ?? 0), 0) / Math.max(1, candles.length - half);
  return older ? ((newer - older) / older) * 100 : 0;
}

function signalColor(label: string) {
  if (label.includes("Aufwaerts") || label.includes("bullisch")) return "text-profit";
  if (label.includes("Abwaerts") || label.includes("ueberhitzt") || label.includes("bearisch")) return "text-loss";
  return "text-amber";
}

export function TechnicalTrendPanel({ detail }: { detail: AssetDetail }) {
  const shortMomentum = rangeMomentum(detail.candles["1D"]);
  const midMomentum = rangeMomentum(detail.candles["1M"]);
  const longMomentum = rangeMomentum(detail.candles["1Y"]);
  const volatility = calculateVolatility(detail.candles["1M"]);
  const volumeChange = volumeTrend(detail.candles["1M"]);
  const dayRange = detail.quote.dayHigh - detail.quote.dayLow;
  const smaSignal =
    detail.indicators.movingAverages.ma20 > detail.indicators.movingAverages.ma50 &&
    detail.indicators.movingAverages.ma50 > detail.indicators.movingAverages.ma200
      ? "SMA-Struktur bullisch"
      : detail.indicators.movingAverages.ma20 < detail.indicators.movingAverages.ma50
        ? "SMA-Struktur bearisch"
        : "SMA-Struktur neutral";
  const rsiSignal = detail.indicators.rsi > 70 ? "RSI ueberhitzt" : detail.indicators.rsi < 30 ? "RSI schwach" : "RSI neutral";
  const macdSignal = detail.indicators.macd.histogram >= 0 ? "MACD positiv vorbereitet" : "MACD negativ vorbereitet";

  const cards = [
    { label: "Kurzfristiger Trend", value: trendFromMomentum(shortMomentum), detail: formatPercent(shortMomentum), icon: Activity },
    { label: "Mittelfristiger Trend", value: trendFromMomentum(midMomentum), detail: formatPercent(midMomentum), icon: LineChart },
    { label: "Langfristiger Trend", value: trendFromMomentum(longMomentum), detail: formatPercent(longMomentum), icon: Radar },
    { label: "Volatilitaet", value: `${volatility.toFixed(2)}%`, detail: "1M Kerzenbewegung", icon: Waves },
    { label: "Tagesrange", value: formatCurrency(dayRange, detail.asset.currency), detail: `${formatCurrency(detail.quote.dayLow, detail.asset.currency)} bis ${formatCurrency(detail.quote.dayHigh, detail.asset.currency)}`, icon: BarChart3 },
    { label: "Volumen-Trend", value: formatPercent(volumeChange), detail: formatCompact(detail.quote.volume), icon: BarChart3 }
  ];

  const signals = [smaSignal, rsiSignal, macdSignal, "Trendlinien vorbereitet", "Support/Resistance aktiv"];

  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">Technische Trendanalyse</p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">Momentum, Volatilitaet und Signale</h2>
        </div>
        <div className="rounded-2xl border border-amber/25 bg-amber/10 px-3 py-2 text-xs text-amber">
          MACD und Trendlinien sind vorbereitet und werden je Provider-Datenqualität erweitert.
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-2xl border border-stroke bg-coal/55 p-4">
              <div className="flex items-center gap-2 text-muted">
                <Icon className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em]">{item.label}</p>
              </div>
              <p className="mt-3 font-mono text-xl font-semibold text-mist">{item.value}</p>
              <p className="mt-1 text-xs text-muted">{item.detail}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-stroke bg-coal/55 p-4">
          <p className="text-sm font-semibold">52-Wochen-Spanne</p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
            <span>{detail.quote.fiftyTwoWeekLow ? formatCurrency(detail.quote.fiftyTwoWeekLow, detail.asset.currency) : "n/a"}</span>
            <span>{detail.quote.fiftyTwoWeekHigh ? formatCurrency(detail.quote.fiftyTwoWeekHigh, detail.asset.currency) : "n/a"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stroke">
            <div
              className="h-full rounded-full bg-gradient-to-r from-loss via-amber to-profit"
              style={{
                width: `${Math.max(
                  4,
                  Math.min(
                    100,
                    detail.quote.fiftyTwoWeekHigh && detail.quote.fiftyTwoWeekLow
                      ? ((detail.quote.price - detail.quote.fiftyTwoWeekLow) /
                          Math.max(0.01, detail.quote.fiftyTwoWeekHigh - detail.quote.fiftyTwoWeekLow)) *
                          100
                      : 50
                  )
                )}%`
              }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-stroke bg-coal/55 p-4">
          <p className="text-sm font-semibold">Technische Signale</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {signals.map((signal) => (
              <span key={signal} className={`rounded-xl border border-stroke bg-panel px-3 py-2 text-xs font-semibold ${signalColor(signal)}`}>
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-cyan/20 bg-cyan/10 p-3 text-sm leading-6 text-muted">
        KI-Zusammenfassung: {detail.aiAnalysis.summary}
      </p>
    </section>
  );
}
