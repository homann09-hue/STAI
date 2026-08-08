import { Activity, BarChart3, LineChart, Radar, Waves } from "lucide-react";
import {
  analyzeTimeframes,
  type MultiTimeframeAnalysis,
  type TimeframeAgreement
} from "@/lib/analysis/multi-timeframe";
import { calculateVolatility, formatCompact, formatCurrency, formatPercent } from "@/lib/scoring";
import type { AssetDetail, Candle } from "@/lib/types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function rangeMomentum(candles: Candle[]) {
  const validCandles = candles.filter((candle) => isFiniteNumber(candle.close));
  const first = validCandles[0];
  const last = validCandles[validCandles.length - 1];
  if (!first || !last) return 0;
  if (first.close <= 0) return 0;
  return ((last.close - first.close) / first.close) * 100;
}

function trendFromMomentum(value: number) {
  if (value >= 4) return "Aufwärtstrend";
  if (value <= -4) return "Abwärtstrend";
  return "Seitwärts";
}

function volumeTrend(candles: Candle[]) {
  if (candles.length < 8) return 0;
  const half = Math.floor(candles.length / 2);
  const older = candles.slice(0, half).reduce((sum, candle) => sum + (isFiniteNumber(candle.volume) ? Math.max(0, candle.volume) : 0), 0) / half;
  const newer = candles.slice(half).reduce((sum, candle) => sum + (isFiniteNumber(candle.volume) ? Math.max(0, candle.volume) : 0), 0) / Math.max(1, candles.length - half);
  return older ? ((newer - older) / older) * 100 : 0;
}

function signalColor(label: string) {
  if (label.includes("Aufwärts") || label.includes("bullisch")) return "text-profit";
  if (label.includes("Abwärts") || label.includes("überhitzt") || label.includes("bearisch")) return "text-loss";
  return "text-amber";
}

const agreementText: Record<TimeframeAgreement, { label: string; tone: string }> = {
  aligned_up: { label: "Alle Fristen aufwärts", tone: "text-profit" },
  aligned_down: { label: "Alle Fristen abwärts", tone: "text-loss" },
  // Uneinigkeit ist hier das Ergebnis und kein Mangel -- deshalb neutral
  // eingefaerbt und nicht als Warnung.
  mixed: { label: "Fristen widersprechen sich", tone: "text-amber" },
  insufficient: { label: "Zu wenig Historie", tone: "text-muted" }
};

function directionLabel(direction: "up" | "down" | "sideways" | null) {
  if (direction === "up") return "Aufwärts";
  if (direction === "down") return "Abwärts";
  if (direction === "sideways") return "Seitwärts";
  return "—";
}

/**
 * Die Lage über mehrere Fristen.
 *
 * Der Kern ist die Zeile „Fristen widersprechen sich": derselbe Wert kann
 * kurzfristig fallen und langfristig steigen. Wer nur ein Fenster sieht, hält
 * den Ausschnitt für die Lage.
 */
