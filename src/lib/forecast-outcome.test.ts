import { describe, expect, it } from "vitest";
import {
  NOMINAL_BAND_COVERAGE_PERCENT,
  aggregateModelEvaluation,
  classifyDirection,
  evaluateForecastOutcome,
  predictedDirectionFromProbabilities,
  sidewaysThresholdPercent
} from "./forecast-outcome";
import type { ForecastOutcomeInput, ForecastOutcomeResult } from "./forecast-outcome";

function input(overrides: Partial<ForecastOutcomeInput> = {}): ForecastOutcomeInput {
  return {
    basePrice: 100,
    realizedPrice: 105,
    band: {
      medianReturnPercent: 4,
      lowerReturnPercent: -6,
      upperReturnPercent: 14,
      expectedVolatilityPercent: 10
    },
    probabilityUp: 55,
    probabilityDown: 25,
    probabilitySideways: 20,
    forecastStatus: "ready",
    ...overrides
  };
}

describe("evaluateForecastOutcome", () => {
  it("berechnet die realisierte Rendite aus Ausgangs- und Endpreis", () => {
    const result = evaluateForecastOutcome(input());
    expect(result.realizedReturnPercent).toBe(5);
    expect(result.outcomeStatus).toBe("matured");
  });

  it("erkennt ein Ergebnis innerhalb und ausserhalb des Bands", () => {
    expect(evaluateForecastOutcome(input()).insideForecastBand).toBe(true);
    expect(evaluateForecastOutcome(input({ realizedPrice: 130 })).insideForecastBand).toBe(false);
    expect(evaluateForecastOutcome(input({ realizedPrice: 80 })).insideForecastBand).toBe(false);
  });

  it("behandelt die Bandgrenzen als eingeschlossen", () => {
    // 114 = exakt obere Grenze bei Basis 100 und +14 %.
    expect(evaluateForecastOutcome(input({ realizedPrice: 114 })).insideForecastBand).toBe(true);
    expect(evaluateForecastOutcome(input({ realizedPrice: 94 })).insideForecastBand).toBe(true);
  });

  it("bewertet eine blockierte Prognose nicht", () => {
    const result = evaluateForecastOutcome(input({ forecastStatus: "blocked" }));

    expect(result.outcomeStatus).toBe("blocked");
    expect(result.realizedReturnPercent).toBeNull();
    expect(result.directionHit).toBeNull();
  });

  it("erfindet kein Ergebnis, wenn der realisierte Preis fehlt", () => {
    const result = evaluateForecastOutcome(input({ realizedPrice: null }));

    expect(result.outcomeStatus).toBe("insufficient_data");
    expect(result.realizedReturnPercent).toBeNull();
    expect(result.notes.join(" ")).toMatch(/realisierter Preis/i);
  });

  it("erfindet kein Ergebnis bei fehlendem oder unmoeglichem Ausgangspreis", () => {
    expect(evaluateForecastOutcome(input({ basePrice: null })).outcomeStatus).toBe("insufficient_data");
    expect(evaluateForecastOutcome(input({ basePrice: 0 })).outcomeStatus).toBe("insufficient_data");
    expect(evaluateForecastOutcome(input({ realizedPrice: -5 })).outcomeStatus).toBe("insufficient_data");
  });

  it("vergleicht das Modell gegen die naive Baseline", () => {
    // Realisiert +5 %, Modellmedian +4 % -> Fehler 1. Baseline 0 % -> Fehler 5.
    const result = evaluateForecastOutcome(input());

    expect(result.modelErrorPercent).toBe(1);
    expect(result.baselineErrorPercent).toBe(5);
    expect(result.modelBeatsBaselineBy).toBe(4);
  });

  it("weist aus, wenn das Modell schlechter als die Baseline ist", () => {
    // Realisiert 0 %, Modell sagte +4 % -> Modellfehler 4, Baseline 0.
    const result = evaluateForecastOutcome(input({ realizedPrice: 100 }));

    expect(result.modelErrorPercent).toBe(4);
    expect(result.baselineErrorPercent).toBe(0);
    expect(result.modelBeatsBaselineBy).toBe(-4);
  });

  it("wertet einen Richtungstreffer nur bei eindeutiger Prognose", () => {
    const hit = evaluateForecastOutcome(input());
    expect(hit.predictedDirection).toBe("up");
    expect(hit.realizedDirection).toBe("up");
    expect(hit.directionHit).toBe(true);

    const miss = evaluateForecastOutcome(input({ realizedPrice: 85 }));
    expect(miss.realizedDirection).toBe("down");
    expect(miss.directionHit).toBe(false);
  });

  it("wertet einen Gleichstand weder als Treffer noch als Fehltreffer", () => {
    const result = evaluateForecastOutcome(
      input({ probabilityUp: 40, probabilityDown: 40, probabilitySideways: 20 })
    );

    expect(result.predictedDirection).toBeNull();
    expect(result.directionHit).toBeNull();
    expect(result.notes.join(" ")).toMatch(/keine Richtung/i);
  });

  it("raet keine Richtung ohne erwartete Volatilitaet", () => {
    const result = evaluateForecastOutcome(
      input({ band: { ...input().band, expectedVolatilityPercent: null } })
    );

    expect(result.realizedDirection).toBeNull();
    expect(result.directionHit).toBeNull();
    expect(result.notes.join(" ")).toMatch(/Volatilität/i);
  });

  it("bewertet die Bandabdeckung nicht bei unvollstaendigem Band", () => {
    const result = evaluateForecastOutcome(
      input({ band: { ...input().band, lowerReturnPercent: null } })
    );

    expect(result.insideForecastBand).toBeNull();
    expect(result.notes.join(" ")).toMatch(/Band/i);
    // Der Rest bleibt trotzdem auswertbar.
    expect(result.realizedReturnPercent).toBe(5);
  });
});

