import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildTrackRecordView, type ModelEvaluationRow } from "@/lib/forecast-track-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORECAST_MODEL_KEY = "stockpilot.forecast";

/**
 * Öffentliche Trefferbilanz des Prognosemodells.
 *
 * Bewusst ohne Auth: eine Bilanz, die man nur als angemeldeter Nutzer sieht,
 * ist kein Vertrauensbeleg. Es werden ausschließlich aggregierte Modellwerte
 * ausgeliefert, keine Nutzerdaten und keine einzelnen Prognosen.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const supabase = createSupabaseServiceClient();

  if (!supabase) {
    return jsonError("Trefferbilanz derzeit nicht abrufbar.", 503);
  }

  const { data, error } = await supabase
    .from("model_evaluations")
    .select(
      "model_key,model_version,window_start,window_end,forecast_count,matured_count,interval_coverage,direction_accuracy,average_model_error_percent,average_baseline_error_percent,calibration_bucket,created_at"
    )
    .eq("model_key", FORECAST_MODEL_KEY)
    .order("window_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logEvent("error", "track_record.query_failed", { code: error.code, message: error.message });
    return jsonError("Trefferbilanz derzeit nicht abrufbar.", 503);
  }

  const row: ModelEvaluationRow | null = data
    ? {
        modelKey: String(data.model_key),
        modelVersion: String(data.model_version),
        windowStart: String(data.window_start),
        windowEnd: String(data.window_end),
        forecastCount: Number(data.forecast_count ?? 0),
        maturedCount: Number(data.matured_count ?? 0),
        intervalCoveragePercent: data.interval_coverage === null ? null : Number(data.interval_coverage),
        directionAccuracyPercent: data.direction_accuracy === null ? null : Number(data.direction_accuracy),
        averageModelErrorPercent:
          data.average_model_error_percent === null ? null : Number(data.average_model_error_percent),
        averageBaselineErrorPercent:
          data.average_baseline_error_percent === null ? null : Number(data.average_baseline_error_percent),
        calibrationBucket: String(data.calibration_bucket ?? "unbekannt")
      }
    : null;

  const view = buildTrackRecordView(row);

  return jsonOk(
    {
      view,
      model: row ? { key: row.modelKey, version: row.modelVersion } : null,
      window: row ? { start: row.windowStart, end: row.windowEnd } : null
    },
    {
      headers: {
        // Kurz cachebar: die Bilanz ändert sich höchstens einmal täglich.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800"
      }
    }
  );
}
