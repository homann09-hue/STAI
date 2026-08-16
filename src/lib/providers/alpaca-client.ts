import "server-only";

import { z } from "zod";

import {
  fetchBoundedProviderJson,
  ProviderHttpResponseError,
  type ProviderJsonResponse,
} from "@/lib/providers/http-json";
import {
  alpacaBarsResponseSchema,
  alpacaClockSchema,
  alpacaFeedMetadata,
  alpacaQuoteSchema,
  alpacaSnapshotSchema,
  alpacaTradeSchema,
  normalizeAlpacaBars,
  normalizeAlpacaSnapshot,
  normalizeAlpacaTrade,
  type AlpacaBar,
  type AlpacaClock,
  type AlpacaFeed,
  type AlpacaQuote,
  type AlpacaSnapshot,
  type AlpacaTrade,
} from "@/lib/providers/alpaca-normalization";
import type {
  BarInterval,
  NormalizedQuote,
  NormalizedTrade,
} from "@/lib/types";

const DATA_BASE_URL = "https://data.alpaca.markets";
const PAPER_BASE_URL = "https://paper-api.alpaca.markets";
const LIVE_BASE_URL = "https://api.alpaca.markets";
const STREAM_BASE_URL = "wss://stream.data.alpaca.markets/v2";

const snapshotBatchSchema = z.union([
  z.record(z.string(), alpacaSnapshotSchema),
  z.object({ snapshots: z.record(z.string(), alpacaSnapshotSchema) }),
]);
const latestTradesSchema = z.object({
  trades: z.record(z.string(), alpacaTradeSchema),
}).passthrough();
const providerErrorSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
}).passthrough();

export type AlpacaErrorCode =
  | "configuration"
  | "invalid_request"
  | "authentication"
  | "not_entitled"
  | "not_found"
  | "rate_limited"
  | "connection_limit"
  | "symbol_limit"
  | "slow_consumer"
  | "stream_backpressure"
  | "unavailable"
  | "invalid_response";

export class AlpacaClientError extends Error {
  constructor(
    readonly code: AlpacaErrorCode,
    message: string,
    readonly status: number | null,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AlpacaClientError";
  }
}

export type AlpacaCredentials = { keyId: string; secretKey: string };
export type AlpacaQuota = {
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
};
export type AlpacaResponse<T> = {
  data: T;
  latencyMs: number;
  quota: AlpacaQuota;
};

function envInteger(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

export function getAlpacaCredentials(
  env: NodeJS.ProcessEnv = process.env,
): AlpacaCredentials | null {
  const keyId = env.ALPACA_API_KEY_ID?.trim();
  const secretKey = env.ALPACA_API_SECRET_KEY?.trim();
  return keyId && secretKey ? { keyId, secretKey } : null;
}

export function getAlpacaFeed(env: NodeJS.ProcessEnv = process.env): AlpacaFeed {
  const value = (env.ALPACA_DATA_FEED ?? "iex").trim().toLowerCase();
  if (value === "iex" || value === "sip" || value === "delayed_sip") return value;
  throw new AlpacaClientError(
    "configuration",
    "ALPACA_DATA_FEED muss iex, sip oder delayed_sip sein.",
    null,
  );
}

export function getAlpacaStreamSymbolLimit() {
  return envInteger("ALPACA_STREAM_MAX_SYMBOLS", 30, 1, 10_000);
}

export function getAlpacaBatchLimit() {
  return envInteger("ALPACA_BATCH_MAX_SYMBOLS", 30, 1, 200);
}

export function isAlpacaStreamingEnabled() {
  return process.env.ALPACA_STREAM_ENABLED === "true";
}

function cleanSymbol(value: string) {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,15}$/.test(symbol)) {
    throw new AlpacaClientError("invalid_request", "Ungültiges Alpaca-Symbol.", 400);
  }
  return symbol;
}