describe("sidewaysThresholdPercent", () => {
  it("leitet die Schwelle aus der erwarteten Volatilitaet ab", () => {
    expect(sidewaysThresholdPercent(30)).toBe(10);
  });

  it("liefert ohne brauchbare Volatilitaet keine Schwelle", () => {
    expect(sidewaysThresholdPercent(null)).toBeNull();
    expect(sidewaysThresholdPercent(0)).toBeNull();
    expect(sidewaysThresholdPercent(Number.NaN)).toBeNull();
  });

  it("behandelt kleine Bewegungen volatilitaetsabhaengig", () => {
    // 1 % ist bei ruhigem Wert eine Richtung, bei volatilem Rauschen.
    expect(classifyDirection(1, sidewaysThresholdPercent(1.5))).toBe("up");
    expect(classifyDirection(1, sidewaysThresholdPercent(30))).toBe("sideways");
  });
});

describe("predictedDirectionFromProbabilities", () => {
  it("waehlt die dominante Richtung", () => {
    expect(
      predictedDirectionFromProbabilities({ probabilityUp: 20, probabilityDown: 60, probabilitySideways: 20 })
    ).toBe("down");
  });

  it("legt sich bei Gleichstand nicht fest", () => {
    expect(
      predictedDirectionFromProbabilities({ probabilityUp: 50, probabilityDown: 50, probabilitySideways: 0 })
    ).toBeNull();
  });
});

function matured(overrides: Partial<ForecastOutcomeResult> = {}): ForecastOutcomeResult {
  return {
    outcomeStatus: "matured",
    realizedReturnPercent: 5,
    insideForecastBand: true,
    predictedDirection: "up",
    realizedDirection: "up",
    directionHit: true,
    modelErrorPercent: 2,
    baselineErrorPercent: 5,
    modelBeatsBaselineBy: 3,
    notes: [],
    ...overrides
  };
}

