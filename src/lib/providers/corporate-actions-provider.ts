import "server-only";

import {
  mergeCorporateActions,
  normalizeFmpDividends,
  normalizeFmpSplits,
  supportsCorporateActionsAssetType,
  type CorporateActionsResult
} from "@/lib/corporate-actions";
import { logEvent } from "@/lib/observability";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";

type EndpointResult = { ok: true; data: unknown } | { ok: false; reason: string };
type CacheEntry = { result: CorporateActionsResult; storedAtMs: number };

const PROVIDER = "Financial Modeling Prep";
const AVAILABLE_TTL_MS = 6 * 60 * 60 * 1_000;
const UNAVAILABLE_TTL_MS = 60 * 1_000;
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CorporateActionsResult>>();

function safeFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : "unbekannter Providerfehler";
  if (message.includes("402") || message.includes("403")) return "im aktiven Providertarif nicht freigeschaltet";
  if (message.includes("429")) return "Provider-Rate-Limit erreicht";
  if (/timeout|Zeitüberschreitung/i.test(message)) return "Provider-Zeitüberschreitung";
  return "Provider derzeit nicht erreichbar";
}

async function fetchEndpoint(base: string, path: string, symbol: string, token: string): Promise<EndpointResult> {
  const url = new URL(`${base}/${path}`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", token);

  try {
    const { data } = await fetchBoundedProviderJson<unknown>(url, `${PROVIDER} Corporate Actions`, {
      timeoutMs: 8_000,
      maxBytes: 1_500_000
    });
    return { ok: true, data };
  } catch (error) {
    const reason = safeFailureReason(error);
    logEvent("warn", "corporate_actions.provider_failed", { symbol, path, reason });
    return { ok: false, reason };
  }
}

function unavailable(symbol: string, retrievedAt: string, note: string): CorporateActionsResult {
  return {
    symbol,
    actions: [],
    available: false,
    partial: false,
    provider: null,
    quality: "unavailable",
    retrievedAt,
    coverage: { dividends: "unavailable", splits: "unavailable" },
    note
  };
}

export function clearCorporateActionsCache() {
  cache.clear();
  inFlight.clear();
}

export async function fetchCorporateActions(
  symbol: string,
  now = new Date(),
  assetType?: string
): Promise<CorporateActionsResult> {
  const normalized = symbol.trim().toUpperCase();
  const retrievedAt = now.toISOString();
  if (!/^[A-Z0-9./:-]{1,32}$/.test(normalized)) {
    return unavailable(normalized, retrievedAt, "Ungültiges Symbol; es wurde kein Anbieter abgefragt.");
  }
  if (assetType !== undefined && !supportsCorporateActionsAssetType(assetType)) {
    return unavailable(
      normalized,
      retrievedAt,
      "Dividenden- und Splitdaten dieses Providers gelten nur für Aktien und ETFs; es wurde kein Anbieter abgefragt."
    );
  }

  const cached = cache.get(normalized);
  if (cached) {
    const ttl = cached.result.available ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS;
    if (now.getTime() - cached.storedAtMs < ttl) return cached.result;
  }

  const pending = inFlight.get(normalized);
  if (pending) return pending;

  const request = (async (): Promise<CorporateActionsResult> => {

  const token = process.env.FMP_API_KEY;
  if (!token) {
    const result = unavailable(
      normalized,
      retrievedAt,
      "Corporate Actions nicht verfügbar: FMP_API_KEY ist serverseitig nicht gesetzt."
    );
    cache.set(normalized, { result, storedAtMs: now.getTime() });
    return result;
  }

  const base = (process.env.FMP_API_BASE_URL ?? "https://financialmodelingprep.com/stable").replace(/\/$/, "");
  const [dividends, splits] = await Promise.all([
    fetchEndpoint(base, "dividends", normalized, token),
    fetchEndpoint(base, "splits", normalized, token)
  ]);

  const actions = mergeCorporateActions(
    dividends.ok ? normalizeFmpDividends(dividends.data, normalized, retrievedAt, now) : [],
    splits.ok ? normalizeFmpSplits(splits.data, normalized, retrievedAt, now) : []
  );
  const successfulEndpoints = Number(dividends.ok) + Number(splits.ok);
  const available = successfulEndpoints > 0;
  const partial = successfulEndpoints === 1;
  const failures = [
    dividends.ok ? null : `Dividenden: ${dividends.reason}`,
    splits.ok ? null : `Splits: ${splits.reason}`
  ].filter((entry): entry is string => entry !== null);

  const result: CorporateActionsResult = available
    ? {
        symbol: normalized,
        actions,
        available: true,
        partial,
        provider: PROVIDER,
        quality: "provider_reported",
        retrievedAt,
        coverage: {
          dividends: dividends.ok ? "available" : "unavailable",
          splits: splits.ok ? "available" : "unavailable"
        },
        note: partial
          ? `Teilweise verfügbar. ${failures.join(" ")}`
          : actions.length
            ? `${actions.length} provider-gemeldete Ereignisse geladen.`
            : "Der Anbieter antwortete erfolgreich, meldete für dieses Symbol aber keine Dividenden oder Splits."
      }
    : unavailable(normalized, retrievedAt, failures.join(" ") || "Corporate Actions nicht verfügbar.");

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(normalized, { result, storedAtMs: now.getTime() });
  return result;
  })();

  inFlight.set(normalized, request);
  try {
    return await request;
  } finally {
    if (inFlight.get(normalized) === request) inFlight.delete(normalized);
  }
}
