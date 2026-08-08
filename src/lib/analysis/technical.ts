/**
 * Brücke zwischen den gerechneten Indikatoren und dem Anwendungstyp.
 *
 * `indicators.ts` rechnet auf reinen Zahlenreihen. Diese Datei übersetzt das
 * Ergebnis in `TechnicalIndicators`, das die Oberfläche und die Risiko-Engine
 * benutzen — und ist damit die Stelle, an der die drei alten Erfindungsquellen
 * zusammenlaufen und verschwinden:
 *
 * | Ort | Was dort stand |
 * |---|---|
 * | `chart-data.ts` | RSI = 30 + Anteil grüner Kerzen × 45 |
 * | `market-provider.ts` | RSI aus der Tagesveränderung, MACD = Kurs × 0,004 |
 * | `mock/market.ts` | RSI aus einem Seed gewürfelt |
 *
 * Keine dieser Formeln war der Indikator, dessen Namen sie trug.
 *
 * **Die Regel bleibt:** zu kurze Reihe heißt `null`, nicht Standardwert. Was
 * fehlt, steht namentlich in `unavailable` — damit die Oberfläche eine Lücke
 * als Lücke zeigen kann statt als Zahl.
 */

import { computeIndicators } from "@/lib/analysis/indicators";
import type { Candle, TechnicalIndicators } from "@/lib/types";

/** Interne Schlüssel auf lesbare Namen. Die Lücke wird schließlich angezeigt. */
const readableNames: Record<string, string> = {
  sma20: "SMA 20",
  sma50: "SMA 50",
  sma200: "SMA 200",
  ema12: "EMA 12",
  ema26: "EMA 26",
  rsi14: "RSI 14",
  macd: "MACD",
  bollinger: "Bollinger Bänder",
  atr14: "ATR 14",
  stochastic: "Stochastic",
  roc12: "ROC 12",
  obv: "OBV",
  vwap: "VWAP",
  volatility: "Volatilität",
  supportResistance: "Unterstützung/Widerstand",
  cross: "MA-Kreuzung"
};

/**
 * Keine Kursdaten, also keine Indikatoren.
 *
 * Ausdrücklich benannt statt als Objekt voller Nullen: eine Null ist ein
 * Messwert, `null` ist das Fehlen einer Messung. Der Unterschied entscheidet,
 * ob die Oberfläche „0,00 €" oder „liegt nicht vor" anzeigt.
 */
export const NO_INDICATORS: TechnicalIndicators = {
  rsi: null,
  macd: null,
  movingAverages: { ma20: null, ma50: null, ma200: null },
  bollingerBands: null,
  support: [],
  resistance: [],
  sampleSize: 0,
  unavailable: Object.values(readableNames)
};

/**
 * Rechnet die Indikatoren aus echten Kerzen.
 *
 * Unterstützung und Widerstand sind bewusst nur **je ein** Wert: das Hoch und
 * das Tief des Fensters. Die alte Fassung lieferte zwei Stufen je Seite, die
 * aus dem aktuellen Kurs multipliziert waren (`Kurs × 0,96` und `× 0,92`) —
 * zwei Zahlen, die nichts über den Kursverlauf wussten.
 */
export function buildTechnicalIndicators(candles: readonly Candle[]): TechnicalIndicators {
  if (candles.length === 0) return NO_INDICATORS;

  const set = computeIndicators(candles);

  return {
    rsi: set.rsi14,
    macd: set.macd ? { value: set.macd.macd, signal: set.macd.signal, histogram: set.macd.histogram } : null,
    movingAverages: { ma20: set.sma20, ma50: set.sma50, ma200: set.sma200 },
    bollingerBands: set.bollinger
      ? { upper: set.bollinger.upper, middle: set.bollinger.middle, lower: set.bollinger.lower }
      : null,
    support: set.supportResistance ? [set.supportResistance.support] : [],
    resistance: set.supportResistance ? [set.supportResistance.resistance] : [],
    sampleSize: set.sampleSize,
    unavailable: set.unavailable.map((key) => readableNames[key] ?? key)
  };
}