function numberHeader(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function quotaFrom(headers: Record<string, string>): AlpacaQuota {
  const reset = headers["x-ratelimit-reset"];
  const resetNumber = Number(reset);
  return {
    limit: numberHeader(headers["x-ratelimit-limit"]),
    remaining: numberHeader(headers["x-ratelimit-remaining"]),
    resetAt:
      Number.isFinite(resetNumber) && resetNumber > 0
        ? new Date(resetNumber * 1000).toISOString()
        : null,
  };
}

function errorForStatus(status: number, retryAfterMs?: number) {
  const code: AlpacaErrorCode =
    status === 401
      ? "authentication"
      : status === 402 || status === 403
        ? "not_entitled"
        : status === 404
          ? "not_found"
          : status === 429
            ? "rate_limited"
            : status >= 500
              ? "unavailable"
              : "invalid_request";
  const message =
    code === "authentication"
      ? "Alpaca-Authentifizierung fehlgeschlagen."
      : code === "not_entitled"
        ? "Der Alpaca-Tarif deckt diesen Feed oder diese Anfrage nicht ab."
        : code === "not_found"
          ? "Instrument bei Alpaca nicht gefunden."
          : code === "rate_limited"
            ? "Alpaca-Rate-Limit erreicht."
            : code === "unavailable"
              ? "Alpaca ist vorübergehend nicht verfügbar."
              : "Alpaca-Anfrage wurde abgelehnt.";
  return new AlpacaClientError(
    code,
    message,
    status,
    retryAfterMs ?? (status === 429 ? 1_000 : undefined),
  );
}

function validated<T>(schema: z.ZodType<T>) {
  return (value: unknown): T => {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    const providerError = providerErrorSchema.safeParse(value);
    if (providerError.success && providerError.data.message) {
      throw new AlpacaClientError(
        "invalid_response",
        "Alpaca meldete eine nicht verwertbare Antwort.",
        null,
      );
    }
    throw new AlpacaClientError(
      "invalid_response",
      "Alpaca lieferte ein unerwartetes Antwortformat.",
      null,
    );
  };
}

const timeframe: Record<BarInterval, string> = {
  "1m": "1Min",
  "5m": "5Min",
  "15m": "15Min",
  "30m": "30Min",
  "1h": "1Hour",
  "4h": "4Hour",
  "1d": "1Day",
  "1w": "1Week",
  "1mo": "1Month",
};

function defaultHistoryStart(interval: BarInterval, now: Date) {
  const days: Record<BarInterval, number> = {
    "1m": 5,
    "5m": 15,
    "15m": 45,
    "30m": 90,
    "1h": 365,
    "4h": 1_000,
    "1d": 3_650,
    "1w": 5_000,
    "1mo": 8_000,
  };
  return new Date(now.getTime() - days[interval] * 86_400_000).toISOString();
}

export class AlpacaClient {
  private readonly credentials: AlpacaCredentials;
  readonly feed: AlpacaFeed;

  constructor(options: {
    keyId?: string;
    secretKey?: string;
    feed?: AlpacaFeed;
  } = {}) {
    const envCredentials = getAlpacaCredentials();
    const keyId = options.keyId?.trim() || envCredentials?.keyId;
    const secretKey = options.secretKey?.trim() || envCredentials?.secretKey;
    if (!keyId || !secretKey) {
      throw new AlpacaClientError(
        "configuration",
        "ALPACA_API_KEY_ID oder ALPACA_API_SECRET_KEY fehlt.",
        null,
      );
    }
    this.credentials = { keyId, secretKey };
    this.feed = options.feed ?? getAlpacaFeed();
  }

  private async request<T>(
    url: URL,
    schema: z.ZodType<T>,
    options: { timeoutMs?: number; maxBytes?: number } = {},
  ): Promise<AlpacaResponse<T>> {
    let result: ProviderJsonResponse<T>;
    try {
      result = await fetchBoundedProviderJson(url, "Alpaca", {
        timeoutMs: options.timeoutMs ?? 6_500,
        maxBytes: options.maxBytes,
        userAgent: "StockPilotAI/1.0 alpaca-adapter",
        requestHeaders: {
          "APCA-API-KEY-ID": this.credentials.keyId,
          "APCA-API-SECRET-KEY": this.credentials.secretKey,
        },
        parseJson: validated(schema),
        captureResponseHeaders: [
          "x-ratelimit-limit",
          "x-ratelimit-remaining",
          "x-ratelimit-reset",
        ],
      });
    } catch (error) {
      if (error instanceof AlpacaClientError) throw error;
      if (error instanceof ProviderHttpResponseError) {
        throw errorForStatus(error.status, error.retryAfterMs);
      }
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "ProviderBudgetExceededError"
      ) {
        throw new AlpacaClientError(
          "rate_limited",
          "Alpaca-Rate-Limit erreicht.",
          429,
          "retryAfterMs" in error && typeof error.retryAfterMs === "number"
            ? error.retryAfterMs
            : 1_000,
        );
      }
      throw new AlpacaClientError(
        "unavailable",
        "Alpaca ist vorübergehend nicht verfügbar.",
        null,
      );
    }
    return {
      data: result.data,
      latencyMs: result.latencyMs,
      quota: quotaFrom(result.responseHeaders),
    };
  }

  async getMarketClock(): Promise<AlpacaResponse<AlpacaClock>> {
    const base = process.env.ALPACA_TRADING_ENV === "live" ? LIVE_BASE_URL : PAPER_BASE_URL;
    return this.request(new URL(`${base}/v2/clock`), alpacaClockSchema, {
      maxBytes: 128_000,
    });
  }

  private async optionalClock() {
    try {
      return (await this.getMarketClock()).data;
    } catch {
      return null;
    }
  }

  async getSnapshot(symbol: string) {
    const normalized = cleanSymbol(symbol);
    const url = new URL(`${DATA_BASE_URL}/v2/stocks/${encodeURIComponent(normalized)}/snapshot`);
    url.searchParams.set("feed", this.feed);
    url.searchParams.set("currency", "USD");
    const [snapshot, clock] = await Promise.all([
      this.request(url, alpacaSnapshotSchema, { maxBytes: 256_000 }),
      this.optionalClock(),
    ]);
    return {
      ...snapshot,
      data: normalizeAlpacaSnapshot(normalized, snapshot.data, {
        feed: this.feed,
        latencyMs: snapshot.latencyMs,
        clock,
      }),
    };
  }

  async getSnapshots(symbols: readonly string[]) {
    const normalized = [...new Set(symbols.map(cleanSymbol))].slice(0, getAlpacaBatchLimit());
    if (!normalized.length) {
      return {
        data: [] as NormalizedQuote[],
        latencyMs: 0,
        quota: { limit: null, remaining: null, resetAt: null } satisfies AlpacaQuota,
      };
    }
    const url = new URL(`${DATA_BASE_URL}/v2/stocks/snapshots`);
    url.searchParams.set("symbols", normalized.join(","));
    url.searchParams.set("feed", this.feed);
    url.searchParams.set("currency", "USD");
    const [response, clock] = await Promise.all([
      this.request(url, snapshotBatchSchema, { maxBytes: 1_500_000 }),
      this.optionalClock(),
    ]);
    const snapshots = "snapshots" in response.data ? response.data.snapshots : response.data;
    return {
      ...response,
      data: normalized.flatMap((symbol) => {
        const snapshot = snapshots[symbol];
        if (!snapshot) return [];
        const quote = normalizeAlpacaSnapshot(symbol, snapshot as AlpacaSnapshot, {
          feed: this.feed,
          latencyMs: response.latencyMs,
          clock,
        });
        return quote ? [quote] : [];
      }),
    };
  }

  async getLatestTrades(symbols: readonly string[]) {
    const normalized = [...new Set(symbols.map(cleanSymbol))].slice(0, getAlpacaBatchLimit());
    if (!normalized.length) {
      return {
        data: [] as NormalizedTrade[],
        latencyMs: 0,
        quota: { limit: null, remaining: null, resetAt: null } satisfies AlpacaQuota,
      };
    }
    const url = new URL(`${DATA_BASE_URL}/v2/stocks/trades/latest`);
    url.searchParams.set("symbols", normalized.join(","));
    url.searchParams.set("feed", this.feed);
    url.searchParams.set("currency", "USD");
    const response = await this.request(url, latestTradesSchema, { maxBytes: 512_000 });
    return {
      ...response,
      data: normalized.flatMap((symbol) => {
        const trade = response.data.trades[symbol];
        if (!trade) return [];
        const normalizedTrade = normalizeAlpacaTrade(symbol, trade, this.feed);
        return normalizedTrade ? [normalizedTrade] : [];
      }),
    };
  }

  async getHistoricalBars(
    symbol: string,
    interval: BarInterval,
    options: {
      start?: string;
      end?: string;
      limit?: number;
      instrumentId?: string | null;
      currency?: string | null;
      now?: Date;
    } = {},
  ) {
    const normalized = cleanSymbol(symbol);
    const now = options.now ?? new Date();
    const requestedLimit = Math.min(10_000, Math.max(1, options.limit ?? 1_500));
    const maxPages = envInteger("ALPACA_HISTORY_MAX_PAGES", 5, 1, 20);
    const bars: AlpacaBar[] = [];
    let pageToken: string | null = null;
    let latencyMs = 0;
    let quota: AlpacaQuota = { limit: null, remaining: null, resetAt: null };
    const historicalFeed = this.feed === "delayed_sip" ? "sip" : this.feed;
    const delayedEnd = new Date(now.getTime() - 15 * 60_000).toISOString();

    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL(`${DATA_BASE_URL}/v2/stocks/${encodeURIComponent(normalized)}/bars`);
      url.searchParams.set("timeframe", timeframe[interval]);
      url.searchParams.set("start", options.start ?? defaultHistoryStart(interval, now));
      url.searchParams.set("end", options.end ?? (this.feed === "delayed_sip" ? delayedEnd : now.toISOString()));
      url.searchParams.set("limit", String(requestedLimit));
      url.searchParams.set("adjustment", "raw");
      url.searchParams.set("feed", historicalFeed);
      url.searchParams.set("currency", "USD");
      url.searchParams.set("sort", "asc");
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const response = await this.request(url, alpacaBarsResponseSchema, {
        timeoutMs: 9_000,
        maxBytes: 2_500_000,
      });
      bars.push(...response.data.bars);
      latencyMs += response.latencyMs;
      quota = response.quota;
      pageToken = response.data.next_page_token ?? null;
      if (!pageToken || bars.length >= requestedLimit) break;
    }

    return {
      data: normalizeAlpacaBars(normalized, bars.slice(0, requestedLimit), {
        feed: this.feed,
        interval,
        instrumentId: options.instrumentId,
        currency: options.currency,
        now,
      }),
      latencyMs,
      quota,
      truncated: Boolean(pageToken),
    };
  }

  async healthCheck() {
    const checkedAt = new Date().toISOString();
    const response = await this.getSnapshot("AAPL");
    return {
      status: response.data ? ("ok" as const) : ("degraded" as const),
      latencyMs: response.latencyMs,
      checkedAt,
      quota: response.quota,
      feed: this.feed,
      message: response.data
        ? `${alpacaFeedMetadata(this.feed).providerLabel} erreichbar.`
        : "Alpaca antwortete ohne verwertbaren AAPL-Snapshot.",
    };
  }
}

