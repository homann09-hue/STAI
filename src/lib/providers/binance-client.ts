import "server-only";

import {
  isBinanceStreamSymbol,
  normalizeBinanceKline,
  normalizeBinanceProviderSymbol,
  normalizeBinanceQuote,
  normalizeBinanceTrade,
  parseBinanceBookTicker,
  parseBinanceTicker,
  type BinanceBookTickerPayload,
  type BinanceTickerPayload,
} from "@/lib/providers/binance-normalization";
import type { BarInterval, MarketDataQuality, NormalizedBar, NormalizedQuote, NormalizedTrade } from "@/lib/types";

const BINANCE_MARKET_STREAM_URL = "wss://data-stream.binance.vision/stream";

type SocketEvent = { data?: unknown };
type SocketListener = (event: SocketEvent) => void;

export interface BinanceSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "open" | "message" | "close" | "error", listener: SocketListener): void;
}

export type BinanceSocketFactory = (url: string) => BinanceSocketLike;
export type BinanceStreamKind = "quote" | "trade" | "bar";
type StreamRecord = NormalizedQuote | NormalizedTrade | NormalizedBar;

export class BinanceStreamError extends Error {
  constructor(readonly code: "invalid_symbol" | "capacity" | "slow_consumer" | "provider_protocol", message: string) {
    super(message);
    this.name = "BinanceStreamError";
  }
}

interface Subscriber {
  id: number;
  kind: BinanceStreamKind;
  products: Set<string>;
  originalByProduct: Map<string, string>;
  quality: MarketDataQuality;
  interval: BarInterval;
  queue: StreamRecord[][];
  maxQueuedBatches: number;
  error: BinanceStreamError | null;
  closed: boolean;
  wake: (() => void) | null;
}

export interface BinanceStreamOptions {
  signal?: AbortSignal;
  quality?: MarketDataQuality;
  resolveSymbol?: (providerSymbol: string) => string;
  interval?: BarInterval;
  maxQueuedBatches?: number;
}

export interface BinanceStreamHubOptions {
  socketFactory?: BinanceSocketFactory;
  maxSymbols?: number;
  reconnectBaseMs?: number;
  inactivityTimeoutMs?: number;
  connectionLifetimeMs?: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultSocketFactory(url: string): BinanceSocketLike {
  if (typeof WebSocket === "undefined") throw new BinanceStreamError("provider_protocol", "WebSocket ist in dieser Server-Laufzeit nicht verfuegbar.");
  return new WebSocket(url) as unknown as BinanceSocketLike;
}

function parseMessage(data: unknown): unknown {
  if (typeof data !== "string" || data.length > 524_288) return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && "data" in parsed) return (parsed as { data: unknown }).data;
    return parsed;
  } catch {
    return null;
  }
}

function streamSuffix(subscriber: Subscriber): string[] {
  if (subscriber.kind === "quote") return ["ticker", "bookTicker"];
  if (subscriber.kind === "trade") return ["trade"];
  const interval = subscriber.interval === "1mo" ? "1M" : subscriber.interval;
  return [`kline_${interval}`];
}

