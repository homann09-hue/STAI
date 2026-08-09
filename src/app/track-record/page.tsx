import type { Metadata } from "next";
import { ForecastTrackRecordView } from "@/components/forecast-track-record-view";
import { buildTrackRecordView, type ModelEvaluationRow } from "@/lib/forecast-track-record";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORECAST_MODEL_KEY = "stockpilot.forecast";

export const metadata: Metadata = {
  title: "Trefferbilanz",
  description:
    "Überprüfbare Bilanz aller veröffentlichten Prognosen: Bandabdeckung, Kalibrierung, Richtungstreffer und Vergleich gegen eine naive Baseline. Keine Anlageberatung.",
  robots: {
    index: true,
    follow: true
  }
};

async function loadLatestEvaluation(): Promise<ModelEvaluationRow | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("model_evaluations")
    .select(
      "model_key,model_version,window_start,window_end,forecast_count,matured_count,interval_coverage,direction_accuracy,average_model_error_percent,average_baseline_error_percent,calibration_bucket"
    )
    .eq("model_key", FORECAST_MODEL_KEY)
    .order("window_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logEvent("warn", "track_record_page.query_failed", { code: error.code, message: error.message });
    return null;
  }

  if (!data) return null;

  return {
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
  };
}

export default async function TrackRecordPage() {
  const evaluation = await loadLatestEvaluation();
  const view = buildTrackRecordView(evaluation);

  return (
    <ForecastTrackRecordView
      view={view}
      model={evaluation ? { key: evaluation.modelKey, version: evaluation.modelVersion } : null}
      window={evaluation ? { start: evaluation.windowStart, end: evaluation.windowEnd } : null}
    />
  );
}