export function getAlpacaClient(options: ConstructorParameters<typeof AlpacaClient>[0] = {}) {
  return new AlpacaClient(options);
}

type WebSocketEventMap = {
  open: Event;
  message: MessageEvent;
  error: Event;
  close: CloseEvent;
};

export interface AlpacaWebSocket {
  readonly readyState: number;
  addEventListener<K extends keyof WebSocketEventMap>(
    type: K,
    listener: (event: WebSocketEventMap[K]) => void,
  ): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type AlpacaMarketStreamBatch = {
  quotes: NormalizedQuote[];
  trades: NormalizedTrade[];
};

export type AlpacaStreamOptions = {
  signal?: AbortSignal;
  feed?: AlpacaFeed;
  quotes?: boolean;
  trades?: boolean;
  socketFactory?: (url: string) => AlpacaWebSocket;
  reconnectBaseMs?: number;
  maxQueuedBatches?: number;
};

function websocketFactory(url: string): AlpacaWebSocket {
  if (typeof WebSocket === "undefined") {
    throw new AlpacaClientError("unavailable", "WebSocket-Laufzeit nicht verfügbar.", null);
  }
  return new WebSocket(url);
}

let alpacaStreamLease = false;

/** @internal Nur für isolierte Lifecycle-Tests. */
export function resetAlpacaStreamLeaseForTests() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Alpaca-Streamstatus darf nur in Tests zurückgesetzt werden.");
  }
  alpacaStreamLease = false;
}