export class BinanceStreamHub {
  private readonly socketFactory: BinanceSocketFactory;
  private readonly maxSymbols: number;
  private readonly reconnectBaseMs: number;
  private readonly inactivityTimeoutMs: number;
  private readonly connectionLifetimeMs: number;
  private readonly subscribers = new Map<number, Subscriber>();
  private readonly latestTicker = new Map<string, BinanceTickerPayload>();
  private readonly latestBook = new Map<string, BinanceBookTickerPayload>();
  private readonly lastTradeId = new Map<string, number>();
  private readonly lastBookUpdateId = new Map<string, number>();
  private socket: BinanceSocketLike | null = null;
  private socketOpen = false;
  private activeStreams = new Set<string>();
  private nextSubscriberId = 1;
  private nextRequestId = 1;
  private generation = 0;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private lifetimeTimer: ReturnType<typeof setTimeout> | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: BinanceStreamHubOptions = {}) {
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.maxSymbols = options.maxSymbols ?? positiveInteger(process.env.BINANCE_STREAM_MAX_SYMBOLS, 30);
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.inactivityTimeoutMs = options.inactivityTimeoutMs ?? 90_000;
    this.connectionLifetimeMs = options.connectionLifetimeMs ?? 86_100_000;
  }

  subscribeQuotes(symbols: string[], options: BinanceStreamOptions = {}): AsyncIterable<NormalizedQuote[]> {
    return this.subscribe<NormalizedQuote>("quote", symbols, options);
  }

  subscribeTrades(symbols: string[], options: BinanceStreamOptions = {}): AsyncIterable<NormalizedTrade[]> {
    return this.subscribe<NormalizedTrade>("trade", symbols, options);
  }

  subscribeBars(symbols: string[], options: BinanceStreamOptions = {}): AsyncIterable<NormalizedBar[]> {
    return this.subscribe<NormalizedBar>("bar", symbols, options);
  }

  close(): void {
    for (const subscriber of this.subscribers.values()) {
      subscriber.closed = true;
      this.wake(subscriber);
    }
    this.subscribers.clear();
    this.stopSocket(1000, "hub closed");
  }

  private async *subscribe<T extends StreamRecord>(kind: BinanceStreamKind, symbols: string[], options: BinanceStreamOptions): AsyncIterable<T[]> {
    const products = [...new Set(symbols.map(normalizeBinanceProviderSymbol))];
    if (!products.length) return;
    if (products.some((symbol) => !isBinanceStreamSymbol(symbol))) throw new BinanceStreamError("invalid_symbol", "Mindestens ein Binance-Produkt ist ungueltig.");
    const desiredProducts = new Set([...this.desiredProducts(), ...products]);
    if (desiredProducts.size > this.maxSymbols) throw new BinanceStreamError("capacity", `Der geteilte Binance-Stream ist auf ${this.maxSymbols} Produkte begrenzt.`);

    const subscriber: Subscriber = {
      id: this.nextSubscriberId++,
      kind,
      products: new Set(products),
      originalByProduct: new Map(products.map((product) => [product, options.resolveSymbol?.(product) ?? product])),
      quality: options.quality ?? "near_realtime",
      interval: options.interval ?? "1m",
      queue: [],
      maxQueuedBatches: Math.max(1, options.maxQueuedBatches ?? 32),
      error: null,
      closed: false,
      wake: null,
    };
    this.subscribers.set(subscriber.id, subscriber);
    const abort = () => this.removeSubscriber(subscriber.id);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (!this.socket) this.connect();
    else this.scheduleReconcile();

    try {
      while (!subscriber.closed && !options.signal?.aborted) {
        if (subscriber.error) throw subscriber.error;
        const batch = subscriber.queue.shift();
        if (batch) {
          yield batch as T[];
          continue;
        }
        await new Promise<void>((resolve) => { subscriber.wake = resolve; });
      }
      if (subscriber.error) throw subscriber.error;
    } finally {
      options.signal?.removeEventListener("abort", abort);
      this.removeSubscriber(subscriber.id);
    }
  }

  private desiredProducts(): Set<string> {
    return new Set([...this.subscribers.values()].flatMap((subscriber) => [...subscriber.products]));
  }

  private desiredStreams(): Set<string> {
    const streams = new Set<string>();
    for (const subscriber of this.subscribers.values()) {
      for (const product of subscriber.products) {
        for (const suffix of streamSuffix(subscriber)) streams.add(`${product.toLowerCase()}@${suffix}`);
      }
    }
    return streams;
  }

  private connect(): void {
    if (this.socket || this.subscribers.size === 0) return;
    const generation = ++this.generation;
    let socket: BinanceSocketLike;
    try {
      socket = this.socketFactory(BINANCE_MARKET_STREAM_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.socketOpen = false;
    this.activeStreams.clear();
    this.lastTradeId.clear();
    this.lastBookUpdateId.clear();

    socket.addEventListener("open", () => {
      if (generation !== this.generation) return;
      this.socketOpen = true;
      this.reconcileSubscriptions();
      this.resetWatchdog();
      this.lifetimeTimer = setTimeout(() => this.restartSocket(1000, "planned rotation"), this.connectionLifetimeMs);
    });
    socket.addEventListener("message", (event) => {
      if (generation !== this.generation) return;
      this.resetWatchdog();
      this.handleMessage(parseMessage(event.data));
    });
    socket.addEventListener("error", () => {
      if (generation === this.generation) this.restartSocket(1011, "provider error");
    });
    socket.addEventListener("close", () => {
      if (generation !== this.generation) return;
      this.socket = null;
      this.socketOpen = false;
      this.activeStreams.clear();
      this.clearConnectionTimers();
      this.scheduleReconnect();
    });
  }

  private handleMessage(input: unknown): void {
    if (!input || typeof input !== "object") return;
    const record = input as Record<string, unknown>;
    if (record.e === "serverShutdown" || typeof record.code === "number") {
      this.restartSocket(1012, "provider protocol");
      return;
    }

    const ticker = parseBinanceTicker(input);
    if (ticker) {
      const product = normalizeBinanceProviderSymbol(ticker.s);
      this.latestTicker.set(product, ticker);
      this.emitQuotes(product);
      return;
    }
    const book = parseBinanceBookTicker(input);
    if (book) {
      const product = normalizeBinanceProviderSymbol(book.s);
      const previous = this.lastBookUpdateId.get(product);
      if (previous !== undefined && book.u <= previous) return;
      this.lastBookUpdateId.set(product, book.u);
      this.latestBook.set(product, book);
      this.emitQuotes(product);
      return;
    }
    if (record.e === "trade") {
      const product = normalizeBinanceProviderSymbol(String(record.s ?? ""));
      const tradeId = typeof record.t === "number" ? record.t : null;
      const previous = this.lastTradeId.get(product);
      if (tradeId !== null && previous !== undefined && tradeId <= previous) return;
      if (tradeId !== null && previous !== undefined && tradeId !== previous + 1) {
        this.restartSocket(1012, "trade sequence gap");
        return;
      }
      if (tradeId !== null) this.lastTradeId.set(product, tradeId);
      this.emitNormalized("trade", product, (subscriber) => normalizeBinanceTrade(input, this.normalizationOptions(subscriber)));
      return;
    }
    if (record.e === "kline") {
      const product = normalizeBinanceProviderSymbol(String(record.s ?? ""));
      this.emitNormalized("bar", product, (subscriber) => normalizeBinanceKline(input, this.normalizationOptions(subscriber)));
    }
  }

  private emitQuotes(product: string): void {
    const ticker = this.latestTicker.get(product);
    if (!ticker) return;
    const book = this.latestBook.get(product) ?? null;
    this.emitNormalized("quote", product, (subscriber) => normalizeBinanceQuote(ticker, book, this.normalizationOptions(subscriber)));
  }

  private emitNormalized(kind: BinanceStreamKind, product: string, normalize: (subscriber: Subscriber) => StreamRecord | null): void {
    this.reconnectAttempt = 0;
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.kind !== kind || !subscriber.products.has(product)) continue;
      const value = normalize(subscriber);
      if (!value) continue;
      if (subscriber.queue.length >= subscriber.maxQueuedBatches) {
        subscriber.error = new BinanceStreamError("slow_consumer", "Binance-Stream wurde fuer diesen Client wegen Rueckstau beendet.");
        subscriber.closed = true;
      } else subscriber.queue.push([value]);
      this.wake(subscriber);
    }
  }

  private normalizationOptions(subscriber: Subscriber): BinanceStreamOptions & { receivedAt: Date } {
    return {
      quality: subscriber.quality,
      receivedAt: new Date(),
      resolveSymbol: (providerSymbol) => subscriber.originalByProduct.get(providerSymbol) ?? providerSymbol,
    };
  }

  private scheduleReconcile(): void {
    if (!this.socketOpen || this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      this.reconcileSubscriptions();
    }, 500);
  }

  private reconcileSubscriptions(): void {
    if (!this.socketOpen) return;
    const desired = this.desiredStreams();
    const added = [...desired].filter((stream) => !this.activeStreams.has(stream));
    const removed = [...this.activeStreams].filter((stream) => !desired.has(stream));
    if (added.length) this.sendControl("SUBSCRIBE", added);
    if (removed.length) this.sendControl("UNSUBSCRIBE", removed);
    this.activeStreams = desired;
    if (!desired.size) this.stopSocket(1000, "no subscribers");
  }

  private sendControl(method: "SUBSCRIBE" | "UNSUBSCRIBE", params: string[]): void {
    try {
      this.socket?.send(JSON.stringify({ method, params, id: this.nextRequestId++ }));
    } catch {
      this.restartSocket(1011, "send failed");
    }
  }

  private resetWatchdog(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => this.restartSocket(1013, "stream inactive"), this.inactivityTimeoutMs);
  }

  private clearConnectionTimers(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    if (this.lifetimeTimer) clearTimeout(this.lifetimeTimer);
    this.watchdogTimer = null;
    this.lifetimeTimer = null;
  }

  private restartSocket(code: number, reason: string): void {
    const socket = this.socket;
    this.socket = null;
    this.socketOpen = false;
    this.activeStreams.clear();
    this.clearConnectionTimers();
    this.generation += 1;
    try { socket?.close(code, reason); } catch { /* lokaler Zustand ist bereits geschlossen */ }
    this.scheduleReconnect();
  }

  private stopSocket(code: number, reason: string): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconcileTimer) clearTimeout(this.reconcileTimer);
    this.reconnectTimer = null;
    this.reconcileTimer = null;
    this.restartSocket(code, reason);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.socket || this.subscribers.size === 0) return;
    const delay = Math.min(this.reconnectBaseMs * 2 ** Math.min(this.reconnectAttempt, 5), 15_000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private removeSubscriber(id: number): void {
    const subscriber = this.subscribers.get(id);
    if (!subscriber) return;
    subscriber.closed = true;
    this.subscribers.delete(id);
    this.wake(subscriber);
    if (this.subscribers.size === 0) this.stopSocket(1000, "no subscribers");
    else this.scheduleReconcile();
  }

  private wake(subscriber: Subscriber): void {
    subscriber.wake?.();
    subscriber.wake = null;
  }
}

let sharedHub: BinanceStreamHub | null = null;
function getSharedHub(): BinanceStreamHub {
  sharedHub ??= new BinanceStreamHub();
  return sharedHub;
}

export function isBinanceStreamingEnabled(): boolean {
  return process.env.BINANCE_STREAM_ENABLED !== "false";
}

export function getBinanceStreamSymbolLimit(): number {
  return positiveInteger(process.env.BINANCE_STREAM_MAX_SYMBOLS, 30);
}

export function streamBinanceQuotes(symbols: string[], options: BinanceStreamOptions = {}): AsyncIterable<NormalizedQuote[]> {
  return getSharedHub().subscribeQuotes(symbols, options);
}

export function streamBinanceTrades(symbols: string[], options: BinanceStreamOptions = {}): AsyncIterable<NormalizedTrade[]> {
  return getSharedHub().subscribeTrades(symbols, options);
}

export function streamBinanceBars(symbols: string[], options: BinanceStreamOptions = {}): AsyncIterable<NormalizedBar[]> {
  return getSharedHub().subscribeBars(symbols, options);
}
