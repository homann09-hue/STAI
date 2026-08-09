import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { ForecastLedgerEntry, ForecastLedgerResponse } from "@/lib/forecast-ledger";
import { logEvent } from "@/lib/observability";

export type ForecastLedgerPersistenceStatus = "stored" | "duplicate" | "skipped" | "failed";

export interface ForecastLedgerPersistenceResult {
  status: ForecastLedgerPersistenceStatus;
  forecastId: string | null;
  outcomeId: string | null;
  reason: string;
  errorCode?: string;
}

type ForecastDbClient = Pick<SupabaseClient, "from">;

const FORECAST_MODEL_KEY = "stockpilot.forecast";

function isDuplicateError(error: PostgrestError | null) {
  return error?.code === "23505";
}

function isSchemaMissingError(error: PostgrestError | null) {
  return error?.code === "42P01" || error?.code === "PGRST204" || error?.code === "PGRST205";
}

function compactJsonArray(values: unknown[]) {
  return values.filter((value) => value !== null && value !== undefined);
}

export function buildForecastInsertPayload(response: ForecastLedgerResponse) {
  const { forecast, ledgerEntry } = response;

  return {
    symbol: ledgerEntry.symbol,
    asset_type: "unknown",
    currency: forecast.currency,
    model_key: FORECAST_MODEL_KEY,
    model_version: ledgerEntry.modelVersion,
    data_cutoff: ledgerEntry.dataCutoff,
    generated_at: forecast.generatedAt,
    provider: ledgerEntry.provider,
    quality: ledgerEntry.quality,
    forecast_status: ledgerEntry.forecastStatus,
    promotion_gate: ledgerEntry.promotionGate,
    base_price: ledgerEntry.basePrice,
    horizon: ledgerEntry.horizon,
    probability_up: ledgerEntry.probabilityUp,
    probability_down: ledgerEntry.probabilityDown,
    probability_sideways: ledgerEntry.probabilitySideways,
    confidence: ledgerEntry.confidence,
    quality_score: forecast.qualityScore,
    input_hash: ledgerEntry.inputDigest,
    source_count: ledgerEntry.sourceCount,
    bands: compactJsonArray(forecast.bands),
    scenarios: compactJsonArray(forecast.scenarios),
    drivers: compactJsonArray(forecast.drivers),
    risks: compactJsonArray(forecast.risks),
    blockers: compactJsonArray(ledgerEntry.blockers),
    sources: compactJsonArray(forecast.sources),
    provenance: response.provenance
  };
}

export function buildForecastOutcomePayload(forecastId: string, ledgerEntry: ForecastLedgerEntry) {
  if (!ledgerEntry.evaluationDueAt) return null;

  return {
    forecast_id: forecastId,
    symbol: ledgerEntry.symbol,
    evaluation_due_at: ledgerEntry.evaluationDueAt,
    outcome_status: "pending"
  };
}

async function findExistingForecastId(client: ForecastDbClient, ledgerEntry: ForecastLedgerEntry) {
  const { data, error } = await client
    .from("forecasts")
    .select("id")
    .eq("symbol", ledgerEntry.symbol)
    .eq("model_key", FORECAST_MODEL_KEY)
    .eq("model_version", ledgerEntry.modelVersion)
    .eq("data_cutoff", ledgerEntry.dataCutoff)
    .eq("input_hash", ledgerEntry.inputDigest)
    .maybeSingle();

  if (error || !data || typeof data.id !== "string") return null;
  return data.id;
}

async function insertForecast(client: ForecastDbClient, response: ForecastLedgerResponse) {
  const payload = buildForecastInsertPayload(response);
  const { data, error } = await client
    .from("forecasts")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (isDuplicateError(error)) {
    return {
      status: "duplicate" as const,
      id: await findExistingForecastId(client, response.ledgerEntry),
      error: null
    };
  }

  if (error || !data || typeof data.id !== "string") {
    return {
      status: "failed" as const,
      id: null,
      error
    };
  }

  return {
    status: "stored" as const,
    id: data.id,
    error: null
  };
}