function streamError(code: number): AlpacaClientError {
  if (code === 402) return new AlpacaClientError("authentication", "Alpaca WebSocket-Authentifizierung fehlgeschlagen.", 401);
  if (code === 405) return new AlpacaClientError("symbol_limit", "Alpaca WebSocket-Symbollimit überschritten.", 400);
  if (code === 406) return new AlpacaClientError("connection_limit", "Alpaca erlaubt für diesen Tarif keine weitere WebSocket-Verbindung.", 409);
  if (code === 407) return new AlpacaClientError("slow_consumer", "Alpaca trennte einen zu langsamen Stream-Client.", 503);
  if (code === 409) return new AlpacaClientError("not_entitled", "Der Alpaca-Tarif erlaubt diesen WebSocket-Feed nicht.", 403);
  return new AlpacaClientError("unavailable", "Alpaca WebSocket meldete einen Fehler.", code);
}

function parseStreamMessages(data: unknown): unknown[] {
  try {
    const parsed = JSON.parse(String(data)) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function quoteFromStreamState(
  symbol: string,
  quote: AlpacaQuote | null,
  trade: AlpacaTrade | null,
  feed: AlpacaFeed,
) {
  if (!trade) return null;
  return normalizeAlpacaSnapshot(
    symbol,
    { latestTrade: trade, latestQuote: quote, minuteBar: null, dailyBar: null, prevDailyBar: null },
    { feed, latencyMs: 0 },
  );
}

async function abortableDelay(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export async function* streamAlpacaMarketData(
  symbols: readonly string[],
  options: AlpacaStreamOptions = {},
): AsyncIterable<AlpacaMarketStreamBatch> {
  const credentials = getAlpacaCredentials();
  if (!credentials) {
    throw new AlpacaClientError("configuration", "Alpaca-Stream-Credentials fehlen.", null);
  }
  const feed = options.feed ?? getAlpacaFeed();
  const normalized = [...new Set(symbols.map(cleanSymbol))];
  const wantsQuotes = options.quotes !== false;
  const wantsTrades = options.trades === true || wantsQuotes;
  if (!normalized.length || normalized.length > getAlpacaStreamSymbolLimit()) {
    throw new AlpacaClientError("symbol_limit", "Alpaca WebSocket-Symbollimit überschritten.", 400);
  }
  if (!wantsQuotes && !wantsTrades) {
    throw new AlpacaClientError("invalid_request", "Mindestens ein Alpaca-Streamkanal ist erforderlich.", 400);
  }
  if (alpacaStreamLease) {
    throw new AlpacaClientError("connection_limit", "Der eine Alpaca-Upstream-Stream dieses Prozesses ist bereits belegt.", 409);
  }
  alpacaStreamLease = true;
  const factory = options.socketFactory ?? websocketFactory;
  const latestQuotes = new Map<string, AlpacaQuote>();
  const latestTrades = new Map<string, AlpacaTrade>();
  let reconnectAttempt = 0;

  try {
    while (!options.signal?.aborted) {
      const socket = factory(`${STREAM_BASE_URL}/${feed}`);
      const queue: AlpacaMarketStreamBatch[] = [];
      const maxQueued = Math.max(1, Math.min(512, options.maxQueuedBatches ?? 64));
      let closed = false;
      let wake: (() => void) | null = null;
      let fatal: AlpacaClientError | null = null;
      let authTimer: ReturnType<typeof setTimeout> | null = null;
      const wakeReader = () => {
        wake?.();
        wake = null;
      };
      const stop = () => {
        closed = true;
        if (authTimer) clearTimeout(authTimer);
        authTimer = null;
        wakeReader();
      };
      const enqueue = (batch: AlpacaMarketStreamBatch) => {
        if (!batch.quotes.length && !batch.trades.length) return;
        if (queue.length >= maxQueued) {
          fatal = new AlpacaClientError("stream_backpressure", "Alpaca-Streamverbraucher ist zu langsam; Datenlücke verhindert.", 503);
          socket.close(1008, "slow consumer");
          stop();
          return;
        }
        queue.push(batch);
        wakeReader();
      };
      const abortHandler = () => {
        socket.close(1000, "client abort");
        stop();
      };
      options.signal?.addEventListener("abort", abortHandler, { once: true });

      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({ action: "auth", key: credentials.keyId, secret: credentials.secretKey }));
        authTimer = setTimeout(() => {
          fatal = new AlpacaClientError("authentication", "Alpaca WebSocket-Authentifizierung lief ab.", 401);
          socket.close(1008, "auth timeout");
          stop();
        }, 9_000);
      });
      socket.addEventListener("message", (event) => {
        for (const raw of parseStreamMessages(event.data)) {
          if (!raw || typeof raw !== "object") continue;
          const row = raw as Record<string, unknown>;
          if (row.T === "success" && row.msg === "authenticated") {
            reconnectAttempt = 0;
            if (authTimer) clearTimeout(authTimer);
            authTimer = null;
            socket.send(JSON.stringify({
              action: "subscribe",
              ...(wantsQuotes ? { quotes: normalized } : {}),
              ...(wantsTrades ? { trades: normalized } : {}),
            }));
            continue;
          }
          if (row.T === "error") {
            const code = Number(row.code);
            const mapped = streamError(Number.isFinite(code) ? code : 500);
            if (["authentication", "not_entitled", "connection_limit", "symbol_limit"].includes(mapped.code)) {
              fatal = mapped;
            }
            socket.close(1008, "provider error");
            stop();
            continue;
          }
          const symbol = typeof row.S === "string" ? row.S.toUpperCase() : "";
          if (!normalized.includes(symbol)) continue;
          if (row.T === "q") {
            const parsed = alpacaQuoteSchema.safeParse(row);
            if (!parsed.success) continue;
            latestQuotes.set(symbol, parsed.data);
            if (wantsQuotes) {
              const quote = quoteFromStreamState(symbol, parsed.data, latestTrades.get(symbol) ?? null, feed);
              if (quote) enqueue({ quotes: [quote], trades: [] });
            }
            continue;
          }
          if (row.T === "t") {
            const parsed = alpacaTradeSchema.safeParse(row);
            if (!parsed.success) continue;
            latestTrades.set(symbol, parsed.data);
            const trade = normalizeAlpacaTrade(symbol, parsed.data, feed);
            const quote = wantsQuotes
              ? quoteFromStreamState(symbol, latestQuotes.get(symbol) ?? null, parsed.data, feed)
              : null;
            enqueue({
              quotes: quote ? [quote] : [],
              trades: options.trades === true && trade ? [trade] : [],
            });
          }
        }
      });
      socket.addEventListener("error", () => {
        socket.close();
        stop();
      });
      socket.addEventListener("close", stop);

      try {
        while (!closed && !options.signal?.aborted) {
          const next = queue.shift();
          if (next) {
            yield next;
            continue;
          }
          await new Promise<void>((resolve) => { wake = resolve; });
        }
      } finally {
        options.signal?.removeEventListener("abort", abortHandler);
        if (authTimer) clearTimeout(authTimer);
        socket.close();
      }
      if (fatal) throw fatal;
      if (options.signal?.aborted) break;
      reconnectAttempt += 1;
      const base = Math.max(10, options.reconnectBaseMs ?? 500);
      await abortableDelay(Math.min(15_000, base * 2 ** Math.min(reconnectAttempt, 5)), options.signal);
    }
  } finally {
    alpacaStreamLease = false;
  }
}

export async function* streamAlpacaQuotes(
  symbols: readonly string[],
  options: Omit<AlpacaStreamOptions, "quotes" | "trades"> = {},
) {
  for await (const batch of streamAlpacaMarketData(symbols, {
    ...options,
    quotes: true,
    trades: false,
  })) {
    if (batch.quotes.length) yield batch.quotes;
  }
}

export async function* streamAlpacaTrades(
  symbols: readonly string[],
  options: Omit<AlpacaStreamOptions, "quotes" | "trades"> = {},
) {
  for await (const batch of streamAlpacaMarketData(symbols, {
    ...options,
    quotes: false,
    trades: true,
  })) {
    if (batch.trades.length) yield batch.trades;
  }
}
