import { describe, expect, it } from "vitest";
import { adx, breakout, trendChannel, type Candle } from "@/lib/analysis/indicators";
import { analyzeTimeframes } from "@/lib/analysis/multi-timeframe";
import type { Candle as AppCandle, TimeRange } from "@/lib/types";

/**
 * ADX, Trendkanal, Ausbruch und Mehrzeitrahmen — die vier Punkte, die §26
 * über die Standardindikatoren hinaus verlangt.
 *
 * Die Tests prüfen weniger die Formeln als die Stellen, an denen ein Modell
 * sich leicht selbst überschätzt: eine Gerade durch Rauschen, ein Ausbruch,
 * der Rauschen ist, und drei Zeitrahmen, die zu einer Mehrheit verrechnet
 * werden.
 */

function candle(close: number, high = close + 1, low = close - 1, volume = 1_000): Candle {
  return { close, high, low, volume };
}

const rising = Array.from({ length: 120 }, (_, index) => candle(100 + index * 2));
const falling = Array.from({ length: 120 }, (_, index) => candle(340 - index * 2));

describe("ADX", () => {
  it("liefert bei zu kurzer Reihe nichts", () => {
    // Braucht 2 x period + 1: einmal fuer die Glaettung der Bewegung, einmal
    // fuer die des daraus gebildeten DX.
    expect(adx(rising.slice(0, 28), 14)).toBeNull();
    expect(adx(rising.slice(0, 29), 14)).not.toBeNull();
  });

  it("erkennt einen starken Trend als stark", () => {
    const result = adx(rising, 14);

    expect(result?.adx).toBeGreaterThan(40);
    expect(result?.plusDi).toBeGreaterThan(result?.minusDi ?? 100);
  });

  it("misst Stärke, nicht Richtung", () => {
    // Der haeufigste Lesefehler beim ADX: ein hoher Wert heisst "trendig",
    // nicht "steigend". Auf- und Abwaertstrend muessen deshalb aehnlich hohe
    // Werte liefern -- unterschieden wird ueber +DI/-DI.
    const up = adx(rising, 14);
    const down = adx(falling, 14);

    expect(down?.adx).toBeGreaterThan(40);
    expect(Math.abs((up?.adx ?? 0) - (down?.adx ?? 0))).toBeLessThan(15);
    expect(down?.minusDi).toBeGreaterThan(down?.plusDi ?? 100);
  });

  it("meldet bei einem unbewegten Kurs keine Trendstärke", () => {
    const flat = Array.from({ length: 60 }, () => candle(100, 100, 100));
    expect(adx(flat, 14)?.adx).toBe(0);
  });
});

describe("Trendkanal", () => {
  it("beschreibt einen geraden Verlauf mit hoher Güte", () => {
    const channel = trendChannel(rising.map((entry) => entry.close), 60);

    expect(channel?.direction).toBe("up");
    expect(channel?.fit).toBeGreaterThan(0.99);
    expect(channel?.reliable).toBe(true);
  });

  it("meldet bei Rauschen eine niedrige Güte", () => {
    // Der wichtigste Test der Datei. Eine Regressionsgerade durch Zufall hat
    // ebenfalls eine Steigung -- ohne die Guete saehe Rauschen aus wie ein
    // Trendkanal.
    let seed = 7;
    const noise = Array.from({ length: 80 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return 100 + (seed / 2147483648) * 40;
    });

    const channel = trendChannel(noise, 60);

    expect(channel).not.toBeNull();
    expect(channel?.fit).toBeLessThan(0.5);
    expect(channel?.reliable).toBe(false);
  });

  it("nennt eine kaum vorhandene Bewegung seitwärts", () => {
    // Unter 3 % Gesamtbewegung ist die Richtung nicht aussagekraeftig, auch
    // wenn die Gerade perfekt passt.
    const creeping = Array.from({ length: 60 }, (_, index) => 100 + index * 0.01);
    const channel = trendChannel(creeping, 60);

    expect(channel?.fit).toBeGreaterThan(0.99);
    expect(channel?.direction).toBe("sideways");
  });

  it("gibt einem waagerechten Verlauf keine perfekte Güte", () => {
    // Eine Gerade durch eine Gerade erklaert nichts. Guete 1 waere hier eine
    // Aussage ueber einen Trend, den es nicht gibt.
    const channel = trendChannel(Array.from({ length: 60 }, () => 100), 60);

    expect(channel?.fit).toBe(0);
    expect(channel?.direction).toBe("sideways");
  });

  it("liefert bei zu kurzer Reihe nichts", () => {
    expect(trendChannel([1, 2, 3], 60)).toBeNull();
  });
});

