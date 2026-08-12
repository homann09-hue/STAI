import "server-only";

import { z } from "zod";

import { logEvent } from "@/lib/observability";
import {
  getFmpClient,
  type FmpClient,
} from "@/lib/providers/fmp-client";
import { resolveProviderRoute } from "@/lib/providers/provider-registry";
import {
  getTwelveDataApiKey,
  getTwelveDataClient,
} from "@/lib/providers/twelve-data-client";
import type { MarketUniverseAssetClass } from "@/lib/types";
import {
  inferAssetClass,
  instrumentDirectoryCapabilityReport as buildFmpCapabilityReport,
} from "./instrument-directory-provider.pure";

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
  matchedVia: "symbol" | "name";
  fetchedAt: string;
  mic?: string | null;
  country?: string | null;
  tradingTimezone?: string | null;
  instrumentType?: string | null;
  assetClassEvidence?: "provider" | "heuristic";
}

export interface InstrumentDirectoryResult {
  hits: ProviderInstrumentHit[];
  capability: InstrumentDirectoryCapability;
  capabilityNote: string;
  latencyMs: number;
  degraded: boolean;
  providers: string[];
}

interface FmpSearchRow {
  symbol?: unknown;
  name?: unknown;
  currency?: unknown;
  exchange?: unknown;
  exchangeFullName?: unknown;
}

const fmpSearchRowsSchema = z.array(
  z
    .object({
      symbol: z.unknown().optional(),
      name: z.unknown().optional(),
      currency: z.unknown().optional(),
      exchange: z.unknown().optional(),
      exchangeFullName: z.unknown().optional(),
    })
    .passthrough(),
);

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9./:^-]/g, "")
    .slice(0, 32);
}

function normalizeCurrency(value: unknown) {
  const cleaned = cleanText(value, 12)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{2,12}$/.test(cleaned) ? cleaned : "XXX";
}

function enabledSearchProviders() {
  const route = resolveProviderRoute({ capability: "instrument_search" });
  return {
    route,
    fmp:
      route.providers.includes("fmp") &&
      Boolean(process.env.FMP_API_KEY?.trim()),
    twelve:
      route.providers.includes("twelve_data") &&
      Boolean(getTwelveDataApiKey()),
  };
}

function normalizeFmpRow(
  row: FmpSearchRow,
  matchedVia: ProviderInstrumentHit["matchedVia"],
  fetchedAt: string,
): ProviderInstrumentHit | null {
  const symbol = normalizeSymbol(row.symbol);
  const name = cleanText(row.name, 240);
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
    provider: "FMP",
    matchedVia,
    fetchedAt,
    assetClassEvidence: "heuristic",
  };
}

async function fetchFmpSearchEndpoint(
  endpoint: "search-symbol" | "search-name",
  query: string,
  client: FmpClient,
  timeoutMs: number,
) {
  const { data, latencyMs } = await client.request(
    endpoint,
    { query, limit: String(MAX_RESULTS_PER_ENDPOINT) },
    fmpSearchRowsSchema,
    { timeoutMs },
  );
  return { rows: Array.isArray(data) ? data : [], latencyMs };
}

async function searchFmp(query: string, fetchedAt: string, timeoutMs: number) {
  const client = getFmpClient({ apiKey: process.env.FMP_API_KEY?.trim() });
  const [bySymbol, byName] = await Promise.allSettled([
    fetchFmpSearchEndpoint("search-symbol", query, client, timeoutMs),
    fetchFmpSearchEndpoint("search-name", query, client, timeoutMs),
  ]);
  const hits: ProviderInstrumentHit[] = [];
  let latencyMs = 0;
  let failures = 0;
  const collect = (
    settled: PromiseSettledResult<{ rows: FmpSearchRow[]; latencyMs: number }>,
    matchedVia: ProviderInstrumentHit["matchedVia"],
  ) => {
    if (settled.status !== "fulfilled") {
      failures += 1;
      return;
    }
    latencyMs = Math.max(latencyMs, settled.value.latencyMs);
    for (const row of settled.value.rows) {
      const hit = normalizeFmpRow(row, matchedVia, fetchedAt);
      if (hit) hits.push(hit);
    }
  };
  collect(bySymbol, "symbol");
  collect(byName, "name");
  if (failures === 2) {
    throw new Error("Beide FMP-Suchendpunkte sind fehlgeschlagen.");
  }
  return { hits, latencyMs, degraded: failures > 0, provider: "FMP" };
}

