import "server-only";

import { z } from "zod";

import {
  fetchBoundedProviderJson,
  ProviderHttpResponseError,
  type ProviderJsonResponse,
} from "@/lib/providers/http-json";
import {
  normalizeTwelveDataBars,
  normalizeTwelveDataBatchQuotes,
  normalizeTwelveDataMarketState,
  normalizeTwelveDataQuote,
  normalizeTwelveDataSearch,
  resolveTwelveDataInstrument,
  twelveDataMarketStateSchema,
  twelveDataSearchResponseSchema,
  twelveDataTimeSeriesResponseSchema,
  type TwelveDataResolvedInstrument,
} from "@/lib/providers/twelve-data-normalization";
import type {
  BarInterval,
  MarketDataQuality,
  NormalizedQuote,
} from "@/lib/types";

const BASE_URL = "https://api.twelvedata.com";
const STREAM_URL = "wss://ws.twelvedata.com/v1/quotes/price";
const ENDPOINTS = {
  quote: "quote",
  timeSeries: "time_series",
  symbolSearch: "symbol_search",
  marketState: "market_state",
} as const;

const errorSchema = z
  .object({
    status: z.literal("error"),
    code: z.union([z.number(), z.string()]).optional(),
    message: z.string().optional(),
  })
  .passthrough();

const unknownSchema = z.unknown();

export type TwelveDataErrorCode =
  | "configuration"
  | "invalid_request"
  | "authentication"
  | "not_entitled"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export class TwelveDataClientError extends Error {
  constructor(
    readonly code: TwelveDataErrorCode,
    message: string,
    readonly status: number | null,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "TwelveDataClientError";
  }
}

export type TwelveDataQuota = {
  used: number | null;
  left: number | null;
};

export type TwelveDataResponse<T> = {
  data: T;
  latencyMs: number;
  quota: TwelveDataQuota;
};

export type TwelveDataHistoryInterval =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "4h"
  | "1d"
  | "1w"
  | "1mo";

const providerIntervals: Record<TwelveDataHistoryInterval, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
  "1mo": "1month",
};

function envInteger(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

export function getTwelveDataApiKey(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.TWELVE_DATA_API_KEY?.trim() ||
    env.TWELVEDATA_API_KEY?.trim() ||
    null
  );
}

export function getTwelveDataBatchLimit() {
  // Basic: 8 API credits/min. Ein Batch kostet weiterhin einen Credit je
  // Symbol. Der sichere Default verhindert, dass ein Dashboard 40 Credits in
  // einem einzelnen Aufruf verbraucht; bezahlte Plaene koennen ihn anheben.
  return envInteger("TWELVE_DATA_BATCH_MAX_SYMBOLS", 8, 1, 120);
}

export function getTwelveDataStreamSymbolLimit() {
  // Basic/Grow haben nur acht Trial-Symbole. Full WebSocket ist planabhaengig.
  return envInteger("TWELVE_DATA_STREAM_MAX_SYMBOLS", 8, 1, 5_000);
}

export function isTwelveDataStreamingEnabled() {
  return process.env.TWELVE_DATA_STREAM_ENABLED === "true";
}

function cleanSymbol(value: string) {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._:/-]{0,31}$/.test(symbol)) {
    throw new TwelveDataClientError(
      "invalid_request",
      "Ungueltiges Twelve-Data-Symbol.",
      400,
    );
  }
  return symbol;
}

function providerSymbol(symbol: string) {
  return cleanSymbol(symbol).replace(/-USD$/, "/USD");
}