async function insertOutcome(client: ForecastDbClient, forecastId: string, ledgerEntry: ForecastLedgerEntry) {
  const payload = buildForecastOutcomePayload(forecastId, ledgerEntry);
  if (!payload) return { status: "skipped" as const, id: null, error: null };

  const { data, error } = await client
    .from("forecast_outcomes")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (isDuplicateError(error)) {
    const existing = await client
      .from("forecast_outcomes")
      .select("id")
      .eq("forecast_id", forecastId)
      .maybeSingle();

    return {
      status: "duplicate" as const,
      id: typeof existing.data?.id === "string" ? existing.data.id : null,
      error: null
    };
  }

  if (error || !data || typeof data.id !== "string") {
    return {
      status: "failed" as const,
      id: null,
      error
    };
  }

  return {
    status: "stored" as const,
    id: data.id,
    error: null
  };
}

async function createDefaultForecastDbClient() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  return createSupabaseServiceClient();
}

export async function persistForecastLedgerResponse(
  response: ForecastLedgerResponse,
  client?: ForecastDbClient | null
): Promise<ForecastLedgerPersistenceResult> {
  const activeClient = client === undefined ? await createDefaultForecastDbClient() : client;

  if (!activeClient) {
    return {
      status: "skipped",
      forecastId: null,
      outcomeId: null,
      reason: "Supabase Service-Client ist nicht konfiguriert. Forecast bleibt nur API-Antwort."
    };
  }

  try {
    const forecast = await insertForecast(activeClient, response);

    if (forecast.status === "failed") {
      logEvent(isSchemaMissingError(forecast.error) ? "warn" : "error", "forecast.ledger_persist_failed", {
        symbol: response.ledgerEntry.symbol,
        code: forecast.error?.code ?? "unknown",
        schemaMissing: isSchemaMissingError(forecast.error)
      });

      return {
        status: "failed",
        forecastId: null,
        outcomeId: null,
        reason: isSchemaMissingError(forecast.error)
          ? "Forecast-Ledger-Tabellen sind noch nicht migriert."
          : "Forecast konnte nicht serverseitig gespeichert werden.",
        errorCode: forecast.error?.code
      };
    }

    if (!forecast.id) {
      return {
        status: "failed",
        forecastId: null,
        outcomeId: null,
        reason: "Forecast wurde nicht gespeichert und konnte keinem vorhandenen Ledger-Eintrag zugeordnet werden."
      };
    }

    const outcome = await insertOutcome(activeClient, forecast.id, response.ledgerEntry);
    if (outcome.status === "failed") {
      logEvent(isSchemaMissingError(outcome.error) ? "warn" : "error", "forecast.outcome_persist_failed", {
        symbol: response.ledgerEntry.symbol,
        code: outcome.error?.code ?? "unknown",
        schemaMissing: isSchemaMissingError(outcome.error)
      });
    }

    return {
      status: forecast.status,
      forecastId: forecast.id,
      outcomeId: outcome.id,
      reason:
        forecast.status === "duplicate"
          ? "Forecast war bereits im Ledger vorhanden; Duplikat wurde nicht neu geschrieben."
          : outcome.status === "failed"
            ? "Forecast wurde gespeichert, Outcome-Platzhalter konnte aber nicht angelegt werden."
            : "Forecast-Ledger wurde serverseitig vorbereitet.",
      errorCode: outcome.error?.code
    };
  } catch (error) {
    logEvent("error", "forecast.ledger_persist_unhandled", {
      symbol: response.ledgerEntry.symbol,
      error
    });

    return {
      status: "failed",
      forecastId: null,
      outcomeId: null,
      reason: "Forecast-Persistenz ist unerwartet fehlgeschlagen."
    };
  }
}
