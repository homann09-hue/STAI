import "server-only";

import {
  evaluateExchangeSession,
  normalizeFmpExchangeHolidays,
  normalizeFmpExchangeHours,
  type ExchangeCalendarResult
} from "@/lib/exchange-calendar";
import { logEvent } from "@/lib/observability";
import { resolveProviderRoute } from "@/lib/providers/provider-registry";
import {
  FmpClient,
  fmpFailureReason,
  fmpRowsOrRecordSchema,
  getFmpClient,
} from "@/lib/providers/fmp-client";

type EndpointResult = { ok: true; data: unknown; latencyMs: number } | { ok: false; reason: string };
type CacheEntry = { result: ExchangeCalendarResult; storedAtMs: number };

const PROVIDER = "Financial Modeling Prep";
const AVAILABLE_TTL_MS = 6 * 60 * 60 * 1_000;
const UNAVAILABLE_TTL_MS = 60 * 1_000;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<ExchangeCalendarResult>>();

async function fetchEndpoint(
  client: FmpClient,
  path: "exchange-market-hours" | "holidays-by-exchange",
  exchange: string,
): Promise<EndpointResult> {
  try {
    const result = await client.request(path, { exchange }, fmpRowsOrRecordSchema, {
      timeoutMs: 8_000,
      maxBytes: 750_000
    });
    return { ok: true, data: result.data, latencyMs: result.latencyMs };
  } catch (error) {
    const reason = fmpFailureReason(error);
    logEvent("warn", "exchange_calendar.provider_failed", { exchange, path, reason });
    return { ok: false, reason };
  }
}

function unavailable(exchange: string, retrievedAt: string, note: string): ExchangeCalendarResult {
  return {
    exchange,
    name: null,
    timezone: null,
    regularSchedule: [],
    holidays: [],
    session: {
      status: "unknown",
      reason: "Kein belastbarer Börsenkalender verfügbar.",
      localTime: null,
      evaluatedAt: retrievedAt
    },
    available: false,
    partial: false,
    provider: null,
    quality: "unavailable",
    retrievedAt,
    latencyMs: null,
    coverage: { hours: "unavailable", holidays: "unavailable" },
    note
  };
}

export function clearExchangeCalendarCache() {
  cache.clear();
  inFlight.clear();
}

export async function fetchExchangeCalendar(exchange: string, now = new Date()): Promise<ExchangeCalendarResult> {
  const normalized = exchange.trim().toUpperCase();
  const retrievedAt = now.toISOString();
  if (!/^[A-Z0-9._:-]{1,24}$/.test(normalized)) {
    return unavailable(normalized, retrievedAt, "Ungültiger Börsencode; es wurde kein Anbieter abgefragt.");
  }

  const route = resolveProviderRoute({
    capability: "market_calendar",
    preferredProvider: "fmp",
  });
  if (!route.providers.includes("fmp")) {
    const reason = route.rejected.find((entry) => entry.providerId === "fmp")?.detail;
    return unavailable(
      normalized,
      retrievedAt,
      `Börsenkalender nicht verfügbar: ${reason ?? "kein freigegebener Provider"}.`,
    );
  }

  const cached = cache.get(normalized);
  if (cached) {
    const ttl = cached.result.available ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS;
    if (now.getTime() - cached.storedAtMs < ttl) {
      return {
        ...cached.result,
        session: evaluateExchangeSession(cached.result, now)
      };
    }
  }
  const pending = inFlight.get(normalized);
  if (pending) return pending;

  const request = (async () => {
    const token = process.env.FMP_API_KEY;
    if (!token) return unavailable(normalized, retrievedAt, "Börsenkalender nicht verfügbar: FMP_API_KEY ist serverseitig nicht gesetzt.");

    const client = getFmpClient({ apiKey: token });
    const [hoursResponse, holidaysResponse] = await Promise.all([
      fetchEndpoint(client, "exchange-market-hours", normalized),
      fetchEndpoint(client, "holidays-by-exchange", normalized)
    ]);
    const hours = hoursResponse.ok ? normalizeFmpExchangeHours(hoursResponse.data, normalized) : null;
    const holidayResult = holidaysResponse.ok
      ? normalizeFmpExchangeHolidays(holidaysResponse.data)
      : { validResponse: false, holidays: [] };
    const coverage = {
      hours: hours ? "available" as const : "unavailable" as const,
      holidays: holidayResult.validResponse ? "available" as const : "unavailable" as const
    };
    const availableCount = Number(coverage.hours === "available") + Number(coverage.holidays === "available");
    if (availableCount === 0) {
      const reasons = [
        hoursResponse.ok ? "Handelszeiten: Antwortschema nicht auswertbar" : `Handelszeiten: ${hoursResponse.reason}`,
        holidaysResponse.ok ? "Feiertage: Antwortschema nicht auswertbar" : `Feiertage: ${holidaysResponse.reason}`
      ];
      return unavailable(normalized, retrievedAt, reasons.join(". "));
    }

    const baseResult: ExchangeCalendarResult = {
      exchange: normalized,
      name: hours?.name ?? null,
      timezone: hours?.timezone ?? null,
      regularSchedule: hours?.regularSchedule ?? [],
      holidays: holidayResult.holidays,
      session: {
        status: "unknown",
        reason: "Sitzungsstatus wird ausgewertet.",
        localTime: null,
        evaluatedAt: retrievedAt
      },
      available: true,
      partial: availableCount === 1,
      provider: PROVIDER,
      quality: "provider_reported",
      retrievedAt,
      latencyMs: Math.max(
        hoursResponse.ok ? hoursResponse.latencyMs : 0,
        holidaysResponse.ok ? holidaysResponse.latencyMs : 0
      ),
      coverage,
      note: availableCount === 2
        ? "Provider-Handelszeiten und Feiertage geladen."
        : "Teilabdeckung: Ein belastbarer aktueller Sitzungsstatus ist nicht möglich."
    };
    return { ...baseResult, session: evaluateExchangeSession(baseResult, now) };
  })();

  inFlight.set(normalized, request);
  try {
    const result = await request;
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(normalized, { result, storedAtMs: now.getTime() });
    return result;
  } finally {
    if (inFlight.get(normalized) === request) inFlight.delete(normalized);
  }
}
