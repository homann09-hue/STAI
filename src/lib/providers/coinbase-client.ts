import "server-only";

import {
  isCoinbaseStreamProductSupported,
  normalizeCoinbaseProductId,
  normalizeCoinbaseTickerMessage,
} from "@/lib/providers/coinbase-normalization";
import type { MarketDataQuality, NormalizedQuote } from "@/lib/types";

const COINBASE_MARKET_DATA_URL = "wss://advanced-trade-ws.coinbase.com";

type SocketEvent = { data?: unknown };
type SocketListener = (event: SocketEvent) => void;

export interface CoinbaseSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: SocketListener,
  ): void;
}

export type CoinbaseSocketFactory = (url: string) => CoinbaseSocketLike;

export type CoinbaseStreamErrorCode =
  | "invalid_symbol"
  | "symbol_limit"
  | "capacity"
  | "slow_consumer"
  | "provider_protocol";

export class CoinbaseStreamError extends Error {
  constructor(
    readonly code: CoinbaseStreamErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CoinbaseStreamError";
  }
}

interface Subscriber {
  id: number;
  products: Set<string>;
  originalByProduct: Map<string, string>;
  queue: NormalizedQuote[][];
  maxQueuedBatches: number;
  error: CoinbaseStreamError | null;
  closed: boolean;
  wake: (() => void) | null;
}

export interface CoinbaseStreamOptions {
  signal?: AbortSignal;
  quality?: MarketDataQuality;
  resolveSymbol?: (providerSymbol: string) => string;
  maxQueuedBatches?: number;
}