describe("Ausbruch", () => {
  const base = Array.from({ length: 40 }, () => candle(100, 102, 98, 1_000));

  it("unterscheidet 'kein Ausbruch' von 'nicht feststellbar'", () => {
    // Beides in null zusammenzufassen waere die Sorte Unschaerfe, die spaeter
    // als Aussage gelesen wird.
    expect(breakout(base.slice(0, 10))).toBeNull();
    expect(breakout(base)).toEqual({ status: "none" });
  });

  it("erkennt einen Ausbruch nach oben", () => {
    const result = breakout([...base, candle(112, 113, 111, 5_000)]);

    expect(result?.status).toBe("breakout");
    if (result?.status !== "breakout") throw new Error("kein Ausbruch");
    expect(result.direction).toBe("up");
    expect(result.level).toBe(102);
    expect(result.volumeConfirmed).toBe(true);
  });

  it("erkennt einen Ausbruch nach unten", () => {
    const result = breakout([...base, candle(88, 89, 87, 1_000)]);

    expect(result?.status).toBe("breakout");
    if (result?.status !== "breakout") throw new Error("kein Ausbruch");
    expect(result.direction).toBe("down");
    expect(result.level).toBe(98);
    // Ohne erhoehtes Volumen wird nichts bestaetigt.
    expect(result.volumeConfirmed).toBe(false);
  });

  it("hält ein Zehntel-ATR über dem Hoch für Rauschen", () => {
    // Ohne diese Schwelle waere jeder neue Tageshoechststand ein "Ausbruch".
    const result = breakout([...base, candle(102.05, 102.1, 101.9)]);

    expect(result).toEqual({ status: "none" });
  });

  it("misst die Stärke in ATR, nicht in Prozent", () => {
    // So bleibt ein Ausbruch bei einem ruhigen und einem volatilen Wert
    // vergleichbar. In Prozent waere er es nicht.
    const calm = breakout([...base, candle(112, 113, 111)]);
    const wild = breakout([
      ...Array.from({ length: 40 }, () => candle(100, 120, 80)),
      candle(130, 131, 129)
    ]);

    if (calm?.status !== "breakout" || wild?.status !== "breakout") throw new Error("kein Ausbruch");
    expect(calm.strengthInAtr).toBeGreaterThan(wild.strengthInAtr);
  });
});

function appCandle(close: number, index: number): AppCandle {
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

function frames(input: Partial<Record<TimeRange, number[]>>): Partial<Record<TimeRange, AppCandle[]>> {
  return Object.fromEntries(
    Object.entries(input).map(([range, values]) => [range, (values ?? []).map(appCandle)])
  );
}

const up = Array.from({ length: 60 }, (_, index) => 100 + index * 2);
const down = Array.from({ length: 60 }, (_, index) => 220 - index * 2);

describe("Mehrere Zeitrahmen", () => {
  it("meldet Übereinstimmung, wenn alle Fristen gleich zeigen", () => {
    const result = analyzeTimeframes(frames({ "1M": up, "3M": up, "1Y": up }));

    expect(result.agreement).toBe("aligned_up");
    expect(result.usableFrames).toBe(3);
    expect(result.note).toContain("keine Prognose");
  });

  it("meldet Widerspruch, statt eine Mehrheit zu bilden", () => {
    // Der Kern von §26: zwei gegen einen ist keine Aussage. Eine Mehrheit aus
    // drei Fenstern waere eine erfundene Eindeutigkeit.
    const result = analyzeTimeframes(frames({ "1M": down, "3M": up, "1Y": up }));

    expect(result.agreement).toBe("mixed");
    expect(result.note).toContain("widersprechen sich");
  });

  it("zählt seitwärts als eigene Richtung", () => {
    const flat = Array.from({ length: 60 }, () => 100);
    const result = analyzeTimeframes(frames({ "1M": flat, "3M": up, "1Y": up }));

    expect(result.agreement).toBe("mixed");
  });

  it("wertet ein Fenster ohne Daten nicht als neutral", () => {
    // Es zaehlt gar nicht -- sonst wuerde fehlende Historie zu einer Stimme.
    const result = analyzeTimeframes(frames({ "1M": up, "3M": [], "1Y": [] }));

    expect(result.agreement).toBe("insufficient");
    expect(result.usableFrames).toBe(1);
    expect(result.frames[1].usable).toBe(false);
    expect(result.frames[1].direction).toBeNull();
  });

  it("verlangt für jede Frist dieselbe Mindestlänge", () => {
    // Ein kurzes Fenster darf nicht deshalb aussagekraeftig heissen, weil es
    // kurz ist.
    const result = analyzeTimeframes(frames({ "1M": up.slice(0, 19), "3M": up, "1Y": up }));

    expect(result.frames[0].usable).toBe(false);
    expect(result.frames[0].note).toContain("mindestens 20");
  });

  it("sagt bei völlig fehlender Historie gar nichts", () => {
    const result = analyzeTimeframes({});

    expect(result.agreement).toBe("insufficient");
    expect(result.usableFrames).toBe(0);
    expect(result.note).toContain("keine technische Einordnung");
  });
});
