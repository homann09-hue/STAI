import "server-only";

import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  aggregateModelEvaluation,
  evaluateForecastOutcome,
  type ForecastOutcomeResult
} from "@/lib/forecast-outcome";
import {
  buildOutcomeUpdate,
  extractEvaluationBand,
  toOutcomeNumber as toNumber
} from "@/lib/forecast-outcome-mapping";

export { buildOutcomeUpdate, extractEvaluationBand } from "@/lib/forecast-outcome-mapping";

/**
 * Wertet faellige Prognosen gegen das eingetretene Ergebnis aus.
 *
 * Ohne diesen Schritt ist der Forecast Ledger ein Archiv. Erst der Vergleich
 * mit dem tatsaechlichen Kurs und einer naiven Baseline macht daraus eine
 * ueberpruefbare Trefferbilanz.
 *
 * Bewusste Eigenschaften:
 * - Schlechte Ergebnisse werden geschrieben, nicht verworfen.
 * - Fehlt der realisierte Kurs, wird `insufficient_data` gesetzt statt ein
 *   Ergebnis geschaetzt.
 * - Der Job ist idempotent: er nimmt nur `pending`-Eintraege, deren Faelligkeit
 *   erreicht ist.
 */

const MAX_BATCH = 100;

export interface OutcomeWorkerResult {
  status: "completed" | "skipped" | "failed";
  due: number;
  evaluated: number;
  matured: number;
  insufficientData: number;
  failed: number;
  reason?: string;
}

interface ForecastRow {
  id: string;
  symbol: string;
  model_key: string;
  model_version: string;
  base_price: string | number | null;
  forecast_status: string;
  probability_up: string | number;
  probability_down: string | number;
  probability_sideways: string | number;
  bands: unknown;
}

interface OutcomeRow {
  id: string;
  forecast_id: string;
  symbol: string;
  evaluation_due_at: string;
}

/**
 * Fuehrt die Auswertung aus.
 *
 * `resolveRealizedPrice` wird injiziert, damit der Worker ohne Provider
 * testbar bleibt und die Kursquelle austauschbar ist.
 */
export async function runForecastOutcomeWorker(
  resolveRealizedPrice: (symbol: string) => Promise<number | null>,
  now = new Date()
): Promise<OutcomeWorkerResult> {
  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    return {
      status: "skipped",
      due: 0,
      evaluated: 0,
      matured: 0,
      insufficientData: 0,
      failed: 0,
      reason: "Supabase Service-Client nicht konfiguriert"
    };
  }

  const { data: dueRows, error: dueError } = await supabase
    .from("forecast_outcomes")
    .select("id,forecast_id,symbol,evaluation_due_at")
    .eq("outcome_status", "pending")
    .lte("evaluation_due_at", now.toISOString())
    .order("evaluation_due_at", { ascending: true })
    .limit(MAX_BATCH);

  if (dueError) {
    logEvent("error", "forecast_outcome.due_query_failed", {
      code: dueError.code,
      message: dueError.message
    });
    return {
      status: "failed",
      due: 0,
      evaluated: 0,
      matured: 0,
      insufficientData: 0,
      failed: 0,
      reason: dueError.message
    };
  }

  const due = (dueRows ?? []) as OutcomeRow[];
  if (due.length === 0) {
    return { status: "completed", due: 0, evaluated: 0, matured: 0, insufficientData: 0, failed: 0 };
  }

  let matured = 0;
  let insufficientData = 0;
  let failed = 0;

  for (const outcome of due) {
    const { data: forecastData, error: forecastError } = await supabase
      .from("forecasts")
      .select(
        "id,symbol,model_key,model_version,base_price,forecast_status,probability_up,probability_down,probability_sideways,bands"
      )
      .eq("id", outcome.forecast_id)
      .maybeSingle();

    if (forecastError || !forecastData) {
      failed += 1;
      logEvent("warn", "forecast_outcome.forecast_missing", {
        outcomeId: outcome.id,
        code: forecastError?.code
      });
      continue;
    }

    const forecast = forecastData as ForecastRow;

    // Kein Kurs bedeutet kein Ergebnis. Nicht schaetzen.
    let realizedPrice: number | null = null;
    try {
      realizedPrice = await resolveRealizedPrice(outcome.symbol);
    } catch (error) {
      logEvent("warn", "forecast_outcome.price_lookup_failed", {
        symbol: outcome.symbol,
        message: error instanceof Error ? error.message : "unknown"
      });
    }

    const result = evaluateForecastOutcome({
      basePrice: toNumber(forecast.base_price),
      realizedPrice,
      band: extractEvaluationBand(forecast.bands),
      probabilityUp: toNumber(forecast.probability_up) ?? 0,
      probabilityDown: toNumber(forecast.probability_down) ?? 0,
      probabilitySideways: toNumber(forecast.probability_sideways) ?? 0,
      forecastStatus:
        forecast.forecast_status === "blocked" || forecast.forecast_status === "limited"
          ? forecast.forecast_status
          : "ready"
    });

    const { error: updateError } = await supabase
      .from("forecast_outcomes")
      .update(buildOutcomeUpdate(result, realizedPrice))
      .eq("id", outcome.id);

    if (updateError) {
      failed += 1;
      logEvent("warn", "forecast_outcome.update_failed", {
        outcomeId: outcome.id,
        code: updateError.code,
        message: updateError.message
      });
      continue;
    }

    if (result.outcomeStatus === "matured") matured += 1;
    else insufficientData += 1;
  }

  return {
    status: "completed",
    due: due.length,
    evaluated: matured + insufficientData,
    matured,
    insufficientData,
    failed
  };
}

