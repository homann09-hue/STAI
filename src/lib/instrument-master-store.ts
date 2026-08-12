import "server-only";

import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  assessInstrumentIdentity,
  buildCanonicalInstrumentId,
} from "@/lib/instrument-identity";
import type { KnownInstrumentIdentity } from "@/lib/asset-availability";
import type { QuoteStatus } from "@/lib/quote-entitlement";
import type { ProviderInstrumentHit } from "@/lib/providers/instrument-directory-provider";
import type {
  InstrumentResolutionStatus,
  MarketUniverseAssetClass,
} from "@/lib/types";

export {
  assessInstrumentIdentity,
  buildCanonicalInstrumentId,
} from "@/lib/instrument-identity";

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

export function instrumentRecordFromHit(
  hit: ProviderInstrumentHit,
): InstrumentRecord {
  const identity = assessInstrumentIdentity({
    symbol: hit.symbol,
    name: hit.name,
    exchange: hit.exchange,
    currency: hit.currency,
    assetClass: hit.assetClass,
    matchedVia: hit.matchedVia,
  });

  return {
    canonicalId: buildCanonicalInstrumentId({
      assetClass: hit.assetClass,
      exchange: hit.exchange,
      symbol: hit.symbol,
      currency: hit.currency,
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
    resolutionWarnings: identity.resolutionWarnings,
  };
}

/**
 * Persistiert Treffer idempotent. Fehler beim Speichern duerfen die Suche nicht
 * zum Scheitern bringen — die Ergebnisse sind auch ohne Persistenz gueltig.
 */
export async function persistInstrumentHits(
  hits: ProviderInstrumentHit[],
  discoveryQuery: string,
): Promise<PersistResult> {
  if (hits.length === 0) {
    return {
      status: "skipped",
      stored: 0,
      skipped: 0,
      reason: "keine Treffer",
    };
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return {
      status: "skipped",
      stored: 0,
      skipped: hits.length,
      reason: "Supabase Service-Client nicht konfiguriert",
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
      p_resolution_warnings: record.resolutionWarnings,
    });

    if (error) {
      skipped += 1;
      logEvent("warn", "instrument_master.upsert_failed", {
        symbol: record.symbol,
        code: error.code,
        message: error.message,
      });
      continue;
    }

    stored += 1;

    const instrumentId = typeof data === "string" ? data : null;
    if (!instrumentId) continue;

    const { error: identifierError } = await supabase
      .from("instrument_identifiers")
      .upsert(
        [
          {
            instrument_id: instrumentId,
            identifier_type: "ticker",
            value: record.symbol,
            provider: null,
          },
          {
            instrument_id: instrumentId,
            identifier_type: "provider_symbol",
            value: record.symbol,
            provider: record.provider,
          },
          ...(record.exchange && record.exchange !== "unknown"
            ? [
                {
                  instrument_id: instrumentId,
                  identifier_type: "exchange" as const,
                  value: record.exchange,
                  provider: null,
                },
              ]
            : []),
        ],
        {
          onConflict: "instrument_id,identifier_type,value",
          ignoreDuplicates: true,
        },
      );

    if (identifierError) {
      logEvent("warn", "instrument_master.identifier_upsert_failed", {
        symbol: record.symbol,
        code: identifierError.code,
        message: identifierError.message,
      });
    }
  }

  return {
    status: stored > 0 ? "stored" : "failed",
    stored,
    skipped,
  };
}

/**
 * Haelt fest, ob fuer ein Instrument im aktiven Tarif ueberhaupt ein Kurs
 * abrufbar ist.
 *
 * Das ist bewusst ein gemessener Wert und keine Heuristik. Gemessen am
 * 2026-08-07 liefert FMP fuer SPY einen Kurs, fuer QQQ nicht; fuer AAPL ja,
 * fuer BTCS nein. Weder Assetklasse noch Handelsplatz erlauben eine Vorhersage,
 * der Tarif gated offenbar auf Symbolebene. Ein geratener Status waere daher
 * falsche Sicherheit.
 */
export async function recordInstrumentQuoteStatus(
  canonicalId: string,
  status: QuoteStatus,
) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  const { data, error } = await supabase.rpc("record_instrument_quote_status", {
    p_canonical_id: canonicalId,
    p_quote_status: status,
  });

  if (error) {
    logEvent("warn", "instrument_master.quote_status_failed", {
      canonicalId,
      code: error.code,
      message: error.message,
    });
    return false;
  }

  return data === true;
}

/**
 * Setzt den Kursstatus fuer alle Listings eines Symbols.
 *
 * Ueber das Symbol statt ueber die kanonische ID, weil der Aufrufer (Asset-Route)
 * nur das Symbol kennt. Schlaegt still fehl: eine fehlende Statusmessung darf
 * keinen Nutzerrequest beeintraechtigen.
 */
export async function markInstrumentQuoteStatusBySymbol(
  symbol: string,
  status: QuoteStatus,
) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return false;

  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9./:^-]{1,32}$/.test(normalized)) return false;

  const { error } = await supabase
    .from("instruments")
    .update({
      quote_status: status,
      quote_checked_at: new Date().toISOString(),
    })
    .eq("symbol", normalized);

  if (error) {
    logEvent("warn", "instrument_master.quote_status_by_symbol_failed", {
      symbol: normalized,
      code: error.code,
      message: error.message,
    });
    return false;
  }

  return true;
}

/**
 * Sucht die gespeicherte Identität zu einem Symbol.
 *
 * Wird gebraucht, um „Instrument unbekannt" von „Instrument bekannt, aber im
 * Tarif gesperrt" zu unterscheiden. Bei Mehrfachlistings gewinnt das zuletzt
 * bestätigte Listing.
 */
