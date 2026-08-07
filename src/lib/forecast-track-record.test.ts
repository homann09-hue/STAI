import { describe, expect, it } from "vitest";
import { buildTrackRecordView } from "./forecast-track-record";
import type { ModelEvaluationRow } from "./forecast-track-record";

function evaluation(overrides: Partial<ModelEvaluationRow> = {}): ModelEvaluationRow {
  return {
    modelKey: "stockpilot.forecast",
    modelVersion: "1.0.0-deterministic",
    windowStart: "2026-05-09T00:00:00.000Z",
    windowEnd: "2026-08-07T00:00:00.000Z",
    forecastCount: 60,
    maturedCount: 50,
    intervalCoveragePercent: 70,
    directionAccuracyPercent: 52,
    averageModelErrorPercent: 3,
    averageBaselineErrorPercent: 5,
    calibrationBucket: "kalibriert",
    ...overrides
  };
}

describe("buildTrackRecordView", () => {
  it("zeigt ohne Daten keine Zahlen an", () => {
    const view = buildTrackRecordView(null);

    expect(view.readiness).toBe("no_data");
    expect(view.metrics).toHaveLength(0);
    expect(view.headline).toMatch(/noch keine/i);
    expect(view.caveats.join(" ")).toMatch(/keine Beispiel|Demowerte/i);
  });

  it("behandelt eine Bilanz ohne gereifte Prognosen wie keine Daten", () => {
    const view = buildTrackRecordView(evaluation({ maturedCount: 0, forecastCount: 12 }));

    expect(view.readiness).toBe("no_data");
    expect(view.metrics).toHaveLength(0);
  });

  it("zeigt Zahlen bei kleiner Stichprobe, kennzeichnet sie aber als nicht belastbar", () => {
    const view = buildTrackRecordView(evaluation({ maturedCount: 7, forecastCount: 8 }));

    expect(view.readiness).toBe("insufficient_sample");
    expect(view.metrics.length).toBeGreaterThan(0);
    expect(view.headline).toMatch(/zu wenige/i);
    expect(view.caveats.join(" ")).toMatch(/Stichprobe unter 20/i);
  });

  it("meldet ab ausreichender Stichprobe eine belastbare Bilanz", () => {
    const view = buildTrackRecordView(evaluation());

    expect(view.readiness).toBe("reportable");
    expect(view.headline).toMatch(/50 bewerteten Prognosen/);
  });

  it("stellt ein zu breites Band als Mangel dar, nicht als Erfolg", () => {
    const view = buildTrackRecordView(
      evaluation({ intervalCoveragePercent: 99, calibrationBucket: "zu_breit" })
    );
    const calibration = view.metrics.find((metric) => metric.label === "Kalibrierung");

    expect(calibration?.value).toBe("zu breit");
    expect(calibration?.tone).not.toBe("good");
    expect(calibration?.meaning).toMatch(/sagt deshalb nichts aus/i);
  });

  it("stellt ein zu enges Band als Fehler dar", () => {
    const view = buildTrackRecordView(
      evaluation({ intervalCoveragePercent: 30, calibrationBucket: "zu_eng" })
    );
    const calibration = view.metrics.find((metric) => metric.label === "Kalibrierung");

    expect(calibration?.tone).toBe("bad");
  });

  it("weist einen Rueckstand gegenueber der Baseline offen aus", () => {
    const view = buildTrackRecordView(
      evaluation({ averageModelErrorPercent: 8, averageBaselineErrorPercent: 5 })
    );
    const baseline = view.metrics.find((metric) => metric.label === "Gegen naive Baseline");

    expect(baseline?.value).toMatch(/^-3/);
    expect(baseline?.tone).toBe("bad");
  });

  it("warnt sichtbar, wenn nur wenige Prognosen bewertbar waren", () => {
    // 12 von 100 bewertet: die Quoten beziehen sich auf eine Teilmenge.
    const view = buildTrackRecordView(evaluation({ forecastCount: 100, maturedCount: 40 }));

    expect(view.evaluationRatePercent).toBe(40);
    expect(view.caveats.join(" ")).toMatch(/40 % der Prognosen waren überhaupt bewertbar/i);

    const evaluated = view.metrics.find((metric) => metric.label === "Bewertete Prognosen");
    expect(evaluated?.tone).toBe("warn");
    expect(evaluated?.value).toBe("40 von 100");
  });

  it("nennt immer den Hinweis, dass schlechte Prognosen enthalten sind", () => {
    const view = buildTrackRecordView(evaluation());

    expect(view.caveats.join(" ")).toMatch(/nicht gelöscht/i);
    expect(view.caveats.join(" ")).toMatch(/keine Anlageberatung/i);
    expect(view.caveats.join(" ")).toMatch(/nichts über künftige Ergebnisse/i);
  });

  it("erfindet keine Werte, wenn einzelne Kennzahlen fehlen", () => {
    const view = buildTrackRecordView(
      evaluation({
        intervalCoveragePercent: null,
        directionAccuracyPercent: null,
        averageModelErrorPercent: null,
        averageBaselineErrorPercent: null,
        calibrationBucket: "unbekannt"
      })
    );

    expect(view.metrics.find((m) => m.label === "Bandabdeckung")?.value).toBe("—");
    expect(view.metrics.find((m) => m.label === "Richtungstreffer")?.value).toBe("—");
    expect(view.metrics.find((m) => m.label === "Gegen naive Baseline")?.value).toBe("—");
  });

  it("bildet eine realistische Bilanz korrekt ab", () => {
    // Werte aus einem Testlauf gegen die Produktionsdatenbank.
    const view = buildTrackRecordView(
      evaluation({
        forecastCount: 120,
        maturedCount: 84,
        intervalCoveragePercent: 66.7,
        directionAccuracyPercent: 48.8,
        averageModelErrorPercent: 4.4,
        averageBaselineErrorPercent: 6.9,
        calibrationBucket: "kalibriert"
      })
    );

    expect(view.readiness).toBe("reportable");
    expect(view.evaluationRatePercent).toBe(70);
    expect(view.metrics.find((m) => m.label === "Bewertete Prognosen")?.value).toBe("84 von 120");
    expect(view.metrics.find((m) => m.label === "Bandabdeckung")?.value).toBe("66,7 %");
    expect(view.metrics.find((m) => m.label === "Gegen naive Baseline")?.value).toBe("+2,50 Prozentpunkte");
    // Bei 70 % Bewertungsquote darf keine Teilmengen-Warnung erscheinen.
    expect(view.caveats.join(" ")).not.toMatch(/überhaupt bewertbar/i);
  });

  it("nennt den Zufallswert bei der Richtungsquote, damit sie einordbar ist", () => {
    const view = buildTrackRecordView(evaluation());
    const direction = view.metrics.find((metric) => metric.label === "Richtungstreffer");

    expect(direction?.meaning).toMatch(/Zufallswert/i);
  });
});
