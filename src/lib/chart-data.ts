import { buildTechnicalIndicators } from "@/lib/analysis/technical";
import type { Candle, ChartRange, TechnicalIndicators } from "@/lib/types";

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

/**
 * Wählt die Kerzen für ein Zeitfenster — oder liefert nichts.
 *
 * Hier stand `fallbackCandles`: fehlten Kerzen, wurde eine Sinuskurve um den
 * aktuellen Kurs gezeichnet, damit das Diagramm nicht leer bleibt.
 *
 * ```
 * close = base + drift × index + sin(index × 0,71) × volatility × 0,24
 * ```
 *
 * Ein Kursdiagramm, das einen Verlauf zeigt, den es nie gab, ist die
 * sichtbarste Form von §61 — und nichts an der Darstellung verriet es. Ein
 * leeres Fenster mit Begründung ist schlechter anzusehen und ehrlicher.
 */
export function selectCandles(
  candlesByRange: Partial<Record<ChartRange, Candle[]>> | undefined,
  range: UiRange
): Candle[] {
  for (const key of rangeToDataKeys(range)) {
    const candles = candlesByRange?.[key];
    const clean = candles?.length ? cleanCandles(candles) : [];
    if (clean.length) return clean;
  }

  return [];
}

/**
 * Technische Indikatoren aus Kerzen.
 *
 * Was hier vorher stand, sah aus wie eine Berechnung und war keine. Der Reihe
 * nach, weil jede Zeile ein eigener Fehler war:
 *
 * - `rsi = 30 + Anteil grüner Kerzen × 45` — der Anteil steigender Kerzen ist
 *   nicht die relative Stärke. Der Wert konnte konstruktionsbedingt nie unter
 *   30 oder über 75 liegen, also **nie** überkauft oder überverkauft melden.
 * - `macd` aus zwei SMAs statt EMAs, `signal` mit einem willkürlichen Faktor
 *   0,05, `histogram` mit 0,35 — statt `macd − signal`.
 * - `bollingerBands` als feste ±3,5 % um den Schnitt, ganz ohne
 *   Standardabweichung. Ein Bollinger-Band ohne Streuung ist kein Bollinger-Band.
 * - `ma200` teilte durch `Math.max(1, slice.length)`. Bei 60 Kerzen war das der
 *   Schnitt aus 60 Werten — ausgegeben als „MA 200". Das war die gefährlichste
 *   Zeile, weil das Ergebnis plausibel aussah.
 * - `support`/`resistance` als Kurs × 0,96 bzw. × 1,04 — Zahlen, die vom
 *   Kursverlauf nichts wussten.
 */
export function deriveIndicators(candles: Candle[]): TechnicalIndicators {
  return buildTechnicalIndicators(cleanCandles(candles));
}