export async function findInstrumentIdentityBySymbol(
  symbol: string,
): Promise<KnownInstrumentIdentity | null> {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return null;

  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9./:^-]{1,32}$/.test(normalized)) return null;

  const { data, error } = await supabase
    .from("instruments")
    .select("symbol,name,asset_class,exchange,currency,provider,quote_status")
    .eq("symbol", normalized)
    .order("confirmation_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logEvent("warn", "instrument_master.identity_lookup_failed", {
        symbol: normalized,
        code: error.code,
        message: error.message,
      });
    }
    return null;
  }

  return {
    symbol: String(data.symbol),
    name: String(data.name),
    assetClass: String(data.asset_class),
    exchange: String(data.exchange),
    currency: String(data.currency),
    provider: String(data.provider),
    quoteStatus: (
      ["unknown", "available", "restricted", "error"] as const
    ).includes(data.quote_status as QuoteStatus)
      ? (data.quote_status as QuoteStatus)
      : "unknown",
  };
}

/**
 * Liest aus dem persistierten Universum. Das ist der erste Suchpfad: bereits
 * entdeckte Instrumente sollen ohne erneuten Provider-Aufruf auffindbar sein.
 */
export async function searchStoredInstruments(
  query: string,
  limit = 20,
  assetClass: MarketUniverseAssetClass | "all" = "all",
) {
  const supabase = createSupabaseServiceClient();
  if (!supabase) return [];

  const normalized = query.trim().slice(0, 64);
  const escaped = normalized
    .replace(/[^\p{L}\p{N} .:/^&+-]/gu, " ")
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized && !escaped) return [];

  const selectColumns =
    "id,canonical_id,symbol,display_symbol,name,asset_class,instrument_type,exchange,exchange_full_name,exchange_code,mic,country,currency,trading_timezone,price_precision,quantity_precision,is_active,is_delisted,provider,identity_confidence,resolution_status,resolution_warnings,last_seen_at,confirmation_count,quote_status,quote_checked_at";
  let directQuery = supabase
    .from("instruments")
    .select(selectColumns)
    .order("confirmation_count", { ascending: false });

  if (assetClass !== "all")
    directQuery = directQuery.eq("asset_class", assetClass);
  if (escaped)
    directQuery = directQuery.or(
      `symbol.ilike.${escaped}%,name.ilike.%${escaped}%`,
    );

  const boundedLimit = Math.min(200, Math.max(1, limit));
  const { data, error } = await directQuery.limit(boundedLimit);

  if (error) {
    logEvent("warn", "instrument_master.search_failed", {
      code: error.code,
      message: error.message,
    });
    return [];
  }

  const byId = new Map((data ?? []).map((row) => [String(row.id), row]));
  let matchedIdentifierRows: Array<Record<string, unknown>> = [];

  if (escaped) {
    const { data: identifierRows, error: identifierError } = await supabase
      .from("instrument_identifiers")
      .select("instrument_id,identifier_type,value,provider")
      .ilike("value", `${escaped}%`)
      .limit(boundedLimit);

    if (identifierError) {
      logEvent("warn", "instrument_master.identifier_search_failed", {
        code: identifierError.code,
        message: identifierError.message,
      });
    } else {
      matchedIdentifierRows = (identifierRows ?? []) as Array<
        Record<string, unknown>
      >;
      const missingIds = [
        ...new Set(
          matchedIdentifierRows
            .map((row) => String(row.instrument_id ?? ""))
            .filter((id) => id && !byId.has(id)),
        ),
      ];

      if (missingIds.length) {
        let identifierInstrumentQuery = supabase
          .from("instruments")
          .select(selectColumns)
          .in("id", missingIds);
        if (assetClass !== "all") {
          identifierInstrumentQuery = identifierInstrumentQuery.eq(
            "asset_class",
            assetClass,
          );
        }
        const {
          data: identifierInstruments,
          error: identifierInstrumentError,
        } = await identifierInstrumentQuery.limit(boundedLimit);

        if (identifierInstrumentError) {
          logEvent(
            "warn",
            "instrument_master.identifier_instrument_lookup_failed",
            {
              code: identifierInstrumentError.code,
              message: identifierInstrumentError.message,
            },
          );
        } else {
          (identifierInstruments ?? []).forEach((row) =>
            byId.set(String(row.id), row),
          );
        }
      }
    }
  }

  const rows = [...byId.values()].slice(0, boundedLimit);
  const ids = rows.map((row) => String(row.id));
  const identifiersByInstrument = new Map<
    string,
    Array<Record<string, unknown>>
  >();

  if (ids.length) {
    const { data: identifiers, error: identifiersError } = await supabase
      .from("instrument_identifiers")
      .select("instrument_id,identifier_type,value,provider")
      .in("instrument_id", ids)
      .limit(Math.min(3200, ids.length * 16));

    if (identifiersError) {
      logEvent("warn", "instrument_master.identifiers_load_failed", {
        code: identifiersError.code,
        message: identifiersError.message,
      });
    } else {
      (identifiers ?? []).forEach((identifier) => {
        const id = String(identifier.instrument_id);
        const current = identifiersByInstrument.get(id) ?? [];
        current.push(identifier as Record<string, unknown>);
        identifiersByInstrument.set(id, current);
      });
    }
  }

  const matchedByInstrument = new Map<string, Array<Record<string, unknown>>>();
  matchedIdentifierRows.forEach((identifier) => {
    const id = String(identifier.instrument_id ?? "");
    const current = matchedByInstrument.get(id) ?? [];
    current.push(identifier);
    matchedByInstrument.set(id, current);
  });

  return rows.map((row) => ({
    ...row,
    identifiers: identifiersByInstrument.get(String(row.id)) ?? [],
    matched_identifiers: matchedByInstrument.get(String(row.id)) ?? [],
  }));
}
