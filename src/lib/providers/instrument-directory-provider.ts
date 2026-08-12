import "server-only";

import { z } from "zod";
import { FmpClient, getFmpClient } from "@/lib/providers/fmp-client";
import { resolveProviderRoute } from "@/lib/providers/provider-registry";
import { logEvent } from "@/lib/observability";
import {
  inferAssetClass,
  instrumentDirectoryCapabilityReport as buildCapabilityReport
} from "@/lib/providers/instrument-directory-provider.pure";
import type { MarketUniverseAssetClass } from "@/lib/types";

export { inferAssetClass } from "@/lib/providers/instrument-directory-provider.pure";

/**
 * Instrument-Discovery ueber die FMP Stable API.
 *
 * Tarifrealitaet, gemessen am 2026-08-07 gegen die Live-API:
 *   v3/stock/list, v3/etf/list, v3/available-traded/list  -> 403 (Legacy, abgeschaltet)
 *   v3/symbol/available-*                                  -> 403 (Legacy, abgeschaltet)
 *   stable/company-screener                                -> 402 (nicht im Tarif)
 *   stable/available-exchanges                             -> 402 (nicht im Tarif)
 *   stable/search-isin                                     -> 402 (nicht im Tarif)
 *   stable/search-symbol                                   -> 200
 *   stable/search-name                                     -> 200
 *
 * Ein Vollabzug des Instrumentuniversums ist damit nicht moeglich. Dieses Modul
 * implementiert deshalb bewusst nur Discovery per Suche und meldet den fehlenden
 * Verzeichnisabruf als sichtbaren Capability-Status, statt Vollstaendigkeit zu
 * behaupten. Siehe docs/BLOCKERS.md.
 */

const PROVIDER_NAME = "FMP";
const MAX_QUERY_LENGTH = 64;
const MAX_RESULTS_PER_ENDPOINT = 25;
const MAX_MERGED_RESULTS = 40;

export type InstrumentDirectoryCapability =
  | "search_only"
  | "directory_unavailable"
  | "provider_unconfigured";

export interface ProviderInstrumentHit {
  symbol: string;
  name: string;
  exchange: string;
  exchangeFullName: string | null;
  currency: string;
  assetClass: MarketUniverseAssetClass;
  provider: string;
  /** Welcher Endpunkt den Treffer geliefert hat. Teil der Provenance. */
  matchedVia: "symbol" | "name";
  fetchedAt: string;
}

export interface InstrumentDirectoryResult {
  hits: ProviderInstrumentHit[];
  capability: InstrumentDirectoryCapability;
  /** Menschenlesbare Begruendung, direkt in der UI anzeigbar. */
  capabilityNote: string;
  latencyMs: number;
  degraded: boolean;
}

interface FmpSearchRow {
  symbol?: unknown;
  name?: unknown;
  currency?: unknown;
  exchange?: unknown;
  exchangeFullName?: unknown;
}

const fmpSearchRowsSchema = z.array(
  z.object({
    symbol: z.unknown().optional(),
    name: z.unknown().optional(),
    currency: z.unknown().optional(),
    exchange: z.unknown().optional(),
    exchangeFullName: z.unknown().optional(),
  }).passthrough(),
);

function providerApiKey() {
  const route = resolveProviderRoute({
    capability: "instrument_search",
    preferredProvider: "fmp",
  });
  if (!route.providers.includes("fmp")) return null;
  return process.env.FMP_API_KEY?.trim() || null;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9./:^-]/g, "").slice(0, 32);
}

function normalizeCurrency(value: unknown) {
  const cleaned = cleanText(value, 12).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{2,12}$/.test(cleaned) ? cleaned : "XXX";
}

function normalizeRow(
  row: FmpSearchRow,
  matchedVia: ProviderInstrumentHit["matchedVia"],
  fetchedAt: string
): ProviderInstrumentHit | null {
  const symbol = normalizeSymbol(row.symbol);
  const name = cleanText(row.name, 240);

  // Ohne Symbol und Namen ist der Treffer nicht identifizierbar und wird
  // verworfen, statt mit Platzhaltern aufgefuellt zu werden.
  if (!symbol || !name) return null;

  const exchange = cleanText(row.exchange, 120) || "unknown";
  const { assetClass } = inferAssetClass({ symbol, name, exchange });

  return {
    symbol,
    name,
    exchange,
    exchangeFullName: cleanText(row.exchangeFullName, 240) || null,
    currency: normalizeCurrency(row.currency),
    assetClass,
    provider: PROVIDER_NAME,
    matchedVia,
    fetchedAt
  };
}