/**
 * Bildet aus den ausgewerteten Ergebnissen eine Modellbilanz und schreibt sie
 * fort. Das ist der Teil, der die Trefferbilanz sichtbar macht.
 */
export async function writeModelEvaluation(
  modelKey: string,
  modelVersion: string,
  windowStart: Date,
  windowEnd: Date
) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return { status: "skipped" as const, reason: "kein Service-Client" };

  const { data, error } = await supabase
    .from("forecast_outcomes")
    .select(
      "outcome_status,inside_forecast_band,direction_hit,model_error_percent,baseline_error_percent,realized_return_percent,evaluated_at"
    )
    .gte("evaluated_at", windowStart.toISOString())
    .lte("evaluated_at", windowEnd.toISOString())
    .limit(5000);

  if (error) {
    logEvent("error", "forecast_outcome.evaluation_query_failed", { code: error.code, message: error.message });
    return { status: "failed" as const, reason: error.message };
  }

  const results: ForecastOutcomeResult[] = (data ?? []).map((row) => ({
    outcomeStatus: row.outcome_status,
    realizedReturnPercent: toNumber(row.realized_return_percent),
    insideForecastBand: row.inside_forecast_band,
    predictedDirection: null,
    realizedDirection: null,
    directionHit: row.direction_hit,
    modelErrorPercent: toNumber(row.model_error_percent),
    baselineErrorPercent: toNumber(row.baseline_error_percent),
    modelBeatsBaselineBy: null,
    notes: []
  }));

  const summary = aggregateModelEvaluation(results);

  const { error: insertError } = await supabase.from("model_evaluations").insert({
    model_key: modelKey,
    model_version: modelVersion,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    forecast_count: summary.forecastCount,
    matured_count: summary.maturedCount,
    interval_coverage: summary.intervalCoveragePercent,
    direction_accuracy: summary.directionAccuracyPercent,
    average_model_error_percent: summary.averageModelErrorPercent,
    average_baseline_error_percent: summary.averageBaselineErrorPercent,
    calibration_bucket: summary.calibrationBucket,
    evaluation_payload: {
      calibrationErrorPercent: summary.calibrationErrorPercent,
      modelBeatsBaselineByPercent: summary.modelBeatsBaselineByPercent,
      beatsBaseline: summary.beatsBaseline,
      notes: summary.notes
    }
  });

  if (insertError) {
    logEvent("error", "forecast_outcome.evaluation_insert_failed", {
      code: insertError.code,
      message: insertError.message
    });
    return { status: "failed" as const, reason: insertError.message };
  }

  return { status: "stored" as const, summary };
}
