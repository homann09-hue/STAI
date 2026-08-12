import "server-only";

import { z } from "zod";
import {
  fetchBoundedProviderJson,
  ProviderHttpResponseError,
} from "@/lib/providers/http-json";

export const FMP_PROVIDER_ID = "fmp" as const;
export const FMP_PROVIDER_NAME = "Financial Modeling Prep";
const DEFAULT_FMP_BASE_URL = "https://financialmodelingprep.com/stable";

export const fmpRecordSchema = z.record(z.string(), z.unknown());
export const fmpRowsSchema = z.array(fmpRecordSchema);
export const fmpRowsOrRecordSchema = z.union([fmpRowsSchema, fmpRecordSchema]);

const endpointSpecs = {
  quote: { required: ["symbol"], allowed: ["symbol"] },
  "historical-price-eod/full": { required: ["symbol"], allowed: ["symbol"] },
  profile: { required: ["symbol"], allowed: ["symbol"] },
  "ratios-ttm": { required: ["symbol"], allowed: ["symbol"] },
  "income-statement": {
    required: ["symbol"],
    allowed: ["symbol", "period", "limit"],
  },
  "cash-flow-statement": {
    required: ["symbol"],
    allowed: ["symbol", "period", "limit"],
  },
  "balance-sheet-statement": {
    required: ["symbol"],
    allowed: ["symbol", "period", "limit"],
  },
  "search-symbol": { required: ["query"], allowed: ["query", "limit"] },
  "search-name": { required: ["query"], allowed: ["query", "limit"] },
  dividends: { required: ["symbol"], allowed: ["symbol"] },
  splits: { required: ["symbol"], allowed: ["symbol"] },
  "exchange-market-hours": {
    required: ["exchange"],
    allowed: ["exchange"],
  },
  "holidays-by-exchange": {
    required: ["exchange"],
    allowed: ["exchange"],
  },
  ratios: { required: ["symbol"], allowed: ["symbol", "limit"] },
  "key-metrics": { required: ["symbol"], allowed: ["symbol", "limit"] },
  "stock-peers": { required: ["symbol"], allowed: ["symbol"] },
  "grades-consensus": { required: ["symbol"], allowed: ["symbol"] },
  "price-target-summary": { required: ["symbol"], allowed: ["symbol"] },
  "news/stock": {
    required: ["symbols"],
    allowed: ["symbols", "page", "limit"],
  },
  "news/stock-latest": { required: [], allowed: ["page", "limit"] },
} as const satisfies Record<
  string,
  { required: readonly string[]; allowed: readonly string[] }
>;

export type FmpEndpoint = keyof typeof endpointSpecs;
export type FmpClientErrorCode =
  | "configuration"
  | "invalid_request"
  | "authentication"
  | "not_entitled"
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export class FmpClientError extends Error {
  constructor(
    readonly code: FmpClientErrorCode,
    readonly endpoint: FmpEndpoint | null,
    readonly status: number | null,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "FmpClientError";
  }
}

export type FmpClientResponse<T> = {
  data: T;
  endpoint: FmpEndpoint;
  latencyMs: number;
  receivedAt: string;
};

export type FmpTransport = (
  url: URL,
  providerName: string,
  options: { timeoutMs: number; maxBytes: number; userAgent: string },
) => Promise<{ data: unknown; latencyMs: number }>;

type FmpClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  transport?: FmpTransport;
};

type FmpRequestOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
};

function configurationError(message: string) {
  return new FmpClientError("configuration", null, null, false, message);
}

