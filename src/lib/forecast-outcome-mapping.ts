import type { ForecastBandSnapshot, ForecastOutcomeResult } from "@/lib/forecast-outcome";

/**
 * Reine Abbildungen zwischen Datenbankzeilen und Auswertungslogik.
 *
 * Bewusst ohne `server-only` und ohne Supabase-Import, damit sie ohne Datenbank
 * testbar sind. Der Worker importiert von hier.
 */

export function toOutcomeNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Holt das Band zum Bewertungshorizont aus dem gespeicherten JSON.
 *
 * Der Ledger speichert alle Horizonte. Bewertet wird der Horizont, aus dem
 * `evaluationDueAt` abgeleitet wurde. Fehlt er, gibt es kein Band — es wird
 * bewusst **nicht** auf einen anderen Horizont ausgewichen, denn das waere eine
 * andere Aussage und wuerde die Bilanz verfaelschen.
 */
export function extractEvaluationBand(bands: unknown, horizon = "1M"): ForecastBandSnapshot {
  const empty: ForecastBandSnapshot = {
    medianReturnPercent: null,
    lowerReturnPercent: null,
    upperReturnPercent: null,
    expectedVolatilityPercent: null
  };

  if (!Array.isArray(bands)) return empty;

  const match = bands.find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && (entry as Record<string, unknown>).horizon === horizon
  );

  if (!match) return empty;

  return {
    medianReturnPercent: toOutcomeNumber(match.medianReturnPercent),
    lowerReturnPercent: toOutcomeNumber(match.lowerReturnPercent),
    upperReturnPercent: toOutcomeNumber(match.upperReturnPercent),
    expectedVolatilityPercent: toOutcomeNumber(match.expectedVolatilityPercent)
  };
}

/**
 * Baut die Datenbankzeile aus einem Auswertungsergebnis.
 *
 * `realized_price` wird nur bei einem gereiften Ergebnis geschrieben. Bei
 * `insufficient_data` bleibt es leer, damit kein Kurs gespeichert wird, der
 * nicht zur Bewertung gefuehrt hat.
 */
export function buildOutcomeUpdate(
  result: ForecastOutcomeResult,
  realizedPrice: number | null,
  evaluatedAt = new Date()
) {
  return {
    outcome_status: result.outcomeStatus,
    evaluated_at: evaluatedAt.toISOString(),
    realized_price: result.outcomeStatus === "matured" ? realizedPrice : null,
    realized_return_percent: result.realizedReturnPercent,
    inside_forecast_band: result.insideForecastBand,
    direction_hit: result.directionHit,
    baseline_return_percent: 0,
    baseline_error_percent: result.baselineErrorPercent,
    model_error_percent: result.modelErrorPercent,
    notes: result.notes.join(" ").slice(0, 4000) || null
  };
}
