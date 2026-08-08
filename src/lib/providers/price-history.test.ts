import { describe, expect, it } from "vitest";
import { parseFmpDailyHistory, sliceHistoryRanges } from "@/lib/providers/price-history";

/**
 * Vor dieser Datei erzeugte `candlesFromQuote` aus einem einzelnen Kurs 32
 * Kerzen mit einer Sinusfunktion — und die Risiko-Engine las daraus Momentum
 * und Volumentrend.
 *
 * Die Tests prüfen deshalb neben der Auswertung vor allem die Grenzen: dass
 * Unbrauchbares verworfen statt repariert wird, und dass ein leeres Fenster
 * leer bleibt.
 */

function row(date: string, close: number, extra: Record<string, unknown> = {}) {
  return { symbol: "AAPL", date, open: close - 1, high: close + 2, low: close - 2, close, volume: 1_000, ...extra };
}

describe("Auswertung der Anbieterantwort", () => {
  it("dreht die absteigende Reihe des Anbieters um", () => {
    // FMP liefert das juengste Datum zuerst. Ein RSI auf einer rueckwaerts
    // gelesenen Reihe waere exakt gespiegelt -- falsch, ohne falsch auszusehen.
    const candles = parseFmpDailyHistory("AAPL", [row("2026-08-07", 313), row("2026-08-06", 312), row("2026-08-05", 311)]);

    expect(candles.map((entry) => entry.close)).toEqual([311, 312, 313]);
  });

  it("verwirft Zeilen ohne Datum oder ohne brauchbaren Schlusskurs", () => {
    const candles = parseFmpDailyHistory("AAPL", [
      row("2026-08-07", 313),
      { date: "2026-08-06" },
      { close: 312 },
      row("2026-08-05", 0),
      row("2026-08-04", -5),
      "kein Objekt",
      null
    ]);

    // Nur die erste Zeile ist vollstaendig. Es wird nichts aufgefuellt: eine
    // interpolierte Kerze waere genau die Erfindung, die diese Datei ersetzt.
    expect(candles).toHaveLength(1);
    expect(candles[0].close).toBe(313);
  });

  it("verträgt eine Antwort, die gar keine Liste ist", () => {
    expect(parseFmpDailyHistory("AAPL", { error: "Payment Required" })).toEqual([]);
    expect(parseFmpDailyHistory("AAPL", null)).toEqual([]);
    expect(parseFmpDailyHistory("AAPL", undefined)).toEqual([]);
  });

  it("hält die Spanne widerspruchsfrei", () => {
    // Ein Hoch unter dem Schlusskurs ist ein Anbieterfehler. Es wird korrigiert
    // statt weitergereicht, sonst waere die ATR negativ.
    const [candle] = parseFmpDailyHistory("AAPL", [row("2026-08-07", 100, { high: 90, low: 110 })]);

    expect(candle.high).toBeGreaterThanOrEqual(candle.close);
    expect(candle.low).toBeLessThanOrEqual(candle.close);
    expect(candle.low).toBeGreaterThanOrEqual(0);
  });

  it("setzt bei fehlender Spanne den Schlusskurs ein, ohne zu schätzen", () => {
    const [candle] = parseFmpDailyHistory("AAPL", [{ date: "2026-08-07", close: 100 }]);

    expect(candle.open).toBe(100);
    expect(candle.high).toBe(100);
    expect(candle.low).toBe(100);
    expect(candle.volume).toBe(0);
  });
});

describe("Zuschnitt der Zeitfenster", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const daily = parseFmpDailyHistory(
    "AAPL",
    Array.from({ length: 800 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 7, 7) - index * 86_400_000);
      return row(date.toISOString().slice(0, 10), 100 + index);
    })
  );

  it("lässt das Tagesfenster leer", () => {
    // Tagesschlusskurse enthalten keinen Intraday-Verlauf. Eine Ein-Punkt-Reihe
    // als Tageschart auszugeben waere eine Behauptung ueber einen Verlauf, den
    // es nicht gibt.
    expect(sliceHistoryRanges(daily, now)["1D"]).toEqual([]);
  });

  it("schneidet nach Kalendertagen, nicht nach Anzahl", () => {
    const ranges = sliceHistoryRanges(daily, now);

    expect(ranges["1M"].length).toBe(31);
    expect(ranges["3M"].length).toBe(92);
    expect(ranges["1Y"].length).toBe(366);
  });

  it("liefert im längsten Fenster alles", () => {
    expect(sliceHistoryRanges(daily, now).MAX.length).toBe(daily.length);
  });

  it("schneidet YTD am Jahresanfang ab", () => {
    const ytd = sliceHistoryRanges(daily, now).YTD;

    expect(ytd.length).toBeGreaterThan(0);
    for (const candle of ytd) {
      expect(new Date(candle.timestamp).getUTCFullYear()).toBe(2026);
    }
  });

  it("beschriftet jede Kerze mit ihrem Zeitfenster", () => {
    const ranges = sliceHistoryRanges(daily, now);

    expect(ranges["1M"].every((candle) => candle.range === "1M")).toBe(true);
    expect(ranges["1Y"].every((candle) => candle.range === "1Y")).toBe(true);
  });

  it("liefert aus einer leeren Reihe überall leere Fenster", () => {
    const ranges = sliceHistoryRanges([], now);

    // Der Kern: keine Historie erzeugt keine Ersatzhistorie.
    expect(Object.values(ranges).every((entries) => entries.length === 0)).toBe(true);
  });

  it("gibt bei kurzer Historie nur das zurück, was da ist", () => {
    const short = parseFmpDailyHistory("AAPL", [row("2026-08-07", 100), row("2026-08-06", 99)]);
    const ranges = sliceHistoryRanges(short, now);

    expect(ranges["1M"]).toHaveLength(2);
    expect(ranges["5Y"]).toHaveLength(2);
  });
});