function normalizeFmpBaseUrl(value: string | undefined) {
  let url: URL;
  try {
    url = new URL(value?.trim() || DEFAULT_FMP_BASE_URL);
  } catch {
    throw configurationError("FMP-Basisadresse ist ungültig.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "financialmodelingprep.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw configurationError("FMP-Basisadresse ist nicht freigegeben.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "") || "/stable"}/`;
  return url;
}

function normalizeParameter(key: string, value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 500 || /[\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new FmpClientError(
      "invalid_request",
      null,
      null,
      false,
      `FMP-Parameter ${key} ist ungültig.`,
    );
  }
  if (
    key === "symbol" &&
    (!/^[A-Z0-9.^:/=-]{1,32}$/i.test(normalized) ||
      normalized.includes("..") ||
      normalized.startsWith("/") ||
      normalized.endsWith("/"))
  ) {
    throw new FmpClientError("invalid_request", null, null, false, "FMP-Symbol ist ungültig.");
  }
  if (key === "symbols") {
    const symbols = normalized.split(",");
    if (
      symbols.length > 25 ||
      symbols.some(
        (symbol) =>
          !/^[A-Z0-9.^:/=-]{1,32}$/i.test(symbol) ||
          symbol.includes("..") ||
          symbol.startsWith("/") ||
          symbol.endsWith("/"),
      )
    ) {
      throw new FmpClientError("invalid_request", null, null, false, "FMP-Symbolliste ist ungültig.");
    }
  }
  if (key === "exchange" && !/^[A-Z0-9._:-]{1,24}$/i.test(normalized)) {
    throw new FmpClientError("invalid_request", null, null, false, "FMP-Börsencode ist ungültig.");
  }
  if (key === "period" && !["annual", "quarter"].includes(normalized)) {
    throw new FmpClientError("invalid_request", null, null, false, "FMP-Periode ist ungültig.");
  }
  if (["limit", "page"].includes(key)) {
    const numeric = Number(normalized);
    const minimum = key === "page" ? 0 : 1;
    if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > 5_000) {
      throw new FmpClientError("invalid_request", null, null, false, `FMP-Parameter ${key} ist außerhalb der Grenze.`);
    }
  }
  return normalized;
}

function mapFmpError(error: unknown, endpoint: FmpEndpoint): FmpClientError {
  if (error instanceof FmpClientError) return error;
  if (error instanceof ProviderHttpResponseError) {
    if (error.status === 401) {
      return new FmpClientError("authentication", endpoint, 401, false, "FMP-Authentifizierung fehlgeschlagen.");
    }
    if (error.status === 402 || error.status === 403) {
      return new FmpClientError("not_entitled", endpoint, error.status, false, "FMP-Endpunkt oder Instrument ist im aktiven Tarif nicht freigeschaltet.");
    }
    if (error.status === 429) {
      return new FmpClientError("rate_limited", endpoint, 429, true, "FMP-Rate-Limit ist aktiv.");
    }
    if (error.status >= 400 && error.status < 500) {
      return new FmpClientError("invalid_request", endpoint, error.status, false, "FMP hat die Anfrage abgewiesen.");
    }
    return new FmpClientError("unavailable", endpoint, error.status, true, "FMP ist derzeit nicht verfügbar.");
  }

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "ProviderCircuitOpenError" || name === "ProviderBudgetExceededError") {
    return new FmpClientError("rate_limited", endpoint, null, true, "FMP ist vorübergehend gedrosselt.");
  }
  if (/schema|json|antwort/i.test(message)) {
    return new FmpClientError("invalid_response", endpoint, null, false, "FMP lieferte keine verwertbare Antwort.");
  }
  return new FmpClientError("unavailable", endpoint, null, true, "FMP ist derzeit nicht erreichbar.");
}

export class FmpClient {
  private readonly apiKey: string;
  private readonly baseUrl: URL;
  private readonly transport: FmpTransport;

  constructor(options: FmpClientOptions = {}) {
    this.apiKey = (options.apiKey ?? process.env.FMP_API_KEY ?? "").trim();
    if (!this.apiKey) throw configurationError("FMP_API_KEY fehlt.");
    this.baseUrl = normalizeFmpBaseUrl(options.baseUrl ?? process.env.FMP_API_BASE_URL);
    this.transport = options.transport ?? fetchBoundedProviderJson;
  }

  async request<T>(
    endpoint: FmpEndpoint,
    params: Readonly<Record<string, string>>,
    schema: z.ZodType<T>,
    options: FmpRequestOptions = {},
  ): Promise<FmpClientResponse<T>> {
    const spec = endpointSpecs[endpoint];
    if (!spec) {
      throw new FmpClientError("invalid_request", null, null, false, "FMP-Endpunkt ist nicht freigegeben.");
    }

    const allowed = new Set<string>(spec.allowed);
    for (const key of Object.keys(params)) {
      if (!allowed.has(key) || key.toLowerCase() === "apikey") {
        throw new FmpClientError("invalid_request", endpoint, null, false, `FMP-Parameter ${key} ist für diesen Endpunkt nicht erlaubt.`);
      }
    }
    for (const key of spec.required) {
      if (!params[key]?.trim()) {
        throw new FmpClientError("invalid_request", endpoint, null, false, `FMP-Parameter ${key} fehlt.`);
      }
    }

    const url = new URL(endpoint, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, normalizeParameter(key, value));
    }
    url.searchParams.set("apikey", this.apiKey);

    try {
      const response = await this.transport(url, FMP_PROVIDER_NAME, {
        timeoutMs: Math.max(750, Math.min(15_000, options.timeoutMs ?? 8_000)),
        maxBytes: Math.max(64_000, Math.min(5_000_000, options.maxBytes ?? 1_500_000)),
        userAgent: options.userAgent ?? "StockPilotAI/1.0 fmp-adapter",
      });
      const parsed = schema.safeParse(response.data);
      if (!parsed.success) {
        throw new FmpClientError("invalid_response", endpoint, null, false, "FMP lieferte ein unerwartetes Antwortschema.");
      }
      return {
        data: parsed.data,
        endpoint,
        latencyMs: response.latencyMs,
        receivedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw mapFmpError(error, endpoint);
    }
  }
}

export type FmpRequester = Pick<FmpClient, "request">;

export function getFmpClient(options: FmpClientOptions = {}) {
  return new FmpClient(options);
}

export function fmpFailureReason(error: unknown) {
  if (!(error instanceof FmpClientError)) return "Provider derzeit nicht erreichbar";
  switch (error.code) {
    case "configuration":
      return "Provider ist nicht konfiguriert";
    case "authentication":
      return "Provider-Authentifizierung fehlgeschlagen";
    case "not_entitled":
      return "im aktiven Providertarif nicht freigeschaltet";
    case "rate_limited":
      return "Provider-Rate-Limit erreicht";
    case "invalid_request":
      return "Provider-Anfrage ist ungültig";
    case "invalid_response":
      return "Provider-Antwortschema ist ungültig";
    case "unavailable":
      return "Provider derzeit nicht erreichbar";
  }
}

export function getFmpAdapterContract() {
  return {
    providerId: FMP_PROVIDER_ID,
    endpointCount: Object.keys(endpointSpecs).length,
    endpoints: Object.keys(endpointSpecs) as FmpEndpoint[],
    authentication: "server_api_key" as const,
    transport: "bounded_resilient_https" as const,
  };
}
