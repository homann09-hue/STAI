import "server-only";

import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { assessInstrumentIdentity, buildCanonicalInstrumentId } from "@/lib/instrument-identity";
import type { ProviderInstrumentHit } from "@/lib/providers/instrument-directory-provider";
import type { InstrumentResolutionStatus, MarketUniverseAssetClass } from "@/lib/types";

export { assessInstrumentIdentity, buildCanonicalInstrumentId } from "@/lib/instrument-identity";

/**
 * Persistenz des Instrument Masters.
 *
 * Alle Schreibpfade laufen bewusst ueber den Service-Role-Client: `instruments`
 * ist Referenzdatenbestand, kein Nutzerbesitz. `authenticated` hat ausschliesslich
 * Leserecht (siehe Migration 20260807190000).
 */

export type PersistStatus = "stored" | "skipped" | "failed";

export interface InstrumentRecord {
  canonicalId: string;
  symbol: string;
  name: string;
  assetClass: MarketUniverseAssetClass;
  exchange: string;
  exchangeFullName: string | null;
  currency: string;
  provider: string;
  identityConfidence: number;
  resolutionStatus: InstrumentResolutionStatus;
  resolutionWarnings: string[];
}

export interface PersistResult {
  status: PersistStatus;
  stored: number;
  skipped: number;
  reason?: string;
}

export function instrumentRecordFromHit(hit: ProviderInstrumentHit): InstrumentRecord {
  const identity = assessInstrumentIdentity({
    symbol: hit.symbol,
    name: hit.name,
    exchange: hit.exchange,
    currency: hit.currency,
    assetClass: hit.assetClass,
    matchedVia: hit.matchedVia
  });

  return {
    canonicalId: buildCanonicalInstrumentId({
      assetClass: hit.assetClass,
      exchange: hit.exchange,
      symbol: hit.symbol,
      currency: hit.currency
    }),
    symbol: hit.symbol,
    name: hit.name,
    assetClass: hit.assetClass,
    exchange: hit.exchange,
    exchangeFullName: hit.exchangeFullName,
    currency: hit.currency,
    provider: hit.provider,
    identityConfidence: identity.identityConfidence,
    resolutionStatus: identity.resolutionStatus,
    resolutionWarnings: identity.resolutionWarnings
  };
}

/**
 * Persistiert Treffer idempotent. Fehler beim Speichern duerfen die Suche nicht
 * zum Scheitern bringen — die Ergebnisse sind auch ohne Persistenz gueltig.
 */
export async function persistInstrumentHits(
  hits: ProviderInstrumentHit[],
  discoveryQuery: string
): Promise<PersistResult> {
  if (hits.length === 0) {
    return { status: "skipped", stored: 0, skipped: 0, reason: "keine Treffer" };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return {
      status: "skipped",
      stored: 0,
      skipped: hits.length,
      reason: "Supabase Service-Client nicht konfiguriert"
    };
  }

  let stored = 0;
  let skipped = 0;

  for (const hit of hits) {
    const record = instrumentRecordFromHit(hit);

    const { data, error } = await supabase.rpc("upsert_instrument", {
      p_canonical_id: record.canonicalId,
      p_symbol: record.symbol,
      p_name: record.name,
      p_asset_class: record.assetClass,
      p_exchange: record.exchange,
      p_exchange_full_name: record.exchangeFullName,
      p_currency: record.currency,
      p_country: null,
      p_provider: record.provider,
      p_discovery_source: "provider_search",
      p_discovery_query: discoveryQuery.slice(0, 120),
      p_identity_confidence: record.identityConfidence,
      p_resolution_status: record.resolutionStatus,
      p_resolution_warnings: record.resolutionWarnings
    });

    if (error) {
      skipped += 1;
      logEvent("warn", "instrument_master.upsert_failed", {
        symbol: record.symbol,
        code: error.code,
        message: error.message
      });
      continue;
    }

    stored += 1;

    const instrumentId = typeof data === "string" ? data : null;
    if (!instrumentId) continue;

    const { error: identifierError } = await supabase.from("instrument_identifiers").upsert(
      [
        { instrument_id: instrumentId, identifier_type: "ticker", value: record.symbol, provider: null },
        {
          instrument_id: instrumentId,
          identifier_type: "provider_symbol",
          value: record.symbol,
          provider: record.provider
        },
        ...(record.exchange && record.exchange !== "unknown"
          ? [
              {
                instrument_id: instrumentId,
                identifier_type: "exchange" as const,
                value: record.exchange,
                provider: null
              }
            ]
          : [])
      ],
      { onConflict: "instrument_id,identifier_type,value", ignoreDuplicates: true }
    );

    if (identifierError) {
      logEvent("warn", "instrument_master.identifier_upsert_failed", {
        symbol: record.symbol,
        code: identifierError.code,
        message: identifierError.message
      });
    }
  }

  return {
    status: stored > 0 ? "stored" : "failed",
    stored,
    skipped
  };
}

/**
 * Liest aus dem persistierten Universum. Das ist der erste Suchpfad: bereits
 * entdeckte Instrumente sollen ohne erneuten Provider-Aufruf auffindbar sein.
 */
export async function searchStoredInstruments(query: string, limit = 20) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const normalized = query.trim().slice(0, 64);
  if (!normalized) return [];

  const escaped = normalized.replace(/[%_,]/g, " ").trim();
  if (!escaped) return [];

  const { data, error } = await supabase
    .from("instruments")
    .select(
      "canonical_id,symbol,name,asset_class,exchange,exchange_full_name,currency,provider,identity_confidence,resolution_status,resolution_warnings,last_seen_at,confirmation_count"
    )
    .or(`symbol.ilike.${escaped}%,name.ilike.%${escaped}%`)
    .order("confirmation_count", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));

  if (error) {
    logEvent("warn", "instrument_master.search_failed", { code: error.code, message: error.message });
    return [];
  }

  return data ?? [];
}