export function MultiTimeframePanel({ analysis }: { analysis: MultiTimeframeAnalysis }) {
  const summary = agreementText[analysis.agreement];

  return (
    <div className="rounded-2xl border border-stroke bg-coal/55 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Mehrere Zeitrahmen</p>
        <span className={`text-xs font-semibold ${summary.tone}`}>{summary.label}</span>
      </div>

      <div className="mt-3 space-y-2">
        {analysis.frames.map((frame) => (
          <div key={frame.timeframe} className="rounded-xl border border-stroke bg-panel/60 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold text-mist">{frame.label}</p>
              <p className={`font-mono text-sm ${frame.usable ? "text-mist" : "text-muted"}`}>
                {directionLabel(frame.direction)}
                {frame.changePercent !== null ? ` · ${formatPercent(frame.changePercent)}` : ""}
              </p>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted">
              {frame.candles} Kerzen
              {frame.rsi !== null ? ` · RSI ${frame.rsi.toFixed(0)}` : ""}
              {frame.adx !== null ? ` · ADX ${frame.adx.toFixed(0)}` : ""}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted">{frame.note}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-4 text-muted">{analysis.note}</p>
    </div>
  );
}

export function TrendChannelCard({
  channel,
  currency
}: {
  channel: AssetDetail["indicators"]["trendChannel"];
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-coal/55 p-4">
      <p className="text-sm font-semibold">Trendkanal</p>
      {!channel ? (
        <p className="mt-2 text-xs text-muted">Zu wenig Daten für eine Trendgerade.</p>
      ) : (
        <>
          <p className="mt-2 font-mono text-sm text-mist">
            {formatCurrency(channel.lower, currency)} – {formatCurrency(channel.upper, currency)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {directionLabel(channel.direction)} · {formatPercent(channel.changePercent)} über das Fenster
          </p>
          {/* Die Guete ist die wichtigste Zahl der Karte: ohne sie saehe ein
              Zufallsverlauf aus wie ein Trendkanal. */}
          <p className={`mt-2 text-[11px] leading-4 ${channel.reliable ? "text-muted" : "text-amber"}`}>
            Güte der Gerade: {(channel.fit * 100).toFixed(0)} %.{" "}
            {channel.reliable
              ? "Der Verlauf folgt der Geraden gut genug, um von einem Kanal zu sprechen."
              : "Der Verlauf folgt keiner Geraden. Die Richtung ist damit wenig aussagekräftig."}
          </p>
        </>
      )}
    </div>
  );
}

export function BreakoutCard({
  breakout,
  currency
}: {
  breakout: AssetDetail["indicators"]["breakout"];
  currency: string;
}) {
  return (
    <div className="rounded-2xl border border-stroke bg-coal/55 p-4">
      <p className="text-sm font-semibold">Ausbruch</p>
      {/* Drei Zustaende, nicht zwei: "kein Ausbruch" und "nicht feststellbar"
          sind verschiedene Auskuenfte. */}
      {breakout === null ? (
        <p className="mt-2 text-xs text-muted">Zu wenig Daten, um einen Ausbruch festzustellen.</p>
      ) : breakout.status === "none" ? (
        <p className="mt-2 text-xs text-muted">Kein Ausbruch aus der Spanne der letzten Perioden.</p>
      ) : (
        <>
          <p className={`mt-2 font-mono text-sm ${breakout.direction === "up" ? "text-profit" : "text-loss"}`}>
            {breakout.direction === "up" ? "Nach oben" : "Nach unten"} über {formatCurrency(breakout.level, currency)}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            {breakout.strengthInAtr.toFixed(2)} ATR jenseits des Niveaus — in ATR gemessen, damit ruhige und
            volatile Werte vergleichbar bleiben.
          </p>
          <p className={`mt-2 text-[11px] leading-4 ${breakout.volumeConfirmed ? "text-muted" : "text-amber"}`}>
            {breakout.volumeConfirmed
              ? "Vom Volumen gestützt."
              : "Ohne Volumenbestätigung. Ausbrüche ohne Volumen laufen häufiger zurück."}
          </p>
        </>
      )}
    </div>
  );
}

export function TechnicalTrendPanel({ detail }: { detail: AssetDetail }) {
  const shortMomentum = rangeMomentum(detail.candles["1D"]);
  const midMomentum = rangeMomentum(detail.candles["1M"]);
  const longMomentum = rangeMomentum(detail.candles["1Y"]);
  const volatility = calculateVolatility(detail.candles["1M"]);
  const volumeChange = volumeTrend(detail.candles["1M"]);
  const dayRange =
    isFiniteNumber(detail.quote.dayHigh) && isFiniteNumber(detail.quote.dayLow) && detail.quote.dayHigh >= detail.quote.dayLow
      ? detail.quote.dayHigh - detail.quote.dayLow
      : 0;
  // Ein Signal braucht alle drei Durchschnitte. Vorher verglich diese Stelle
  // Zahlen, die alle aus dem aktuellen Kurs multipliziert waren -- das Ergebnis
  // stand damit schon vor dem Vergleich fest.
  const { ma20, ma50, ma200 } = detail.indicators.movingAverages;
  const smaSignal =
    ma20 === null || ma50 === null || ma200 === null
      ? "SMA-Struktur: zu wenig Daten"
      : ma20 > ma50 && ma50 > ma200
        ? "SMA-Struktur bullisch"
        : ma20 < ma50
          ? "SMA-Struktur bearisch"
          : "SMA-Struktur neutral";

  const rsi = detail.indicators.rsi;
  const rsiSignal =
    rsi === null ? "RSI: zu wenig Daten" : rsi > 70 ? "RSI überhitzt" : rsi < 30 ? "RSI schwach" : "RSI neutral";

  const macdSignal = !detail.indicators.macd
    ? "MACD: zu wenig Daten"
    : detail.indicators.macd.histogram >= 0
      ? "MACD positiv"
      : "MACD negativ";

  const levelSignal = detail.indicators.support.length
    ? `Unterstützung ${formatCurrency(detail.indicators.support[0], detail.asset.currency)}`
    : "Unterstützung: zu wenig Daten";

  // Der ADX misst nur die Staerke. Ohne +DI/-DI waere die Zahl regelmaessig als
  // Richtung fehlgedeutet, deshalb stehen sie nebeneinander.
  const strength = detail.indicators.adx;
  const adxSignal = !strength
    ? "Trendstärke: zu wenig Daten"
    : `Trendstärke ${strength.adx.toFixed(0)} (${strength.adx >= 25 ? "trendig" : "richtungslos"}), ${
        strength.plusDi >= strength.minusDi ? "aufwärts" : "abwärts"
      } gerichtet`;

  const channel = detail.indicators.trendChannel;
  const breakoutResult = detail.indicators.breakout;

  const multiTimeframe = analyzeTimeframes(detail.candles);

  const cards = [
    { label: "Kurzfristiger Trend", value: trendFromMomentum(shortMomentum), detail: formatPercent(shortMomentum), icon: Activity },
    { label: "Mittelfristiger Trend", value: trendFromMomentum(midMomentum), detail: formatPercent(midMomentum), icon: LineChart },
    { label: "Langfristiger Trend", value: trendFromMomentum(longMomentum), detail: formatPercent(longMomentum), icon: Radar },
    { label: "Volatilität", value: `${volatility.toFixed(2)}%`, detail: "1M Kerzenbewegung", icon: Waves },
    { label: "Tagesrange", value: formatCurrency(dayRange, detail.asset.currency), detail: `${formatCurrency(detail.quote.dayLow, detail.asset.currency)} bis ${formatCurrency(detail.quote.dayHigh, detail.asset.currency)}`, icon: BarChart3 },
    { label: "Volumen-Trend", value: formatPercent(volumeChange), detail: formatCompact(detail.quote.volume), icon: BarChart3 }
  ];

  // "Trendlinien vorbereitet" und "Support/Resistance modelliert" standen hier
  // als Signale, obwohl weder das eine noch das andere existierte. Ein Hinweis
  // auf eine Fassade ist kein Signal.
  const signals = [smaSignal, rsiSignal, macdSignal, levelSignal, adxSignal];

  return (
    <section className="rounded-[2rem] border border-stroke bg-panel/82 p-4 shadow-panel sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan">Technische Trendanalyse</p>
          <h2 className="mt-2 text-2xl font-semibold text-mist">Momentum, Volatilität und Signale</h2>
        </div>
        <div className="rounded-2xl border border-amber/25 bg-amber/10 px-3 py-2 text-xs text-amber">
          {detail.indicators.sampleSize === 0
            ? "Keine Kurshistorie verfügbar — technische Signale werden nicht berechnet."
            : `Signale aus ${detail.indicators.sampleSize} Kerzen. Trendkanäle und Ausbrüche sind noch nicht implementiert.`}
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

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <MultiTimeframePanel analysis={multiTimeframe} />
        <div className="space-y-3">
          <TrendChannelCard channel={channel} currency={detail.asset.currency} />
          <BreakoutCard breakout={breakoutResult} currency={detail.asset.currency} />
        </div>
      </div>

      <p className="mt-4 rounded-2xl border border-cyan/20 bg-cyan/10 p-3 text-sm leading-6 text-muted">
        KI-Zusammenfassung: {detail.aiAnalysis.summary}
      </p>
    </section>
  );
}
