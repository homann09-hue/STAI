import { describe, expect, it } from "vitest";
import { MIN_CANDLES, internalRateOfReturn, runBacktest, type BacktestCandle } from "@/lib/analysis/backtest";
import { assessHistoricalDataIntegrity } from "@/lib/analysis/history-integrity";

/**
 * Die Tests prüfen vor allem die Stellen, an denen ein Backtest plausibel
 * falsch wird: die Rendite bei laufenden Einzahlungen, der Drawdown und die
 * Frage, wann überhaupt gerechnet werden darf.
 */

/** Kerzen mit fester Tagesrendite — dadurch ist das Ergebnis nachrechenbar. */
function series(days: number, start = 100, dailyReturn = 0): BacktestCandle[] {
  const from = Date.UTC(2020, 0, 1);
  let close = start;

  return Array.from({ length: days }, (_, index) => {
    if (index > 0) close *= 1 + dailyReturn;
    return {
      // Handelstage: Wochenenden werden uebersprungen, damit die Monatslogik
      // auf einer realistischen Reihe geprueft wird.
      timestamp: new Date(from + index * 86_400_000 * 1.4).toISOString(),
      close
    };
  });
}

describe("wann gerechnet werden darf", () => {
  it("verweigert einen Backtest auf zu kurzer Historie", () => {
    const result = runBacktest({ candles: series(120), initialCapital: 1000, monthlyContribution: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("hätte verweigern müssen");
    expect(result.reason).toContain("Hochrechnung");
    expect(result.reason).toContain(String(MIN_CANDLES));
  });

  it("verweigert ohne Kapital und ohne Einzahlung", () => {
    const result = runBacktest({ candles: series(600), initialCapital: 0, monthlyContribution: 0 });

    expect(result.ok).toBe(false);
  });

  it("verwirft unbrauchbare Kerzen, statt sie zu ersetzen", () => {
    const candles = [
      ...series(600),
      { timestamp: "2021-06-01T00:00:00.000Z", close: 0 },
      { timestamp: "2021-06-02T00:00:00.000Z", close: Number.NaN }
    ];
    const result = runBacktest({ candles, initialCapital: 1000, monthlyContribution: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("sollte rechnen");
    expect(result.symbolPoints).toBe(600);
  });
});

describe("Einmalanlage", () => {
  const flat = runBacktest({ candles: series(600, 100, 0), initialCapital: 10_000, monthlyContribution: 0 });

  it("lässt einen unveränderten Kurs unverändert", () => {
    expect(flat.ok).toBe(true);
    if (!flat.ok) throw new Error("sollte rechnen");
    expect(flat.finalValue).toBeCloseTo(10_000, 6);
    expect(flat.profit).toBeCloseTo(0, 6);
    expect(flat.timeWeightedCagr).toBeCloseTo(0, 6);
    expect(flat.maxDrawdown).toBe(0);
  });

  it("rechnet die Jahresrendite aus dem Kursverlauf", () => {
    // Verdopplung ueber genau vier Jahre -> 2^(1/4) - 1 = 18,92 % p.a.
    const candles = series(600);
    const last = candles.length - 1;
    candles[last] = { ...candles[last], close: candles[0].close * 2 };
    const spanYears =
      (new Date(candles[last].timestamp).getTime() - new Date(candles[0].timestamp).getTime()) /
      (365.25 * 86_400_000);

    const result = runBacktest({ candles, initialCapital: 1000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.timeWeightedCagr).toBeCloseTo((2 ** (1 / spanYears) - 1) * 100, 4);
  });

  it("zählt jede Einzahlung genau einmal", () => {
    const result = runBacktest({ candles: series(600), initialCapital: 5_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.invested).toBe(5_000);
    expect(result.curve[result.curve.length - 1].invested).toBe(5_000);
  });
});

describe("Sparplan", () => {
  const withPlan = runBacktest({ candles: series(600), initialCapital: 1_000, monthlyContribution: 100 });

  it("kauft einmal je Monat, nicht einmal je Handelstag", () => {
    if (!withPlan.ok) throw new Error("sollte rechnen");

    const months = new Set(withPlan.curve.map((point) => point.date.slice(0, 7))).size;
    // Startkapital plus eine Einzahlung je Monat ausser dem ersten.
    expect(withPlan.invested).toBe(1_000 + (months - 1) * 100);
  });

  it("trennt zeitgewichtete und geldgewichtete Rendite", () => {
    // Bei steigendem Kurs liegt der Sparplan unter der Strategie: das spaeter
    // eingezahlte Geld war kuerzer investiert. Beide Zahlen als "die Rendite"
    // auszugeben waere Scheingenauigkeit.
    // Wichtig: **ungleichmaessiger** Verlauf. Bei konstanter Tagesrendite sind
    // beide Zahlen zwangslaeufig identisch -- jeder Euro verzinst sich gleich,
    // egal wann er kam. Mein erster Anlauf hatte genau diesen Fehler und
    // "bewies" eine Trennung, die es dort nicht geben kann.
    const flat = series(600, 100, 0);
    const candles = flat.map((candle, index) =>
      // Erst ein Absturz, dann die Erholung. Spaete Einzahlungen kaufen billig.
      ({ ...candle, close: index < 300 ? 100 - (index / 300) * 60 : 40 + ((index - 300) / 300) * 120 })
    );

    const rising = runBacktest({ candles, initialCapital: 1_000, monthlyContribution: 500 });
    if (!rising.ok) throw new Error("sollte rechnen");

    expect(rising.timeWeightedCagr).toBeGreaterThan(0);
    expect(rising.moneyWeightedIrr).not.toBeNull();
    expect(Math.abs(rising.moneyWeightedIrr! - rising.timeWeightedCagr)).toBeGreaterThan(0.5);
  });

  it("führt den Depotwert und das Eingezahlte getrennt", () => {
    if (!withPlan.ok) throw new Error("sollte rechnen");

    const point = withPlan.curve[withPlan.curve.length - 1];
    expect(point.value).toBeGreaterThan(0);
    expect(point.invested).toBe(withPlan.invested);
    expect(withPlan.profit).toBeCloseTo(withPlan.finalValue - withPlan.invested, 6);
  });
});

describe("Drawdown", () => {
  it("misst den echten Rückgang vom Hoch", () => {
    // 100 -> 200 -> 120 -> 180. Groesster Rueckgang: 200 auf 120 = -40 %.
    // Die drei Punkte muessen **nach** der erzeugten Reihe liegen. Im ersten
    // Anlauf lagen sie mittendrin; nach dem Sortieren stand eine 100 hinter der
    // 200 und der groesste Rueckgang war -50 %. Der Code hatte recht, die
    // Fixture nicht.
    const base = series(597, 100, 0);
    const afterBase = new Date(base[base.length - 1].timestamp).getTime();
    const candles: BacktestCandle[] = [
      ...base,
      { timestamp: new Date(afterBase + 30 * 86_400_000).toISOString(), close: 200 },
      { timestamp: new Date(afterBase + 200 * 86_400_000).toISOString(), close: 120 },
      { timestamp: new Date(afterBase + 400 * 86_400_000).toISOString(), close: 180 }
    ];

    const result = runBacktest({ candles, initialCapital: 1_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.maxDrawdown).toBeCloseTo(-40, 6);
    expect(result.maxDrawdownFrom).toBe(candles[597].timestamp.slice(0, 10));
    expect(result.maxDrawdownTo).toBe(candles[598].timestamp.slice(0, 10));
  });

  it("lässt sich von laufenden Einzahlungen nicht kleinrechnen", () => {
    // Der eigentliche Punkt. Am Depotwert gemessen wuerde ein Sparplan, der
    // mitten im Absturz weiter kauft, den Absturz optisch verkleinern -- die
    // Einzahlungen heben die Kurve an. Der Drawdown gehoert an den Kurs.
    // Die drei Punkte muessen **nach** der erzeugten Reihe liegen. Im ersten
    // Anlauf lagen sie mittendrin; nach dem Sortieren stand eine 100 hinter der
    // 200 und der groesste Rueckgang war -50 %. Der Code hatte recht, die
    // Fixture nicht.
    const base = series(597, 100, 0);
    const afterBase = new Date(base[base.length - 1].timestamp).getTime();
    const candles: BacktestCandle[] = [
      ...base,
      { timestamp: new Date(afterBase + 30 * 86_400_000).toISOString(), close: 200 },
      { timestamp: new Date(afterBase + 200 * 86_400_000).toISOString(), close: 120 },
      { timestamp: new Date(afterBase + 400 * 86_400_000).toISOString(), close: 180 }
    ];

    const ohnePlan = runBacktest({ candles, initialCapital: 1_000, monthlyContribution: 0 });
    const mitPlan = runBacktest({ candles, initialCapital: 1_000, monthlyContribution: 5_000 });
    if (!ohnePlan.ok || !mitPlan.ok) throw new Error("sollte rechnen");

    expect(mitPlan.maxDrawdown).toBeCloseTo(ohnePlan.maxDrawdown, 6);
  });

  it("meldet bei stetig steigendem Kurs keinen Rückgang", () => {
    const result = runBacktest({ candles: series(600, 100, 0.001), initialCapital: 1_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.maxDrawdown).toBe(0);
  });
});

describe("Kalenderjahre", () => {
  it("überspringt angefangene Jahre am Rand", () => {
    // Sonst waere ein "schlechtestes Jahr" aus sechs Wochen Januar moeglich --
    // eine Aussage ueber sechs Wochen mit einer Jahreszahl davor.
    const result = runBacktest({ candles: series(600, 100, 0.0004), initialCapital: 1_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    const firstYear = new Date(result.from).getUTCFullYear();
    const lastYear = new Date(result.to).getUTCFullYear();

    expect(result.bestYear).not.toBeNull();
    expect(result.bestYear!.year).toBeGreaterThanOrEqual(firstYear);
    expect(result.bestYear!.year).toBeLessThanOrEqual(lastYear);
    expect(result.worstYear!.changePercent).toBeLessThanOrEqual(result.bestYear!.changePercent);
  });
});

describe("interner Zinsfuß", () => {
  it("findet eine bekannte Lösung", () => {
    // 1000 rein, ein Jahr spaeter 1100 raus -> 10 %.
    const irr = internalRateOfReturn(
      [{ date: "2025-01-01T00:00:00.000Z", amount: 1000 }],
      1100,
      "2026-01-01T00:00:00.000Z"
    );

    expect(irr).toBeCloseTo(10, 1);
  });

  it("erkennt einen Totalverlust", () => {
    const irr = internalRateOfReturn(
      [{ date: "2025-01-01T00:00:00.000Z", amount: 1000 }],
      1,
      "2026-01-01T00:00:00.000Z"
    );

    expect(irr).toBeLessThan(-90);
  });

  it("gibt zu, wenn es keine Lösung gibt", () => {
    // Statt eine Zahl zu liefern, die nur so aussieht, als waere sie eine.
    expect(internalRateOfReturn([], 100, "2026-01-01T00:00:00.000Z")).toBeNull();
    expect(
      internalRateOfReturn([{ date: "2026-01-01T00:00:00.000Z", amount: 1000 }], 1100, "2025-01-01T00:00:00.000Z")
    ).toBeNull();
  });
});

describe("Vorbehalte", () => {
  it("nennt Gebühren, Steuern und Dividenden", () => {
    const result = runBacktest({ candles: series(600), initialCapital: 1_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    const text = result.caveats.join(" ");
    expect(text).toMatch(/Gebühren/);
    expect(text).toMatch(/Steuern/);
    expect(text).toMatch(/Dividenden/);
  });

  it("sagt, dass ein Backtest keine Vorhersage ist", () => {
    const result = runBacktest({ candles: series(600), initialCapital: 1_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte rechnen");

    expect(result.caveats.join(" ")).toMatch(/sagt nichts darüber, was sein wird/);
  });

  it("weist fehlende Corporate-Action- und Point-in-Time-Evidenz aus", () => {
    const result = runBacktest({ candles: series(600), initialCapital: 1_000, monthlyContribution: 0 });
    if (!result.ok) throw new Error("sollte mit Einschränkungen rechnen");

    expect(result.dataIntegrity.priceBasis).toBe("unadjusted_close");
    expect(result.dataIntegrity.pointInTime).toBe(false);
    expect(result.caveats.join(" ")).toMatch(/Corporate Actions/);
    expect(result.caveats.join(" ")).toMatch(/Point-in-Time/);
  });
});

describe("Preisbasis", () => {
  it("verwendet eine vollständig gelieferte Adjusted-Close-Reihe", () => {
    const candles = series(600).map((candle, index) => ({
      ...candle,
      close: index < 300 ? 100 : 50,
      adjustedClose: 50
    }));
    const integrity = assessHistoricalDataIntegrity(candles);
    const result = runBacktest({
      candles,
      initialCapital: 1_000,
      monthlyContribution: 0,
      integrity
    });

    if (!result.ok) throw new Error("sollte mit Adjusted Close rechnen");
    expect(result.dataIntegrity.priceBasis).toBe("adjusted_close");
    expect(result.finalValue).toBeCloseTo(1_000, 6);
    expect(result.timeWeightedCagr).toBeCloseTo(0, 6);
  });

  it("verweigert eine gemischte Preisbasis", () => {
    const candles = series(600).map((candle, index) => ({
      ...candle,
      ...(index < 300 ? { adjustedClose: candle.close } : {})
    }));
    const result = runBacktest({
      candles,
      initialCapital: 1_000,
      monthlyContribution: 0,
      integrity: assessHistoricalDataIntegrity(candles)
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("hätte verweigern müssen");
    expect(result.reason).toContain("methodisch inkonsistent");
  });
});