async function fetchSearchEndpoint(
  endpoint: "search-symbol" | "search-name",
  query: string,
  client: FmpClient,
  timeoutMs: number
) {
  const { data, latencyMs } = await client.request(
    endpoint,
    { query, limit: String(MAX_RESULTS_PER_ENDPOINT) },
    fmpSearchRowsSchema,
    { timeoutMs },
  );

  return { rows: Array.isArray(data) ? data : [], latencyMs };
}

/**
 * Sucht Instrumente ueber beide nutzbaren Endpunkte und dedupliziert.
 *
 * Ein Fehlschlag eines Endpunkts macht das Ergebnis `degraded`, verwirft aber
 * nicht die Treffer des anderen. Ein vollstaendiger Fehlschlag liefert ein
 * leeres Ergebnis mit Begruendung — niemals stillschweigend Mock-Daten.
 */
export async function searchProviderInstruments(
  rawQuery: string,
  options: { timeoutMs?: number } = {}
): Promise<InstrumentDirectoryResult> {
  const query = cleanText(rawQuery, MAX_QUERY_LENGTH);
  const fetchedAt = new Date().toISOString();
  const apiKey = providerApiKey();

  if (!apiKey) {
    return {
      hits: [],
      capability: "provider_unconfigured",
      capabilityNote:
        "Kein FMP_API_KEY konfiguriert. Instrument-Discovery ist deaktiviert; es werden keine Ersatzdaten angezeigt.",
      latencyMs: 0,
      degraded: true
    };
  }

  if (query.length < 1) {
    return {
      hits: [],
      capability: "search_only",
      capabilityNote: "Suchbegriff fehlt.",
      latencyMs: 0,
      degraded: false
    };
  }

  const timeoutMs = options.timeoutMs ?? 6500;
  const client = getFmpClient({ apiKey });

  const [bySymbol, byName] = await Promise.allSettled([
    fetchSearchEndpoint("search-symbol", query, client, timeoutMs),
    fetchSearchEndpoint("search-name", query, client, timeoutMs)
  ]);

  const merged = new Map<string, ProviderInstrumentHit>();
  let latencyMs = 0;
  let failures = 0;

  const collect = (
    settled: PromiseSettledResult<{ rows: FmpSearchRow[]; latencyMs: number }>,
    matchedVia: ProviderInstrumentHit["matchedVia"]
  ) => {
    if (settled.status !== "fulfilled") {
      failures += 1;
      logEvent("warn", "instrument_directory.endpoint_failed", {
        endpoint: matchedVia,
        message: settled.reason instanceof Error ? settled.reason.message : "unknown"
      });
      return;
    }

    latencyMs = Math.max(latencyMs, settled.value.latencyMs);

    for (const row of settled.value.rows) {
      const hit = normalizeRow(row, matchedVia, fetchedAt);
      if (!hit) continue;

      // Dedupe ueber Symbol + Boerse: dasselbe Unternehmen an mehreren
      // Handelsplaetzen bleibt bewusst als separates Listing erhalten.
      const key = `${hit.symbol}@${hit.exchange.toUpperCase()}`;
      const existing = merged.get(key);

      // Ein Symboltreffer ist staerkere Evidenz als ein Namenstreffer.
      if (!existing || (existing.matchedVia === "name" && hit.matchedVia === "symbol")) {
        merged.set(key, hit);
      }
    }
  };

  collect(bySymbol, "symbol");
  collect(byName, "name");

  return {
    hits: [...merged.values()].slice(0, MAX_MERGED_RESULTS),
    capability: "search_only",
    capabilityNote:
      "Der aktive FMP-Tarif erlaubt Instrumentsuche, aber keinen Verzeichnisabruf. Das Universum wächst suchgetrieben und ist nicht vollständig.",
    latencyMs,
    degraded: failures > 0
  };
}

/**
 * Statischer Capability-Report fuer Admin- und Coverage-Ansichten. Bewusst ohne
 * Netzwerkaufruf, damit er in jeder Ansicht ohne Quota-Verbrauch nutzbar ist.
 */
export function instrumentDirectoryCapabilityReport() {
  return buildCapabilityReport(Boolean(providerApiKey()));
}