async function searchTwelveData(
  query: string,
  fetchedAt: string,
  timeoutMs: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let result: Awaited<
    ReturnType<ReturnType<typeof getTwelveDataClient>["searchInstruments"]>
  >;
  try {
    result = await Promise.race([
      getTwelveDataClient().searchInstruments(query, MAX_MERGED_RESULTS),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Twelve Data Instrumentsuche Timeout.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  const normalizedQuery = query.toUpperCase();
  return {
    hits: result.data.map(
      (row): ProviderInstrumentHit => ({
        symbol: row.symbol,
        name: row.name,
        exchange: row.exchange ?? row.mic ?? "unknown",
        exchangeFullName: row.exchange,
        currency: row.currency,
        assetClass: row.assetClass,
        provider: "Twelve Data",
        matchedVia:
          row.symbol === normalizedQuery ||
          row.symbol.startsWith(normalizedQuery)
            ? "symbol"
            : "name",
        fetchedAt,
        mic: row.mic,
        country: row.country,
        tradingTimezone: row.tradingTimezone,
        instrumentType: row.instrumentType,
        assetClassEvidence: "provider",
      }),
    ),
    latencyMs: result.latencyMs,
    degraded: false,
    provider: "Twelve Data",
  };
}

/**
 * Suchgetriebene Discovery ueber alle aktivierten, lizenzierten Adapter.
 * Mehrfachlistings bleiben durch Symbol + MIC/Boerse getrennt.
 */
export async function searchProviderInstruments(
  rawQuery: string,
  options: { timeoutMs?: number } = {},
): Promise<InstrumentDirectoryResult> {
  const query = cleanText(rawQuery, MAX_QUERY_LENGTH);
  const fetchedAt = new Date().toISOString();
  const configured = enabledSearchProviders();
  const providers = [
    ...(configured.twelve ? ["Twelve Data"] : []),
    ...(configured.fmp ? ["FMP"] : []),
  ];

  if (!providers.length) {
    return {
      hits: [],
      capability: "provider_unconfigured",
      capabilityNote:
        "Keine lizenzierte Instrumentsuche konfiguriert. Es werden keine Ersatzdaten angezeigt.",
      latencyMs: 0,
      degraded: true,
      providers: [],
    };
  }
  if (!query) {
    return {
      hits: [],
      capability: "search_only",
      capabilityNote: "Suchbegriff fehlt.",
      latencyMs: 0,
      degraded: false,
      providers,
    };
  }

  const timeoutMs = options.timeoutMs ?? 6_500;
  const attempts: Array<Promise<{
    hits: ProviderInstrumentHit[];
    latencyMs: number;
    degraded: boolean;
    provider: string;
  }>> = [];
  if (configured.twelve) {
    attempts.push(searchTwelveData(query, fetchedAt, timeoutMs));
  }
  if (configured.fmp) attempts.push(searchFmp(query, fetchedAt, timeoutMs));
  const settled = await Promise.allSettled(attempts);
  const merged = new Map<string, ProviderInstrumentHit>();
  let latencyMs = 0;
  let failures = 0;
  let degraded = false;

  for (const outcome of settled) {
    if (outcome.status !== "fulfilled") {
      failures += 1;
      logEvent("warn", "instrument_directory.provider_failed", {
        message:
          outcome.reason instanceof Error ? outcome.reason.message : "unknown",
      });
      continue;
    }
    latencyMs = Math.max(latencyMs, outcome.value.latencyMs);
    degraded ||= outcome.value.degraded;
    for (const hit of outcome.value.hits) {
      const listing = hit.mic ?? hit.exchange.toUpperCase();
      const key = `${hit.symbol}@${listing}`;
      const existing = merged.get(key);
      // Twelve liefert MIC, Land und Zeitzone. Diese Evidenz ist bei gleichem
      // Listing staerker als ein FMP-Treffer ohne diese Felder.
      if (
        !existing ||
        (existing.provider === "FMP" && hit.provider === "Twelve Data") ||
        (existing.matchedVia === "name" && hit.matchedVia === "symbol")
      ) {
        merged.set(key, hit);
      }
    }
  }

  return {
    hits: [...merged.values()].slice(0, MAX_MERGED_RESULTS),
    capability: "search_only",
    capabilityNote:
      "Die aktive Provider-Suche ist suchgetrieben und nicht vollstaendig. Sie ist kein Beleg fuer ein vollstaendiges Instrumentuniversum.",
    latencyMs,
    degraded: degraded || failures > 0,
    providers: settled.flatMap((outcome) =>
      outcome.status === "fulfilled" ? [outcome.value.provider] : [],
    ),
  };
}

export function instrumentDirectoryCapabilityReport() {
  const configured = enabledSearchProviders();
  const providers = [
    ...(configured.twelve ? ["Twelve Data"] : []),
    ...(configured.fmp ? ["FMP"] : []),
  ];
  const fmpReport = buildFmpCapabilityReport(providers.length > 0);
  return {
    ...fmpReport,
    provider: providers.join(" / ") || "Kein Provider",
    searchProviders: providers,
    searchAvailable: providers.length > 0,
    verifiedAt: "2026-08-12",
    consequence:
      "Das Universum waechst suchgetrieben. Vollstaendigkeit wird erst nach einem nachweisbaren, lizenzierten Verzeichnissync behauptet.",
  } as const;
}
