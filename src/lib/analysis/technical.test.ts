import { describe, expect, it } from "vitest";
import { NO_INDICATORS, buildTechnicalIndicators } from "@/lib/analysis/technical";
import { rsi, sma } from "@/lib/analysis/indicators";
import type { Candle } from "@/lib/types";

/**
 * Diese Tests prüfen nicht die Formeln — das tut `indicators.test.ts`. Sie
 * prüfen, dass die drei alten Erfindungsquellen wirklich verschwunden sind und
 * nicht bloß umbenannt wurden.
 *
 * Der Unterschied ist wichtig: eine erfundene Zahl, die weiterhin durchgereicht
 * wird, ist genauso falsch wie vorher, sieht aber nach einer aufgeräumten
 * Umstellung aus.
 */

function candle(close: number, index = 0): Candle {
  return {
    symbol: "TEST",
    range: "1M",
    timestamp: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
    time: "",
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1_000
  };
}

const longSeries = Array.from({ length: 250 }, (_, index) => candle(100 + index, index));

describe("keine Indikatoren ohne Daten", () => {
  it("liefert bei leerer Reihe Lücken statt Nullen", () => {
    const result = buildTechnicalIndicators([]);

    expect(result).toEqual(NO_INDICATORS);
    expect(result.rsi).toBeNull();
    expect(result.macd).toBeNull();
    expect(result.bollingerBands).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it("setzt nirgends eine 50 als RSI ein", () => {
    // Genau diese Zahl stand vorher in `chart-data.ts`. Eine 50 ist als RSI
    // nur dann richtig, wenn Gewinne und Verluste sich exakt aufheben -- nicht
    // als Ersatz fuer eine fehlende Messung.
    expect(buildTechnicalIndicators([]).rsi).toBeNull();
    expect(buildTechnicalIndicators([candle(100)]).rsi).toBeNull();
    expect(NO_INDICATORS.rsi).toBeNull();
  });

  it("nennt bei kurzer Reihe die Lücken mit lesbarem Namen", () => {
    const short = Array.from({ length: 30 }, (_, index) => candle(100 + index, index));
    const result = buildTechnicalIndicators(short);

    expect(result.movingAverages.ma20).not.toBeNull();
    expect(result.movingAverages.ma200).toBeNull();
    // Nicht "sma200" -- der Nutzer liest das.
    expect(result.unavailable).toContain("SMA 200");
    expect(result.unavailable).not.toContain("sma200");
  });
});

describe("die Werte sind gerechnet, nicht abgeleitet", () => {
  it("nimmt den RSI aus der Zeitreihe", () => {
    const result = buildTechnicalIndicators(longSeries);
    const expected = rsi(longSeries.map((entry) => entry.close), 14);

    expect(result.rsi).toBe(expected);
    // Durchgehend steigende Kurse: 100. Die alte Formel war auf 30..75
    // begrenzt und konnte ein Extrem nie melden.
    expect(result.rsi).toBe(100);
  });

  it("nimmt die gleitenden Durchschnitte aus der Zeitreihe", () => {
    const result = buildTechnicalIndicators(longSeries);
    const values = longSeries.map((entry) => entry.close);

    expect(result.movingAverages.ma20).toBe(sma(values, 20));
    expect(result.movingAverages.ma200).toBe(sma(values, 200));
    // Die Perioden muessen sich unterscheiden. Vorher teilte der Code durch
    // `Math.max(1, slice.length)` und gab bei 60 Kerzen den Schnitt aus 60
    // Werten als "MA 200" aus.
    expect(result.movingAverages.ma20).not.toBe(result.movingAverages.ma200);
  });

  it("meldet MA 200 als Lücke statt als Schnitt über weniger Werte", () => {
    const sixty = Array.from({ length: 60 }, (_, index) => candle(100 + index, index));
    const result = buildTechnicalIndicators(sixty);

    expect(result.movingAverages.ma50).not.toBeNull();
    expect(result.movingAverages.ma200).toBeNull();
  });

  it("bildet Bollinger Bänder aus der Streuung, nicht aus festen Prozenten", () => {
    // Vorher: obere Grenze = Schnitt × 1,035, immer. Damit war die Bandbreite
    // unabhaengig von der Volatilitaet -- also ohne jede Aussage.
    const calm = buildTechnicalIndicators(
      Array.from({ length: 40 }, (_, index) => candle(100 + (index % 2) * 0.1, index))
    );
    const wild = buildTechnicalIndicators(
      Array.from({ length: 40 }, (_, index) => candle(100 + (index % 2) * 40, index))
    );

    const calmWidth = (calm.bollingerBands?.upper ?? 0) - (calm.bollingerBands?.lower ?? 0);
    const wildWidth = (wild.bollingerBands?.upper ?? 0) - (wild.bollingerBands?.lower ?? 0);

    expect(wildWidth).toBeGreaterThan(calmWidth * 10);
  });

  it("nimmt Unterstützung und Widerstand aus dem Kursverlauf", () => {
    const result = buildTechnicalIndicators(longSeries);
    const window = longSeries.slice(-20);
    const last = longSeries[longSeries.length - 1].close;

    expect(result.support[0]).toBe(Math.min(...window.map((entry) => entry.low)));
    expect(result.resistance[0]).toBe(Math.max(...window.map((entry) => entry.high)));

    // Der Kern: die Werte sind keine Vielfachen des aktuellen Kurses. Vorher
    // war Unterstuetzung = Kurs × 0,96, weshalb der Kurs sie nie unterschreiten
    // konnte und der Befund "Support gebrochen" nie ausloeste.
    expect(result.support[0]).not.toBeCloseTo(last * 0.96, 2);
    expect(result.resistance[0]).not.toBeCloseTo(last * 1.04, 2);
  });

  it("gibt je Seite genau eine Stufe statt zweier erfundener", () => {
    const result = buildTechnicalIndicators(longSeries);

    expect(result.support).toHaveLength(1);
    expect(result.resistance).toHaveLength(1);
  });

  it("rechnet das MACD-Histogramm als Differenz zur Signallinie", () => {
    // Vorher: histogram = (SMA12 − SMA26) × 0,35. Der Faktor war frei gewaehlt
    // und die Beziehung zur Signallinie schlicht nicht vorhanden.
    const result = buildTechnicalIndicators(longSeries);

    expect(result.macd).not.toBeNull();
    expect(result.macd?.histogram).toBeCloseTo((result.macd?.value ?? 0) - (result.macd?.signal ?? 0), 10);
  });
});

describe("gleiche Kurse, gleiche Indikatoren", () => {
  it("hängt nicht vom Kursniveau, sondern vom Verlauf ab", () => {
    // Alle drei alten Quellen leiteten ihre Werte aus dem aktuellen Kurs ab.
    // Zwei Reihen mit identischem Verlauf, aber verschobenem Niveau, mussten
    // dort unterschiedliche RSI-Werte ergeben. Jetzt nicht mehr.
    const shifted = longSeries.map((entry, index) => candle(entry.close + 5_000, index));

    expect(buildTechnicalIndicators(shifted).rsi).toBe(buildTechnicalIndicators(longSeries).rsi);
  });
});
