// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ForecastTrackRecordView } from "./forecast-track-record-view";
import { buildTrackRecordView, type ModelEvaluationRow } from "@/lib/forecast-track-record";

/**
 * Diese Ansicht ist der einzige Ort, an dem StockPilot eine Aussage über die
 * eigene Prognosegüte macht. Die Tests prüfen deshalb nicht Layout, sondern
 * genau das, was der Nutzer daraus ablesen darf — und was nicht.
 */

function evaluation(overrides: Partial<ModelEvaluationRow> = {}): ModelEvaluationRow {
  return {
    modelKey: "stockpilot.forecast",
    modelVersion: "1.0.0-deterministic",
    windowStart: "2026-05-09T00:00:00.000Z",
    windowEnd: "2026-08-07T00:00:00.000Z",
    forecastCount: 120,
    maturedCount: 84,
    intervalCoveragePercent: 66.7,
    directionAccuracyPercent: 48.8,
    averageModelErrorPercent: 4.4,
    averageBaselineErrorPercent: 6.9,
    calibrationBucket: "kalibriert",
    ...overrides
  };
}

/**
 * Prueft, ob eine Aussage im sichtbaren Text vorkommt.
 *
 * `getByText` scheitert hier an Prosa, weil eine Regex sowohl das Blattelement
 * als auch dessen Vorfahren trifft. Fuer die Frage "steht dieser Satz vor dem
 * Nutzer" ist der Textinhalt des Containers die passende Ebene.
 */
function expectVisibleText(container: HTMLElement, pattern: RegExp) {
  expect(container.textContent ?? "").toMatch(pattern);
}

function renderWith(row: ModelEvaluationRow | null) {
  return render(
    <ForecastTrackRecordView
      view={buildTrackRecordView(row)}
      model={row ? { key: row.modelKey, version: row.modelVersion } : null}
      window={row ? { start: row.windowStart, end: row.windowEnd } : null}
    />
  );
}

// Vitest laeuft hier ohne `globals`, deshalb raeumt Testing Library nicht
// automatisch auf. Ohne diesen Aufruf sammeln sich die Renders im selben
// Dokument und `screen`-Abfragen finden Treffer aus vorherigen Tests.
afterEach(cleanup);

describe("ForecastTrackRecordView", () => {
  it("zeigt ohne Daten keine einzige Quote an", () => {
    const { container } = renderWith(null);

    expect(screen.getByText(/noch keine ausgewertete Prognose/i)).toBeTruthy();
    // Entscheidend: kein Prozentwert irgendwo im Dokument. Eine leere Bilanz
    // darf nicht wie eine schlechte Bilanz aussehen.
    expect(container.textContent).not.toMatch(/\d+(,\d+)?\s?%/);
  });

  it("nennt ohne Daten ausdruecklich, dass keine Beispielwerte gezeigt werden", () => {
    const { container } = renderWith(null);
    expectVisibleText(container, /keine Beispiel-\s?oder Demowerte/i);
  });

  it("zeigt bei kleiner Stichprobe Zahlen, kennzeichnet sie aber als nicht belastbar", () => {
    renderWith(evaluation({ forecastCount: 8, maturedCount: 7 }));

    expect(screen.getByText(/zu wenige Prognosen/i)).toBeTruthy();
    expect(screen.getByText(/Stichprobe unter 20/i)).toBeTruthy();
  });

  it("stellt ein zu breites Band als Mangel dar, nicht als Erfolg", () => {
    const { container } = renderWith(evaluation({ intervalCoveragePercent: 99, calibrationBucket: "zu_breit" }));

    expect(screen.getByText("zu breit")).toBeTruthy();
    expectVisibleText(container, /sagt deshalb nichts aus/i);
  });

  it("weist einen Rueckstand gegenueber der Baseline offen aus", () => {
    renderWith(evaluation({ averageModelErrorPercent: 8, averageBaselineErrorPercent: 5 }));
    expect(screen.getByText(/^-3,00 Prozentpunkte$/)).toBeTruthy();
  });

  it("warnt sichtbar, wenn nur ein Teil der Prognosen bewertbar war", () => {
    renderWith(evaluation({ forecastCount: 100, maturedCount: 40 }));

    expect(screen.getByText("40 von 100")).toBeTruthy();
    expect(screen.getByText(/40 % der Prognosen waren überhaupt bewertbar/i)).toBeTruthy();
  });

  it("zeigt die Einschraenkungen immer, auch bei guter Bilanz", () => {
    const { container } = renderWith(evaluation());

    expectVisibleText(container, /nichts über künftige Ergebnisse/i);
    expectVisibleText(container, /nicht gelöscht/i);
    expectVisibleText(container, /Keine Anlageberatung/i);
  });

  it("nennt die Methodik statt sie zu verstecken", () => {
    const { container } = renderWith(evaluation());

    expectVisibleText(container, /Unveränderter Kurs \(naive Baseline\)/i);
    expectVisibleText(container, /20 bewertete Prognosen/i);
    expectVisibleText(container, /stockpilot\.forecast 1\.0\.0-deterministic/);
  });

  it("erfindet keine Werte, wenn Kennzahlen fehlen", () => {
    const { container } = renderWith(
      evaluation({
        intervalCoveragePercent: null,
        directionAccuracyPercent: null,
        averageModelErrorPercent: null,
        averageBaselineErrorPercent: null,
        calibrationBucket: "unbekannt"
      })
    );

    // Drei Kennzahlen ohne Wert muessen als Gedankenstrich erscheinen.
    const dashes = (container.textContent ?? "").match(/—/g) ?? [];
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("weist darauf hin, dass blockierte Prognosen nicht als Treffer zaehlen", () => {
    const { container } = renderWith(evaluation());
    expectVisibleText(container, /nicht bewertet und zählen nicht als Treffer/i);
  });
});
