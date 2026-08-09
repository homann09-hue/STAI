import { describe, expect, it } from "vitest";
import {
  atr,
  bollingerBands,
  computeIndicators,
  ema,
  macd,
  movingAverageCross,
  obv,
  roc,
  rsi,
  sma,
  stochastic,
  supportResistance,
  volatility,
  vwap,
  type Candle
} from "@/lib/analysis/indicators";

/**
 * Vor diesen Funktionen gab es keine technische Analyse: `chart-data.ts` setzte
 * den RSI hart auf 50, der Mock würfelte ihn. Die Tests prüfen deshalb zweierlei
 * — dass gerechnet wird, und dass bei zu kurzer Reihe **nichts** herauskommt
 * statt eines plausiblen Standardwerts.
 */

function candle(close: number, high = close + 1, low = close - 1, volume = 1_000): Candle {
  return { close, high, low, volume };
}

const rising = Array.from({ length: 250 }, (_, index) => candle(100 + index));
const risingCloses = rising.map((entry) => entry.close);

describe("zu kurze Zeitreihen", () => {
  it("liefert nichts statt eines Standardwerts", () => {
    // Der Kern: ein RSI aus drei Kerzen ist kein RSI. Eine 50 waere genau die
    // Erfindung, die vorher im Code stand.
    expect(rsi([1, 2, 3])).toBeNull();
    expect(sma([1, 2], 20)).toBeNull();
    expect(ema([1, 2], 12)).toBeNull();
    expect(macd([1, 2, 3])).toBeNull();
    expect(bollingerBands([1, 2])).toBeNull();
    expect(atr([candle(10)])).toBeNull();
    expect(stochastic([candle(10)])).toBeNull();
    expect(roc([1, 2])).toBeNull();
    expect(volatility([1])).toBeNull();
    expect(supportResistance([candle(10)])).toBeNull();
    expect(movingAverageCross([1, 2, 3])).toBeNull();
  });

  it("nennt in der Sammelrechnung, was nicht ging", () => {
    const set = computeIndicators(Array.from({ length: 25 }, (_, i) => candle(100 + i)));

    expect(set.sampleSize).toBe(25);
    // 25 Kerzen reichen fuer SMA20, nicht fuer SMA200.
    expect(set.sma20).not.toBeNull();
    expect(set.sma200).toBeNull();
    expect(set.unavailable).toContain("sma200");
    expect(set.unavailable).toContain("macd");
  });
});

describe("gleitende Durchschnitte", () => {
  it("rechnet den SMA über das letzte Fenster", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    // Nur die letzten drei: 3, 4, 5.
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4);
  });

  it("gewichtet beim EMA die jüngeren Werte stärker", () => {
    // Genau `period` Werte ergeben denselben Wert wie der SMA -- es gibt noch
    // nichts zu glaetten. Der Unterschied entsteht erst mit mehr Historie.
    expect(ema([10, 10, 10, 10, 20], 5)).toBe(sma([10, 10, 10, 10, 20], 5));

    const longer = [10, 10, 10, 10, 10, 10, 10, 10, 10, 20];
    expect(ema(longer, 5)).toBeGreaterThan(sma(longer, 5) ?? 0);
  });

  it("meldet ein Kreuz nur im Moment des Kreuzens", () => {
    // Beim erste Versuch hatte mein Testfall das Kreuz Dutzende Schritte vor
    // dem Ende -- und die Funktion meldete korrekt "none". Genau das ist das
    // gewuenschte Verhalten: ein Kreuz von vor Monaten ist kein Ereignis mehr.
    expect(movingAverageCross(risingCloses, 50, 200)).toBe("none");

    const turning = [...risingCloses.slice(0, 240), ...Array.from({ length: 60 }, () => 50)];
    expect(movingAverageCross(turning, 50, 200)).toBe("none");
  });

  it("erkennt den Schnitt nach unten im Schritt, in dem er passiert", () => {
    // Kurze Perioden, damit der Wendepunkt genau auf den letzten Wert faellt.
    expect(movingAverageCross([1, 2, 3, 4, 5, 1], 2, 3)).toBe("death_cross");
  });

  it("erkennt den Schnitt nach oben im Schritt, in dem er passiert", () => {
    expect(movingAverageCross([5, 4, 3, 2, 1, 5], 2, 3)).toBe("golden_cross");
  });
});