function safeParameter(value: string, maxLength: number) {
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

function numberHeader(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function errorForStatus(
  httpStatus: number,
  _providerMessage?: string,
  retryAfterMs?: number,
) {
  const code: TwelveDataErrorCode =
    httpStatus === 401
      ? "authentication"
      : httpStatus === 402 || httpStatus === 403
        ? "not_entitled"
        : httpStatus === 404
          ? "not_found"
          : httpStatus === 429
            ? "rate_limited"
            : httpStatus >= 500
              ? "unavailable"
              : "invalid_request";
  const publicMessage =
    code === "rate_limited"
      ? "Twelve Data Rate-Limit erreicht."
      : code === "not_entitled"
        ? "Twelve Data Tarif deckt diese Anfrage nicht ab."
        : code === "authentication"
          ? "Twelve Data Authentifizierung fehlgeschlagen."
          : code === "not_found"
            ? "Instrument bei Twelve Data nicht gefunden."
            : code === "unavailable"
              ? "Twelve Data ist voruebergehend nicht verfuegbar."
              : "Twelve Data Anfrage abgelehnt.";
  return new TwelveDataClientError(
    code,
    publicMessage,
    httpStatus,
    retryAfterMs ?? (httpStatus === 429 ? 60_000 : undefined),
  );
}

function mapBodyError(value: unknown): TwelveDataClientError | null {
  const parsed = errorSchema.safeParse(value);
  if (!parsed.success) return null;
  const status = Number(parsed.data.code);
  return errorForStatus(
    Number.isFinite(status) ? status : 500,
    parsed.data.message,
  );
}

function validated<T>(schema: z.ZodType<T>) {
  return (value: unknown): T => {
    const bodyError = mapBodyError(value);
    if (bodyError) throw bodyError;
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new TwelveDataClientError(
        "invalid_response",
        "Twelve Data lieferte ein unerwartetes Antwortformat.",
        null,
      );
    }
    return parsed.data;
  };
}

function quotaFrom(headers: Record<string, string>): TwelveDataQuota {
  return {
    used: numberHeader(headers["api-credits-used"]),
    left: numberHeader(headers["api-credits-left"]),
  };
}

export class TwelveDataClient {
  private readonly apiKey: string;

  constructor(options: { apiKey?: string } = {}) {
    const apiKey = options.apiKey?.trim() || getTwelveDataApiKey();
    if (!apiKey) {
      throw new TwelveDataClientError(
        "configuration",
        "TWELVE_DATA_API_KEY fehlt.",
        null,
      );
    }
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: keyof typeof ENDPOINTS,
    params: Record<string, string | number | boolean | undefined>,
    schema: z.ZodType<T>,
    options: { timeoutMs?: number; maxBytes?: number } = {},
  ): Promise<TwelveDataResponse<T>> {
    const path = ENDPOINTS[endpoint];
    if (!path) {
      throw new TwelveDataClientError(
        "invalid_request",
        "Nicht freigegebener Twelve-Data-Endpunkt.",
        400,
      );
    }
    const url = new URL(`${BASE_URL}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }

    let result: ProviderJsonResponse<T>;
    try {
      result = await fetchBoundedProviderJson<T>(url, "Twelve Data", {
        timeoutMs: options.timeoutMs ?? 6_500,
        maxBytes: options.maxBytes,
        userAgent: "StockPilotAI/1.0 twelve-data-adapter",
        authorization: `apikey ${this.apiKey}`,
        parseJson: validated(schema),
        captureResponseHeaders: ["api-credits-used", "api-credits-left"],
      });
    } catch (error) {
      if (error instanceof TwelveDataClientError) throw error;
      if (error instanceof ProviderHttpResponseError) {
        throw errorForStatus(
          error.status,
          undefined,
          error.retryAfterMs,
        );
      }
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ProviderBudgetExceededError"
      ) {
        throw new TwelveDataClientError(
          "rate_limited",
          "Twelve Data Rate-Limit erreicht.",
          429,
          "retryAfterMs" in error && typeof error.retryAfterMs === "number"
            ? error.retryAfterMs
            : 60_000,
        );
      }
      throw new TwelveDataClientError(
        "unavailable",
        "Twelve Data ist voruebergehend nicht verfuegbar.",
        null,
      );
    }

    return {
      data: result.data,
      latencyMs: result.latencyMs,
      quota: quotaFrom(result.responseHeaders),
    };
  }

  async searchInstruments(query: string, outputsize = 40) {
    const normalized = safeParameter(query, 64);
    if (!normalized) {
      throw new TwelveDataClientError(
        "invalid_request",
        "Twelve Data Suchbegriff fehlt.",
        400,
      );
    }
    const response = await this.request(
      "symbolSearch",
      {
        symbol: normalized,
        outputsize: Math.min(120, Math.max(1, Math.floor(outputsize))),
        show_plan: true,
      },
      twelveDataSearchResponseSchema,
    );
    return {
      ...response,
      data: normalizeTwelveDataSearch(response.data),
    };
  }

  async resolveInstrument(identifier: {
    symbol: string;
    exchange?: string;
    mic?: string;
    country?: string;
  }) {
    const search = await this.searchInstruments(cleanSymbol(identifier.symbol), 120);
    return {
      ...resolveTwelveDataInstrument(search.data, identifier),
      latencyMs: search.latencyMs,
      quota: search.quota,
    };
  }

  async getQuote(
    symbol: string,
    quality: MarketDataQuality,
    now = new Date(),
  ) {
    const response = await this.request(
      "quote",
      { symbol: providerSymbol(symbol) },
      unknownSchema,
      { maxBytes: 256_000 },
    );
    return {
      ...response,
      data: normalizeTwelveDataQuote(response.data, cleanSymbol(symbol), {
        quality,
        latencyMs: response.latencyMs,
        now,
      }),
    };
  }

  async getQuotes(
    symbols: readonly string[],
    quality: MarketDataQuality,
    now = new Date(),
  ) {
    const normalized = [...new Set(symbols.map(cleanSymbol))].slice(
      0,
      getTwelveDataBatchLimit(),
    );
    if (!normalized.length) {
      return {
        data: [] as NormalizedQuote[],
        latencyMs: 0,
        quota: { used: null, left: null } satisfies TwelveDataQuota,
      };
    }
    const response = await this.request(
      "quote",
      { symbol: normalized.map(providerSymbol).join(",") },
      unknownSchema,
      { maxBytes: 512_000 },
    );
    return {
      ...response,
      data: normalizeTwelveDataBatchQuotes(response.data, normalized, {
        quality,
        latencyMs: response.latencyMs,
        now,
      }),
    };
  }

  async getHistoricalBars(
    symbol: string,
    interval: TwelveDataHistoryInterval,
    options: {
      outputsize?: number;
      instrumentId?: string | null;
      venue?: string | null;
      currency?: string | null;
      now?: Date;
    } = {},
  ) {
    const response = await this.request(
      "timeSeries",
      {
        symbol: providerSymbol(symbol),
        interval: providerIntervals[interval],
        outputsize: Math.min(5_000, Math.max(1, options.outputsize ?? 500)),
        order: "ASC",
        timezone: interval === "1d" || interval === "1w" || interval === "1mo" ? undefined : "UTC",
        adjust: "none",
      },
      twelveDataTimeSeriesResponseSchema,
      { maxBytes: 2_500_000, timeoutMs: 9_000 },
    );
    return {
      ...response,
      data: normalizeTwelveDataBars(response.data, cleanSymbol(symbol), options),
    };
  }

  async getMarketStatus(filter: {
    exchange?: string;
    mic?: string;
    country?: string;
  } = {}) {
    const response = await this.request(
      "marketState",
      {
        exchange: filter.exchange ? safeParameter(filter.exchange, 80) : undefined,
        code: filter.mic ? safeParameter(filter.mic, 32) : undefined,
        country: filter.country ? safeParameter(filter.country, 80) : undefined,
      },
      twelveDataMarketStateSchema,
      { maxBytes: 512_000 },
    );
    return {
      ...response,
      data: normalizeTwelveDataMarketState(response.data),
    };
  }

  async healthCheck() {
    const checkedAt = new Date().toISOString();
    const result = await this.getMarketStatus({ exchange: "NYSE" });
    return {
      status: result.data.length ? ("ok" as const) : ("degraded" as const),
      latencyMs: result.latencyMs,
      checkedAt,
      quota: result.quota,
      message: result.data.length
        ? "Twelve Data Market-State erreichbar."
        : "Twelve Data antwortete ohne Marktstatus.",
    };
  }
}

export function getTwelveDataClient(options: { apiKey?: string } = {}) {
  return new TwelveDataClient(options);
}

type WebSocketEventMap = {
  open: Event;
  message: MessageEvent;
  error: Event;
  close: CloseEvent;
};

export interface TwelveDataWebSocket {
  readonly readyState: number;
  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void,
  ): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type TwelveDataStreamOptions = {
  signal?: AbortSignal;
  quality: MarketDataQuality;
  socketFactory?: (url: string) => TwelveDataWebSocket;
  reconnectBaseMs?: number;
};

function websocketFactory(url: string): TwelveDataWebSocket {
  if (typeof WebSocket === "undefined") {
    throw new TwelveDataClientError(
      "unavailable",
      "WebSocket-Laufzeit nicht verfuegbar.",
      null,
    );
  }
  return new WebSocket(url);
}

function streamQuote(
  raw: unknown,
  requestedByProviderSymbol: ReadonlyMap<string, string>,
  quality: MarketDataQuality,
) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.event !== "price") return null;
  const sourceSymbol = String(row.symbol ?? "").toUpperCase();
  const requested = requestedByProviderSymbol.get(sourceSymbol);
  if (!requested) return null;
  return normalizeTwelveDataQuote(
    {
      symbol: sourceSymbol,
      close: row.price,
      timestamp: row.timestamp,
      volume: row.day_volume ?? row.volume,
      currency: row.currency,
      exchange: row.exchange,
      type: row.type,
    },
    requested,
    { quality, latencyMs: 0 },
  );
}

export async function* streamTwelveDataQuotes(
  symbols: readonly string[],
  options: TwelveDataStreamOptions,
): AsyncIterable<NormalizedQuote[]> {
  if (!isTwelveDataStreamingEnabled()) {
    throw new TwelveDataClientError(
      "configuration",
      "Twelve Data Streaming ist nicht aktiviert.",
      null,
    );
  }
  const key = getTwelveDataApiKey();
  if (!key) {
    throw new TwelveDataClientError(
      "configuration",
      "TWELVE_DATA_API_KEY fehlt.",
      null,
    );
  }
  const normalized = [...new Set(symbols.map(cleanSymbol))];
  if (!normalized.length || normalized.length > getTwelveDataStreamSymbolLimit()) {
    throw new TwelveDataClientError(
      "invalid_request",
      "Twelve Data Stream-Symbollimit ueberschritten.",
      400,
    );
  }
  const providerSymbols = normalized.map(providerSymbol);
  const requestedByProviderSymbol = new Map(
    providerSymbols.map((item, index) => [item, normalized[index]]),
  );
  const factory = options.socketFactory ?? websocketFactory;
  let reconnectAttempt = 0;

  while (!options.signal?.aborted) {
    const socket = factory(`${STREAM_URL}?apikey=${encodeURIComponent(key)}`);
    const queue: NormalizedQuote[][] = [];
    let closed = false;
    let wake: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const wakeReader = () => {
      wake?.();
      wake = null;
    };
    const stop = () => {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      wakeReader();
    };

    const abortHandler = () => {
      stop();
      socket.close(1000, "client abort");
    };
    options.signal?.addEventListener("abort", abortHandler, { once: true });
    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      socket.send(
        JSON.stringify({
          action: "subscribe",
          params: { symbols: providerSymbols.join(",") },
        }),
      );
      heartbeat = setInterval(() => {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify({ action: "heartbeat" }));
        }
      }, 10_000);
    });
    socket.addEventListener("message", (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as unknown;
        const quote = streamQuote(
          parsed,
          requestedByProviderSymbol,
          options.quality,
        );
        if (!quote) return;
        if (queue.length >= 32) queue.shift();
        queue.push([quote]);
        wakeReader();
      } catch {
        // Ungueltige Einzelereignisse werden verworfen; die Verbindung bleibt.
      }
    });
    socket.addEventListener("error", stop);
    socket.addEventListener("close", stop);

    try {
      while (!closed && !options.signal?.aborted) {
        const next = queue.shift();
        if (next) {
          yield next;
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      options.signal?.removeEventListener("abort", abortHandler);
      if (heartbeat) clearInterval(heartbeat);
      socket.close();
    }
    if (options.signal?.aborted) break;
    reconnectAttempt += 1;
    const base = Math.max(250, options.reconnectBaseMs ?? 500);
    const delay = Math.min(15_000, base * 2 ** Math.min(reconnectAttempt, 5));
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export function asTwelveDataHistoryInterval(
  interval: BarInterval,
): TwelveDataHistoryInterval | null {
  return interval in providerIntervals
    ? (interval as TwelveDataHistoryInterval)
    : null;
}

export type { TwelveDataResolvedInstrument };