export interface CoinbaseStreamHubOptions {
  socketFactory?: CoinbaseSocketFactory;
  maxSymbols?: number;
  reconnectBaseMs?: number;
  heartbeatTimeoutMs?: number;
  connectTimeoutMs?: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultSocketFactory(url: string): CoinbaseSocketLike {
  if (typeof WebSocket === "undefined") {
    throw new CoinbaseStreamError(
      "provider_protocol",
      "WebSocket ist in dieser Server-Laufzeit nicht verfügbar.",
    );
  }
  return new WebSocket(url) as unknown as CoinbaseSocketLike;
}

function parseMessage(data: unknown): unknown {
  if (typeof data !== "string" || data.length > 262_144) return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

function isProviderError(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  return record.channel === "error" || record.type === "error";
}

export class CoinbaseStreamHub {
  private readonly socketFactory: CoinbaseSocketFactory;
  private readonly maxSymbols: number;
  private readonly reconnectBaseMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly subscribers = new Map<number, Subscriber>();
  private socket: CoinbaseSocketLike | null = null;
  private socketOpen = false;
  private activeProducts = new Set<string>();
  private nextSubscriberId = 1;
  private generation = 0;
  private reconnectAttempt = 0;
  private lastTickerSequence: number | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private reconcileTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: CoinbaseStreamHubOptions = {}) {
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.maxSymbols =
      options.maxSymbols ??
      positiveInteger(process.env.COINBASE_STREAM_MAX_SYMBOLS, 30);
    this.reconnectBaseMs = options.reconnectBaseMs ?? 500;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 4_500;
  }

  async *subscribe(
    symbols: string[],
    options: CoinbaseStreamOptions = {},
  ): AsyncIterable<NormalizedQuote[]> {
    const products = [
      ...new Set(symbols.map(normalizeCoinbaseProductId)),
    ];
    if (!products.length) return;
    if (products.some((symbol) => !isCoinbaseStreamProductSupported(symbol))) {
      throw new CoinbaseStreamError(
        "invalid_symbol",
        "Mindestens ein Coinbase-Produkt ist nicht eindeutig streambar.",
      );
    }

    const desired = new Set([...this.desiredProducts(), ...products]);
    if (desired.size > this.maxSymbols) {
      throw new CoinbaseStreamError(
        "capacity",
        `Der geteilte Coinbase-Stream ist auf ${this.maxSymbols} Produkte begrenzt.`,
      );
    }

    const originalByProduct = new Map(
      products.map((product) => [
        product,
        normalizeCoinbaseProductId(options.resolveSymbol?.(product) ?? product),
      ]),
    );
    const subscriber: Subscriber = {
      id: this.nextSubscriberId++,
      products: new Set(products),
      originalByProduct,
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
          yield batch;
          continue;
        }
        await new Promise<void>((resolve) => {
          subscriber.wake = resolve;
        });
      }
      if (subscriber.error) throw subscriber.error;
    } finally {
      options.signal?.removeEventListener("abort", abort);
      this.removeSubscriber(subscriber.id);
    }
  }

  close(): void {
    for (const subscriber of this.subscribers.values()) {
      subscriber.closed = true;
      this.wake(subscriber);
    }
    this.subscribers.clear();
    this.stopSocket(1000, "hub closed");
  }

  private desiredProducts(): Set<string> {
    return new Set(
      [...this.subscribers.values()].flatMap((subscriber) => [
        ...subscriber.products,
      ]),
    );
  }

  private connect(): void {
    if (this.socket || this.subscribers.size === 0) return;
    const generation = ++this.generation;
    let socket: CoinbaseSocketLike;
    try {
      socket = this.socketFactory(COINBASE_MARKET_DATA_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.socketOpen = false;
    this.activeProducts.clear();
    this.lastTickerSequence = null;

    const connectTimer = setTimeout(() => {
      if (generation === this.generation && !this.socketOpen) {
        this.restartSocket(1013, "connect timeout");
      }
    }, this.connectTimeoutMs);

    socket.addEventListener("open", () => {
      if (generation !== this.generation) return;
      clearTimeout(connectTimer);
      this.socketOpen = true;
      this.send({ type: "subscribe", channel: "heartbeats" });
      this.reconcileSubscriptions();
      this.resetWatchdog();
    });
    socket.addEventListener("message", (event) => {
      if (generation !== this.generation) return;
      this.resetWatchdog();
      this.handleMessage(parseMessage(event.data));
    });
    socket.addEventListener("error", () => {
      if (generation === this.generation) {
        this.restartSocket(1011, "provider error");
      }
    });
    socket.addEventListener("close", () => {
      clearTimeout(connectTimer);
      if (generation !== this.generation) return;
      this.socket = null;
      this.socketOpen = false;
      this.activeProducts.clear();
      this.clearWatchdog();
      this.scheduleReconnect();
    });
  }

  private handleMessage(input: unknown): void {
    if (!input || isProviderError(input)) {
      if (isProviderError(input)) this.restartSocket(1011, "provider protocol");
      return;
    }
    const probe = normalizeCoinbaseTickerMessage(input, {
      receivedAt: new Date(),
    });
    if (!probe) return;
    if (
      this.lastTickerSequence !== null &&
      probe.sequenceNumber <= this.lastTickerSequence
    ) {
      return;
    }
    if (
      this.lastTickerSequence !== null &&
      probe.sequenceNumber !== this.lastTickerSequence + 1
    ) {
      this.restartSocket(1012, "sequence gap");
      return;
    }
    this.lastTickerSequence = probe.sequenceNumber;
    this.reconnectAttempt = 0;

    for (const subscriber of this.subscribers.values()) {
      const batch = normalizeCoinbaseTickerMessage(input, {
        receivedAt: new Date(),
        resolveSymbol: (product) =>
          subscriber.originalByProduct.get(product) ?? product,
      });
      const quotes = (batch?.quotes ?? []).filter((quote) =>
        subscriber.products.has(quote.providerSymbol),
      );
      if (!quotes.length) continue;
      if (subscriber.queue.length >= subscriber.maxQueuedBatches) {
        subscriber.error = new CoinbaseStreamError(
          "slow_consumer",
          "Coinbase-Stream wurde für diesen Client wegen Rückstau beendet.",
        );
        subscriber.closed = true;
      } else {
        subscriber.queue.push(quotes);
      }
      this.wake(subscriber);
    }
  }

  private scheduleReconcile(): void {
    if (!this.socketOpen || this.reconcileTimer) return;
    this.reconcileTimer = setTimeout(() => {
      this.reconcileTimer = null;
      this.reconcileSubscriptions();
    }, 150);
  }

  private reconcileSubscriptions(): void {
    if (!this.socketOpen) return;
    const desired = this.desiredProducts();
    const added = [...desired].filter(
      (product) => !this.activeProducts.has(product),
    );
    const removed = [...this.activeProducts].filter(
      (product) => !desired.has(product),
    );
    if (added.length) {
      this.send({ type: "subscribe", product_ids: added, channel: "ticker" });
    }
    if (removed.length) {
      this.send({
        type: "unsubscribe",
        product_ids: removed,
        channel: "ticker",
      });
    }
    this.activeProducts = desired;
    if (!desired.size) this.stopSocket(1000, "no subscribers");
  }

  private send(message: Record<string, unknown>): void {
    try {
      this.socket?.send(JSON.stringify(message));
    } catch {
      this.restartSocket(1011, "send failed");
    }
  }

  private resetWatchdog(): void {
    this.clearWatchdog();
    this.watchdogTimer = setTimeout(() => {
      this.restartSocket(1013, "heartbeat timeout");
    }, this.heartbeatTimeoutMs);
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = null;
  }

  private restartSocket(code: number, reason: string): void {
    const socket = this.socket;
    this.socket = null;
    this.socketOpen = false;
    this.activeProducts.clear();
    this.lastTickerSequence = null;
    this.clearWatchdog();
    this.generation += 1;
    try {
      socket?.close(code, reason);
    } catch {
      // Der lokale Zustand ist bereits geschlossen.
    }
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
    const delay = Math.min(
      this.reconnectBaseMs * 2 ** Math.min(this.reconnectAttempt, 5),
      15_000,
    );
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

let sharedHub: CoinbaseStreamHub | null = null;

function getSharedHub(): CoinbaseStreamHub {
  sharedHub ??= new CoinbaseStreamHub();
  return sharedHub;
}

export function isCoinbaseStreamingEnabled(): boolean {
  return process.env.COINBASE_STREAM_ENABLED !== "false";
}

export function getCoinbaseStreamSymbolLimit(): number {
  return positiveInteger(process.env.COINBASE_STREAM_MAX_SYMBOLS, 30);
}

export function streamCoinbaseQuotes(
  symbols: string[],
  options: CoinbaseStreamOptions = {},
): AsyncIterable<NormalizedQuote[]> {
  return getSharedHub().subscribe(symbols, options);
}