describe("RSI", () => {
  it("meldet bei ausschließlich steigenden Kursen 100", () => {
    expect(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 14)).toBe(100);
  });

  it("meldet bei ausschließlich fallenden Kursen einen sehr niedrigen Wert", () => {
    const falling = Array.from({ length: 20 }, (_, index) => 100 - index);
    expect(rsi(falling, 14)).toBeCloseTo(0, 5);
  });

  it("liegt bei unveränderten Kursen in der Mitte", () => {
    // Weder Gewinne noch Verluste: 50 ist hier die Definition, keine
    // Verlegenheitsloesung.
    expect(rsi(Array.from({ length: 20 }, () => 100), 14)).toBe(50);
  });

  it("bleibt immer zwischen 0 und 100", () => {
    const noisy = Array.from({ length: 60 }, (_, index) => 100 + Math.sin(index) * 20);
    const value = rsi(noisy, 14);

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(100);
  });
});

describe("Bollinger Bänder", () => {
  it("legt das mittlere Band auf den SMA", () => {
    const values = Array.from({ length: 20 }, (_, index) => 100 + index);
    const bands = bollingerBands(values, 20, 2);

    expect(bands?.middle).toBe(sma(values, 20));
    expect(bands?.upper).toBeGreaterThan(bands?.middle ?? 0);
    expect(bands?.lower).toBeLessThan(bands?.middle ?? 0);
  });

  it("hat bei konstantem Kurs keine Breite", () => {
    const bands = bollingerBands(Array.from({ length: 20 }, () => 100), 20, 2);

    expect(bands?.bandwidth).toBe(0);
    expect(bands?.upper).toBe(bands?.lower);
  });
});

describe("Volumen-Indikatoren", () => {
  it("rechnet den VWAP nach Volumen gewichtet", () => {
    // Zweite Kerze mit dreifachem Volumen zieht den Schnitt zu sich.
    const value = vwap([candle(100, 100, 100, 1), candle(200, 200, 200, 3)]);
    expect(value).toBe(175);
  });

  it("gibt ohne Volumen nichts zurück statt eines ungewichteten Schnitts", () => {
    // Ein ungewichteter Durchschnitt waere kein VWAP, sondern ein anderer
    // Indikator unter falschem Namen.
    expect(vwap([candle(100, 100, 100, 0), candle(200, 200, 200, 0)])).toBeNull();
  });

  it("steigt beim OBV mit dem Kurs", () => {
    const result = obv([candle(100), candle(101), candle(102), candle(103)]);

    expect(result?.value).toBe(3_000);
    expect(result?.risingShare).toBe(1);
  });
});

describe("Spanne und Lage", () => {
  it("bestimmt Unterstützung, Widerstand und die Lage dazwischen", () => {
    const window = [candle(100, 110, 90), candle(105, 108, 95), candle(100, 106, 92)];
    const result = supportResistance(window, 3);

    expect(result?.support).toBe(90);
    expect(result?.resistance).toBe(110);
    expect(result?.position).toBeCloseTo(0.5, 5);
  });

  it("verkraftet eine Spanne von null", () => {
    // Division durch null waere hier ein stiller NaN.
    const flat = Array.from({ length: 3 }, () => candle(100, 100, 100));
    expect(supportResistance(flat, 3)?.position).toBe(0.5);
  });

  it("liefert bei konstantem Kurs keine Volatilität über null", () => {
    expect(volatility(Array.from({ length: 30 }, () => 100))).toBe(0);
  });

  it("misst beim ROC die Veränderung in Prozent", () => {
    const values = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 110];
    expect(roc(values, 12)).toBeCloseTo(10, 5);
  });

  it("teilt beim ROC nicht durch null", () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    expect(roc(values, 12)).toBeNull();
  });
});

describe("MACD und Stochastic", () => {
  it("liefert bei steigendem Trend einen positiven MACD", () => {
    const result = macd(risingCloses);

    expect(result).not.toBeNull();
    expect(result?.macd).toBeGreaterThan(0);
    expect(result?.histogram).toBeCloseTo((result?.macd ?? 0) - (result?.signal ?? 0), 10);
  });

  it("setzt Stochastic bei einem Hoch ans obere Ende", () => {
    const result = stochastic(rising.slice(-20), 14, 3);

    expect(result?.k).toBeGreaterThan(80);
  });
});

describe("computeIndicators", () => {
  it("rechnet bei ausreichender Historie alles durch", () => {
    const set = computeIndicators(rising);

    expect(set.unavailable).toEqual([]);
    expect(set.sma200).not.toBeNull();
    expect(set.rsi14).not.toBeNull();
    expect(set.macd).not.toBeNull();
    expect(set.sampleSize).toBe(250);
  });

  it("liefert bei leerer Reihe nichts, aber stürzt nicht ab", () => {
    const set = computeIndicators([]);

    expect(set.sampleSize).toBe(0);
    expect(set.rsi14).toBeNull();
    expect(set.unavailable.length).toBeGreaterThan(10);
  });
});
