/**
 * Technische Lage über mehrere Zeitrahmen.
 *
 * §26 verlangt „mehrere Timeframes". Der Grund ist nicht Vollständigkeit,
 * sondern eine Eigenschaft technischer Analyse, die eine Einzelansicht
 * systematisch verschweigt: **derselbe Wert kann kurzfristig fallen und
 * langfristig steigen.** Wer nur ein Fenster sieht, hält den Ausschnitt für
 * die Lage.
 *
 * Deshalb ist die Uneinigkeit hier kein Mangel des Modells, sondern das
 * Ergebnis. `mixed` wird ausdrücklich als eigener Zustand geführt und nicht zu
 * einer Mehrheitsmeinung verrechnet — eine Mehrheit aus drei Fenstern wäre
 * eine erfundene Eindeutigkeit.
 *
 * Reine Rechnung, kein Netzzugriff.
 */

import { adx, rsi, trendChannel } from "@/lib/analysis/indicators";
import type { Candle, TimeRange } from "@/lib/types";

/** Kurz-, mittel- und langfristig. Bewusst nur drei: mehr Fenster erhöhen die Zahl der Vergleiche, nicht die Einsicht. */
export const analyzedTimeframes = ["1M", "3M", "1Y"] as const;
export type AnalyzedTimeframe = (typeof analyzedTimeframes)[number];

export const timeframeLabels: Record<AnalyzedTimeframe, string> = {
  "1M": "Kurzfristig (1 Monat)",
  "3M": "Mittelfristig (3 Monate)",
  "1Y": "Langfristig (1 Jahr)"
};

/**
 * Mindestlänge für eine Aussage.
 *
 * Unter 20 Kerzen ist weder eine Regressionsgerade noch ein RSI belastbar.
 * Die Grenze gilt für alle Fenster gleich — ein kurzes Fenster darf nicht
 * deshalb aussagekräftig heißen, weil es kurz ist.
 */
const MIN_CANDLES = 20;

export type TimeframeReading = {
  timeframe: AnalyzedTimeframe;
  label: string;
  candles: number;
  /** Ob die Reihe für eine Aussage reicht. */
  usable: boolean;
  direction: "up" | "down" | "sideways" | null;
  /** Gesamtbewegung über das Fenster in Prozent. */
  changePercent: number | null;
  /** Güte der Trendgerade, 0–1. Ohne sie ist die Richtung nicht einzuordnen. */
  fit: number | null;
  rsi: number | null;
  /** Trendstärke, nicht Richtung. */
  adx: number | null;
  note: string;
};

export type TimeframeAgreement = "aligned_up" | "aligned_down" | "mixed" | "insufficient";

export type MultiTimeframeAnalysis = {
  frames: TimeframeReading[];
  agreement: TimeframeAgreement;
  /** Wie viele Fenster überhaupt beurteilbar waren. */
  usableFrames: number;
  note: string;
};

function readFrame(timeframe: AnalyzedTimeframe, candles: readonly Candle[]): TimeframeReading {
  const label = timeframeLabels[timeframe];

  if (candles.length < MIN_CANDLES) {
    return {
      timeframe,
      label,
      candles: candles.length,
      usable: false,
      direction: null,
      changePercent: null,
      fit: null,
      rsi: null,
      adx: null,
      note: `Nur ${candles.length} Kerzen. Für eine Aussage werden mindestens ${MIN_CANDLES} benötigt.`
    };
  }

  const closes = candles.map((candle) => candle.close);
  // Die Gerade laeuft ueber das ganze Fenster, nicht ueber eine feste Zahl von
  // Perioden -- sonst waere der "1J-Trend" derselbe Ausschnitt wie der
  // "1M-Trend", nur anders beschriftet.
  const channel = trendChannel(closes, closes.length);
  const strength = adx(candles);

  return {
    timeframe,
    label,
    candles: candles.length,
    usable: true,
    direction: channel?.direction ?? null,
    changePercent: channel?.changePercent ?? null,
    fit: channel?.fit ?? null,
    rsi: rsi(closes),
    adx: strength?.adx ?? null,
    note: channel
      ? channel.reliable
        ? `Trendgerade beschreibt den Verlauf gut (Güte ${(channel.fit * 100).toFixed(0)} %).`
        : `Der Verlauf folgt keiner Geraden (Güte ${(channel.fit * 100).toFixed(0)} %). Die Richtung ist wenig aussagekräftig.`
      : "Kein Trendkanal berechenbar."
  };
}

/**
 * Liest die Lage über alle Zeitrahmen.
 *
 * Beurteilt werden nur Fenster mit genügend Kerzen. Ein Fenster ohne Daten
 * zählt nicht als „neutral" — es zählt gar nicht.
 */
export function analyzeTimeframes(
  candlesByRange: Partial<Record<TimeRange, Candle[]>>
): MultiTimeframeAnalysis {
  const frames = analyzedTimeframes.map((timeframe) => readFrame(timeframe, candlesByRange[timeframe] ?? []));
  const usable = frames.filter((frame) => frame.usable && frame.direction !== null);

  if (usable.length < 2) {
    return {
      frames,
      agreement: "insufficient",
      usableFrames: usable.length,
      note:
        usable.length === 0
          ? "Für keinen Zeitrahmen liegt genug Historie vor. Es wird keine technische Einordnung vorgenommen."
          : "Nur ein Zeitrahmen ist beurteilbar. Ein Vergleich über Fristen ist damit nicht möglich."
    };
  }

  const directions = new Set(usable.map((frame) => frame.direction));

  if (directions.size === 1) {
    const [only] = [...directions];
    if (only === "up" || only === "down") {
      return {
        frames,
        agreement: only === "up" ? "aligned_up" : "aligned_down",
        usableFrames: usable.length,
        note: `Alle ${usable.length} beurteilbaren Zeitrahmen zeigen in dieselbe Richtung. Das erhöht die Konsistenz des Bildes, ist aber keine Prognose.`
      };
    }
  }

  // Seitwaerts mit einer Richtung zusammen ist ebenfalls uneinheitlich. Das
  // waere sonst der Punkt, an dem eine Mehrheit zur Aussage wuerde.
  return {
    frames,
    agreement: "mixed",
    usableFrames: usable.length,
    note: "Die Zeitrahmen widersprechen sich. Das ist selbst die Aussage — kurzfristige und langfristige Bewegung laufen auseinander."
  };
}
