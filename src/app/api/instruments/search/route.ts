import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import {
  instrumentDirectoryCapabilityReport,
  searchProviderInstruments
} from "@/lib/providers/instrument-directory-provider";
import {
  buildCanonicalInstrumentId,
  instrumentRecordFromHit,
  persistInstrumentHits,
  searchStoredInstruments
} from "@/lib/instrument-master-store";
import { logEvent } from "@/lib/observability";
import type { InstrumentResolutionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 64;

interface InstrumentSearchResult {
  canonicalId: string;
  symbol: string;
  name: string;
  assetClass: string;
  exchange: string;
  exchangeFullName: string | null;
  currency: string;
  provider: string;
  identityConfidence: number;
  resolutionStatus: InstrumentResolutionStatus;
  resolutionWarnings: string[];
  /** Woher der Treffer stammt. Teil der sichtbaren Provenance. */
  origin: "instrument_master" | "provider_search";
  lastSeenAt: string;
  confirmationCount: number;
}

/**
 * Universelle Instrumentsuche.
 *
 * Zwei Pfade, in dieser Reihenfolge:
 *   1. Persistierter Instrument Master  — bereits entdeckte Instrumente, kein Quota-Verbrauch.
 *   2. Provider-Suche                    — erweitert das Universum und persistiert die Treffer.
 *
 * Die Antwort macht immer sichtbar, woher ein Treffer stammt und dass das
 * Universum wegen der Tarifgrenzen nicht vollstaendig ist. Es werden unter
 * keinen Umstaenden Mock-Instrumente ergaenzt.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") ?? "").trim();

  if (!rawQuery) {
    return jsonError("Suchbegriff fehlt.", 400);
  }

  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return jsonError("Suchbegriff ist zu lang.", 400);
  }

  if (!/^[\p{L}\p{N}\s._:/^&+\-()]{1,64}$/u.test(rawQuery)) {
    return jsonError("Suchbegriff enthält ungültige Zeichen.", 400);
  }

  const capability = instrumentDirectoryCapabilityReport();
  const storedRows = await searchStoredInstruments(rawQuery, 20);

  const storedResults: InstrumentSearchResult[] = storedRows.map((row) => ({
    canonicalId: String(row.canonical_id),
    symbol: String(row.symbol),
    name: String(row.name),
    assetClass: String(row.asset_class),
    exchange: String(row.exchange),
    exchangeFullName: row.exchange_full_name === null ? null : String(row.exchange_full_name),
    currency: String(row.currency),
    provider: String(row.provider),
    identityConfidence: Number(row.identity_confidence ?? 0),
    resolutionStatus: row.resolution_status as InstrumentResolutionStatus,
    resolutionWarnings: Array.isArray(row.resolution_warnings) ? row.resolution_warnings.map(String) : [],
    origin: "instrument_master",
    lastSeenAt: String(row.last_seen_at),
    confirmationCount: Number(row.confirmation_count ?? 0)
  }));

  let providerResults: InstrumentSearchResult[] = [];
  let providerNote = capability.searchAvailable
    ? "Provider-Suche nicht ausgeführt."
    : "Provider-Suche deaktiviert: kein API-Schlüssel konfiguriert.";
  let degraded = false;
  let persistence: Awaited<ReturnType<typeof persistInstrumentHits>> | null = null;

  // Provider nur befragen, wenn der Master zu wenig liefert. Das schont Quota und
  // haelt haeufige Suchen schnell.
  const needsProviderLookup = capability.searchAvailable && storedResults.length < 5;

  if (needsProviderLookup) {
    try {
      const directory = await searchProviderInstruments(rawQuery);
      degraded = directory.degraded;
      providerNote = directory.capabilityNote;

      const knownCanonicalIds = new Set(storedResults.map((item) => item.canonicalId));

      persistence = await persistInstrumentHits(directory.hits, rawQuery);

      providerResults = directory.hits
        .map((hit): InstrumentSearchResult => {
          // Dieselbe Bewertung wie beim Persistieren, damit die Antwort nicht von
          // dem abweicht, was in der Datenbank landet.
          const record = instrumentRecordFromHit(hit);

          return {
            canonicalId: buildCanonicalInstrumentId({
              assetClass: hit.assetClass,
              exchange: hit.exchange,
              symbol: hit.symbol,
              currency: hit.currency
            }),
            symbol: record.symbol,
            name: record.name,
            assetClass: record.assetClass,
            exchange: record.exchange,
            exchangeFullName: record.exchangeFullName,
            currency: record.currency,
            provider: record.provider,
            identityConfidence: record.identityConfidence,
            resolutionStatus: record.resolutionStatus,
            resolutionWarnings: record.resolutionWarnings,
            origin: "provider_search",
            lastSeenAt: hit.fetchedAt,
            confirmationCount: 1
          };
        })
        .filter((item) => !knownCanonicalIds.has(item.canonicalId));
    } catch (error) {
      degraded = true;
      providerNote = "Provider-Suche fehlgeschlagen. Es werden nur bereits bekannte Instrumente angezeigt.";
      logEvent("warn", "instruments.search_provider_failed", {
        message: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  const results = [...storedResults, ...providerResults];

  return jsonOk(
    {
      query: rawQuery,
      results,
      counts: {
        total: results.length,
        fromInstrumentMaster: storedResults.length,
        fromProviderSearch: providerResults.length
      },
      persistence,
      coverage: {
        // Bewusst explizit: die Suche deckt kein vollstaendiges Universum ab.
        complete: false,
        directorySyncAvailable: capability.directorySyncAvailable,
        note: providerNote,
        consequence: capability.consequence,
        verifiedAt: capability.verifiedAt
      },
      degraded
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-StockPilot-Universe-Complete": "false"
      }
    }
  );
}
