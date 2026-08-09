import { buildAssetProvenancePassport } from "@/lib/asset-provenance";
import { buildForecastPassport, type ForecastPassport } from "@/lib/forecast-passport";
import type { AssetDetail } from "@/lib/types";

export type ForecastPromotionGate = "approved" | "restricted" | "rejected";
export type ForecastOutcomeStatus = "pending" | "matured" | "blocked";

export interface ForecastLedgerEntry {
  id: string;
  symbol: string;
  createdAt: string;
  modelVersion: string;
  dataCutoff: string;
  provider: string;
  quality: ForecastPassport["quality"];
  forecastStatus: ForecastPassport["status"];
  promotionGate: ForecastPromotionGate;
  outcomeStatus: ForecastOutcomeStatus;
  basePrice: number | null;
  horizon: string;
  probabilityUp: number;
  probabilityDown: number;
  probabilitySideways: number;
  confidence: number;
  inputDigest: string;
  sourceCount: number;
  blockers: string[];
  evaluationDueAt: string | null;
  decisionReason: string;
}

export interface ForecastLedgerResponse {
  forecast: ForecastPassport;
  ledgerEntry: ForecastLedgerEntry;
  provenance: ReturnType<typeof buildAssetProvenancePassport>;
  evaluationPlan: {
    baseline: string;
    outcomeMetric: string;
    calibrationBucket: string;
    storageStatus: "in_memory_response" | "database_required";
    note: string;
  };
  disclaimer: string;
}

function stableHash(input: string) {
  let hash = 5381;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeTimestamp(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function addDays(timestamp: string, days: number) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function promotionGate(forecast: ForecastPassport): {
  gate: ForecastPromotionGate;
  outcomeStatus: ForecastOutcomeStatus;
  reason: string;
} {
  if (forecast.status === "blocked") {
    return {
      gate: "rejected",
      outcomeStatus: "blocked",
      reason: "Forecast wurde blockiert, weil Datenbasis, Kursqualität oder Historie nicht ausreichend belastbar sind."
    };
  }

  if (forecast.status === "limited" || forecast.confidence < 55) {
    return {
      gate: "restricted",
      outcomeStatus: "pending",
      reason: "Forecast ist nur eingeschränkt freigegeben. Bandbreiten und Konfidenz müssen sichtbar bleiben."
    };
  }

  return {
    gate: "approved",
    outcomeStatus: "pending",
    reason: "Forecast erfüllt die Mindestanforderungen für eine Research-Schätzung ohne Anlageberatung."
  };
}

function calibrationBucket(forecast: ForecastPassport) {
  if (forecast.status === "blocked") return "blocked";
  if (forecast.confidence >= 75) return "confidence_75_100";
  if (forecast.confidence >= 55) return "confidence_55_74";
  return "confidence_below_55";
}

export function buildForecastLedgerEntry(
  detail: AssetDetail,
  forecast: ForecastPassport,
  now = new Date()
): ForecastLedgerEntry {
  const createdAt = now.toISOString();
  const dataCutoff = safeTimestamp(forecast.dataCutoff, createdAt);
  const gate = promotionGate(forecast);
  const digestInput = JSON.stringify({
    symbol: detail.asset.symbol,
    provider: forecast.provider,
    quality: forecast.quality,
    dataCutoff,
    modelVersion: forecast.modelVersion,
    sources: forecast.sources,
    bands: forecast.bands,
    probabilities: {
      up: forecast.probabilityUp,
      down: forecast.probabilityDown,
      sideways: forecast.probabilitySideways
    }
  });
  const inputDigest = stableHash(digestInput);

  return {
    id: `forecast:${detail.asset.symbol}:${forecast.modelVersion}:${inputDigest}`,
    symbol: detail.asset.symbol,
    createdAt,
    modelVersion: forecast.modelVersion,
    dataCutoff,
    provider: forecast.provider,
    quality: forecast.quality,
    forecastStatus: forecast.status,
    promotionGate: gate.gate,
    outcomeStatus: gate.outcomeStatus,
    basePrice: forecast.basePrice,
    horizon: "1M primary / 1W-12M bands",
    probabilityUp: forecast.probabilityUp,
    probabilityDown: forecast.probabilityDown,
    probabilitySideways: forecast.probabilitySideways,
    confidence: forecast.confidence,
    inputDigest,
    sourceCount: forecast.sources.length,
    blockers: forecast.blockers,
    evaluationDueAt: gate.outcomeStatus === "pending" ? addDays(dataCutoff, 35) : null,
    decisionReason: gate.reason
  };
}

export function buildForecastLedgerResponse(detail: AssetDetail, now = new Date()): ForecastLedgerResponse {
  const forecast = buildForecastPassport(detail, now);
  const ledgerEntry = buildForecastLedgerEntry(detail, forecast, now);
  const provenance = buildAssetProvenancePassport(detail, now);

  return {
    forecast,
    ledgerEntry,
    provenance,
    evaluationPlan: {
      baseline: "naive_last_price_plus_historical_volatility",
      outcomeMetric: "realized_return_inside_forecast_band_after_primary_horizon",
      calibrationBucket: calibrationBucket(forecast),
      storageStatus: "database_required",
      note:
        "Dieser API-Slice erzeugt reproduzierbare Ledger-Metadaten. Persistente Outcome-Auswertung benötigt die Forecast-/Outcome-Tabellen in Supabase."
    },
    disclaimer:
      "Keine Anlageberatung. Forecasts sind probabilistische, modellbasierte Research-Schaetzungen und koennen falsch sein."
  };
}