describe("aggregateModelEvaluation", () => {
  it("erkennt ein gut kalibriertes Band nahe der nominellen Abdeckung", () => {
    // 68 von 100 innerhalb des Bands entspricht der 1-Sigma-Erwartung.
    const results = [
      ...Array.from({ length: 68 }, () => matured({ insideForecastBand: true })),
      ...Array.from({ length: 32 }, () => matured({ insideForecastBand: false }))
    ];
    const summary = aggregateModelEvaluation(results);

    expect(summary.intervalCoveragePercent).toBe(68);
    expect(summary.calibrationBucket).toBe("kalibriert");
    expect(summary.calibrationErrorPercent).toBeLessThan(1);
  });

  it("erkennt ein zu enges Band", () => {
    const results = [
      ...Array.from({ length: 30 }, () => matured({ insideForecastBand: true })),
      ...Array.from({ length: 70 }, () => matured({ insideForecastBand: false }))
    ];
    expect(aggregateModelEvaluation(results).calibrationBucket).toBe("zu_eng");
  });

  it("erkennt ein zu breites Band ebenfalls als Fehler", () => {
    // Ein Band, das fast immer trifft, sagt nichts aus. Das ist kein Erfolg.
    const results = Array.from({ length: 100 }, () => matured({ insideForecastBand: true }));
    expect(aggregateModelEvaluation(results).calibrationBucket).toBe("zu_breit");
  });

  it("laesst sich die Trefferquote nicht durch unbewertbare Faelle schoenen", () => {
    // 5 Treffer, 95 als unbewertbar markiert. Die Quote ist formal 100 %,
    // die Aussage aber wertlos — und genau das muss sichtbar werden.
    const results = [
      ...Array.from({ length: 5 }, () => matured({ directionHit: true })),
      ...Array.from({ length: 95 }, () =>
        matured({ outcomeStatus: "insufficient_data", directionHit: null, insideForecastBand: null })
      )
    ];
    const summary = aggregateModelEvaluation(results);

    expect(summary.directionAccuracyPercent).toBe(100);
    expect(summary.forecastCount).toBe(100);
    expect(summary.maturedCount).toBe(5);
    expect(summary.beatsBaseline).toBeNull();
    expect(summary.notes.join(" ")).toMatch(/bewertbar/i);
    expect(summary.notes.join(" ")).toMatch(/Stichprobe zu klein/i);
  });

  it("trifft ohne ausreichende Stichprobe keine Baseline-Aussage", () => {
    const summary = aggregateModelEvaluation(Array.from({ length: 5 }, () => matured()));

    expect(summary.modelBeatsBaselineByPercent).toBe(3);
    expect(summary.beatsBaseline).toBeNull();
  });

  it("bestaetigt den Baseline-Vorsprung erst ab ausreichender Stichprobe", () => {
    const summary = aggregateModelEvaluation(Array.from({ length: 25 }, () => matured()));

    expect(summary.beatsBaseline).toBe(true);
    expect(summary.averageModelErrorPercent).toBe(2);
    expect(summary.averageBaselineErrorPercent).toBe(5);
  });

  it("meldet ein Modell, das die Baseline nicht schlaegt, als solches", () => {
    const summary = aggregateModelEvaluation(
      Array.from({ length: 25 }, () =>
        matured({ modelErrorPercent: 8, baselineErrorPercent: 5, modelBeatsBaselineBy: -3 })
      )
    );

    expect(summary.beatsBaseline).toBe(false);
    expect(summary.modelBeatsBaselineByPercent).toBe(-3);
  });

  it("liefert bei leerer Eingabe keine erfundenen Quoten", () => {
    const summary = aggregateModelEvaluation([]);

    expect(summary.intervalCoveragePercent).toBeNull();
    expect(summary.directionAccuracyPercent).toBeNull();
    expect(summary.beatsBaseline).toBeNull();
    expect(summary.calibrationBucket).toBe("unbekannt");
  });

  it("haelt die nominelle Abdeckung als dokumentierten Sollwert bereit", () => {
    expect(NOMINAL_BAND_COVERAGE_PERCENT).toBeCloseTo(68.27, 2);
  });
});
