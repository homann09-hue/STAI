import { describe, expect, it } from "vitest";
import { evaluateForecastOutcome } from "./forecast-outcome";
import { buildOutcomeUpdate, extractEvaluationBand } from "./forecast-outcome-mapping";

const storedBands = [
  { horizon: "1W", medianReturnPercent: 1, lowerReturnPercent: -3, upperReturnPercent: 5, expectedVolatilityPercent: 4 },
  { horizon: "1M", medianReturnPercent: 4, lowerReturnPercent: -6, upperReturnPercent: 14, expectedVolatilityPercent: 10 },
  { horizon: "3M", medianReturnPercent: 7, lowerReturnPercent: -12, upperReturnPercent: 26, expectedVolatilityPercent: 18 }
];

describe("extractEvaluationBand", () => {
  it("nimmt genau den Bewertungshorizont, nicht irgendeinen", () => {
    const band = extractEvaluationBand(storedBands, "1M");

    expect(band.medianReturnPercent).toBe(4);
    expect(band.lowerReturnPercent).toBe(-6);
    expect(band.upperReturnPercent).toBe(14);
  });

  it("weicht nicht auf einen anderen Horizont aus, wenn der gesuchte fehlt", () => {
    // Ein anderer Horizont waere eine andere Aussage. Lieber kein Band.
    const band = extractEvaluationBand(storedBands, "12M");

    expect(band.medianReturnPercent).toBeNull();
    expect(band.lowerReturnPercent).toBeNull();
    expect(band.upperReturnPercent).toBeNull();
  });

  it("haelt kaputtes oder fehlendes JSON aus", () => {
    for (const input of [null, undefined, "kein array", {}, [null], [{ horizon: "1M" }]]) {
      const band = extractEvaluationBand(input);
      expect(band.medianReturnPercent).toBeNull();
    }
  });

  it("wandelt numerische Strings aus der Datenbank um", () => {
    const band = extractEvaluationBand([
      { horizon: "1M", medianReturnPercent: "4.5", lowerReturnPercent: "-6", upperReturnPercent: "14", expectedVolatilityPercent: "10" }
    ]);

    expect(band.medianReturnPercent).toBe(4.5);
    expect(band.expectedVolatilityPercent).toBe(10);
  });
});

describe("Auswertung mit gespeichertem Band", () => {
  it("bewertet eine reale Prognose Ende zu Ende", () => {
    const result = evaluateForecastOutcome({
      basePrice: 200,
      realizedPrice: 214,
      band: extractEvaluationBand(storedBands),
      probabilityUp: 55,
      probabilityDown: 25,
      probabilitySideways: 20,
      forecastStatus: "ready"
    });

    expect(result.outcomeStatus).toBe("matured");
    expect(result.realizedReturnPercent).toBe(7);
    expect(result.insideForecastBand).toBe(true);
    expect(result.directionHit).toBe(true);
    // Median 4 %, realisiert 7 % -> Fehler 3. Baseline 0 % -> Fehler 7.
    expect(result.modelErrorPercent).toBe(3);
    expect(result.modelBeatsBaselineBy).toBe(4);
  });

  it("haelt ein schlechtes Ergebnis fest, statt es zu verwerfen", () => {
    const result = evaluateForecastOutcome({
      basePrice: 200,
      realizedPrice: 140,
      band: extractEvaluationBand(storedBands),
      probabilityUp: 55,
      probabilityDown: 25,
      probabilitySideways: 20,
      forecastStatus: "ready"
    });

    expect(result.outcomeStatus).toBe("matured");
    expect(result.realizedReturnPercent).toBe(-30);
    expect(result.insideForecastBand).toBe(false);
    expect(result.directionHit).toBe(false);
    expect(result.modelBeatsBaselineBy).toBeLessThan(0);
  });
});

describe("buildOutcomeUpdate", () => {
  const base = evaluateForecastOutcome({
    basePrice: 200,
    realizedPrice: 214,
    band: extractEvaluationBand(storedBands),
    probabilityUp: 55,
    probabilityDown: 25,
    probabilitySideways: 20,
    forecastStatus: "ready"
  });

  it("schreibt den realisierten Kurs nur bei gereiftem Ergebnis", () => {
    const row = buildOutcomeUpdate(base, 214, new Date("2026-08-07T12:00:00.000Z"));

    expect(row.outcome_status).toBe("matured");
    expect(row.realized_price).toBe(214);
    expect(row.evaluated_at).toBe("2026-08-07T12:00:00.000Z");
  });

  it("speichert keinen Kurs, der nicht zur Bewertung gefuehrt hat", () => {
    const insufficient = evaluateForecastOutcome({
      basePrice: 200,
      realizedPrice: null,
      band: extractEvaluationBand(storedBands),
      probabilityUp: 55,
      probabilityDown: 25,
      probabilitySideways: 20,
      forecastStatus: "ready"
    });
    const row = buildOutcomeUpdate(insufficient, 214);

    expect(row.outcome_status).toBe("insufficient_data");
    expect(row.realized_price).toBeNull();
  });

  it("haelt die Baseline explizit als unveraenderten Kurs fest", () => {
    expect(buildOutcomeUpdate(base, 214).baseline_return_percent).toBe(0);
  });

  it("uebernimmt die Begruendungen als Notiz", () => {
    const blocked = evaluateForecastOutcome({
      basePrice: 200,
      realizedPrice: 214,
      band: extractEvaluationBand(storedBands),
      probabilityUp: 55,
      probabilityDown: 25,
      probabilitySideways: 20,
      forecastStatus: "blocked"
    });
    const row = buildOutcomeUpdate(blocked, null);

    expect(row.outcome_status).toBe("blocked");
    expect(row.notes).toMatch(/blockiert/i);
  });
});
