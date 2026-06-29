import { assessDataQuality } from "@/lib/data-quality";
import { getMockAsset, getMockDashboard } from "@/lib/mock/market";
import type {
  Asset,
  AssetDetail,
  AssetSummary,
  Candle,
  DashboardData,
  MarketDataQuality,
  MarketStatus,
  NormalizedQuote,
  Quote
} from "@/lib/types";

export type MarketProviderId =
  | "mock"
  | "finnhub"
  | "twelve_data"
  | "eodhd"
  | "massive"
  | "polygon"
  | "alpha_vantage"
  | "databento";

export type StreamMode = "provider_websocket" | "rest_polling" | "mock_stream";

export interface MarketStreamOptions {
  signal?: AbortSignal;
  intervalMs?: number;
}

export interface RealtimeProvider {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;
  streamQuotes(symbols: string[], options?: MarketStreamOptions): AsyncIterable<NormalizedQuote[]>;
}

export interface NearRealtimeProvider {
  getQuote(symbol: string): Promise<NormalizedQuote | null>;
  getQuotes(symbols: string[]): Promise<NormalizedQuote[]>;
}

export interface DelayedProvider {
  getDelayedQuote(symbol: string): Promise<NormalizedQuote | null>;
}

export interface HistoricalProvider {
  getCandles(symbol: string, interval: "1m" | "5m" | "15m" | "1h" | "1d"): Promise<Candle[]>;
}

export interface MarketDataProvider extends RealtimeProvider, NearRealtimeProvider, DelayedProvider, HistoricalProvider {
  getDashboard(): Promise<DashboardData>;
  getAsset(symbol: string): Promise<AssetDetail | null>;
}

type QuoteProvider = NearRealtimeProvider & {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;
  streamQuotes?: (symbols: string[], options?: MarketStreamOptions) => AsyncIterable<NormalizedQuote[]>;
};

class ProviderConfigurationError extends Error {}

const DEFAULT_STREAM_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 40;

function nowIso() {
  return new Date().toISOString();
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function calculateChange(price: number, previousClose?: number, explicitChange?: number) {
  if (explicitChange !== undefined) return explicitChange;
  if (!previousClose) return 0;
  return Number((price - previousClose).toFixed(4));
}

function calculateChangePercent(price: number, previousClose?: number, explicitPercent?: number) {
  if (explicitPercent !== undefined) return explicitPercent;
  if (!previousClose) return 0;
  return Number((((price - previousClose) / previousClose) * 100).toFixed(4));
}

function normalizeMarketStatus(value: unknown): MarketStatus {
  const status = String(value ?? "unknown").toLowerCase();

  if (status.includes("pre")) return "pre_market";
  if (status.includes("after") || status.includes("post") || status.includes("extended")) return "after_hours";
  if (status.includes("open")) return "open";
  if (status.includes("closed")) return "closed";
  return "unknown";
}

function inferAssetType(symbol: string, fallback?: Asset["type"]): Asset["type"] {
  if (fallback) return fallback;
  if (/^[A-Z]{6}$/.test(symbol) && symbol.endsWith("USD")) return "forex";
  if (symbol.includes("-USD") || symbol.includes("/USD")) return "crypto";
  if (symbol.startsWith("^") || symbol.startsWith("I:")) return "index";
  return "stock";
}

function symbolForProvider(symbol: string, provider: MarketProviderId) {
  const normalized = decodeURIComponent(symbol).toUpperCase();

  if (provider === "finnhub" && normalized.endsWith("-USD")) {
    return `BINANCE:${normalized.replace("-USD", "USDT")}`;
  }

  if (provider === "twelve_data" && normalized.endsWith("-USD")) {
    return normalized.replace("-USD", "/USD");
  }

  return normalized;
}

function envQuality(name: string, fallback: MarketDataQuality) {
  const value = process.env[name] as MarketDataQuality | undefined;
  const allowed: MarketDataQuality[] = ["realtime", "near_realtime", "delayed", "historical", "mock", "unavailable"];
  return value && allowed.includes(value) ? value : fallback;
}

async function fetchJson<T>(url: URL, providerName: string, timeoutMs = 4500): Promise<{ data: T; latencyMs: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "StockPilotAI/0.1 market-data-layer"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${providerName} HTTP ${response.status}`);
    }

    return {
      data: (await response.json()) as T,
      latencyMs: Date.now() - started
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toNormalizedQuote(input: {
  symbol: string;
  name?: string;
  assetType?: Asset["type"];
  price: number;
  currency?: string;
  change?: number;
  changePercent?: number;
  bid?: number;
  ask?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  timestamp?: string;
  provider: string;
  quality: MarketDataQuality;
  latencyMs?: number;
  marketStatus?: MarketStatus;
}): NormalizedQuote {
  const previousClose = input.previousClose;
  const change = calculateChange(input.price, previousClose, input.change);
  const changePercent = calculateChangePercent(input.price, previousClose, input.changePercent);

  return {
    symbol: input.symbol.toUpperCase(),
    name: input.name,
    assetType: inferAssetType(input.symbol, input.assetType),
    price: Number(input.price.toFixed(6)),
    currency: input.currency ?? "USD",
    change: Number(change.toFixed(6)),
    changePercent: Number(changePercent.toFixed(4)),
    bid: input.bid,
    ask: input.ask,
    spread:
      input.bid !== undefined && input.ask !== undefined
        ? Number(Math.max(0, input.ask - input.bid).toFixed(6))
        : undefined,
    volume: input.volume,
    high: input.high,
    low: input.low,
    open: input.open,
    previousClose,
    fiftyTwoWeekHigh: input.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: input.fiftyTwoWeekLow,
    timestamp: input.timestamp ?? nowIso(),
    provider: input.provider,
    quality: input.quality,
    latencyMs: input.latencyMs,
    marketStatus: input.marketStatus ?? "unknown"
  };
}

function normalizedFromDetail(detail: AssetDetail | AssetSummary): NormalizedQuote {
  return toNormalizedQuote({
    symbol: detail.asset.symbol,
    name: detail.asset.name,
    assetType: detail.asset.type,
    price: detail.quote.price,
    currency: detail.asset.currency,
    change: detail.quote.change,
    changePercent: detail.quote.changePercent,
    bid: detail.quote.bid,
    ask: detail.quote.ask,
    volume: detail.quote.volume,
    high: detail.quote.dayHigh,
    low: detail.quote.dayLow,
    open: detail.quote.open,
    previousClose: detail.quote.previousClose,
    fiftyTwoWeekHigh: detail.quote.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: detail.quote.fiftyTwoWeekLow,
    timestamp: detail.quote.asOf,
    provider: detail.quote.provider,
    quality: detail.quote.quality,
    latencyMs: detail.quote.latencyMs,
    marketStatus: detail.quote.marketStatus
  });
}

function quoteFromNormalized(base: Quote, normalized: NormalizedQuote): Quote {
  return {
    ...base,
    price: normalized.price,
    change: normalized.change,
    changePercent: normalized.changePercent,
    dayHigh: normalized.high ?? base.dayHigh,
    dayLow: normalized.low ?? base.dayLow,
    volume: normalized.volume ?? base.volume,
    delayedByMinutes: normalized.quality === "delayed" ? Math.max(base.delayedByMinutes, 15) : 0,
    asOf: normalized.timestamp,
    bid: normalized.bid,
    ask: normalized.ask,
    spread: normalized.spread,
    open: normalized.open ?? base.open,
    previousClose: normalized.previousClose ?? base.previousClose,
    fiftyTwoWeekHigh: normalized.fiftyTwoWeekHigh ?? base.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: normalized.fiftyTwoWeekLow ?? base.fiftyTwoWeekLow,
    provider: normalized.provider,
    quality: normalized.quality,
    latencyMs: normalized.latencyMs,
    marketStatus: normalized.marketStatus
  };
}

function enrichAssetWithQuote(detail: AssetDetail, normalized: NormalizedQuote): AssetDetail {
  const quote = quoteFromNormalized(detail.quote, normalized);
  const merged = { ...detail, quote };
  const dataQuality = assessDataQuality(merged);

  return {
    ...merged,
    dataQuality
  };
}

function enrichSummaryWithQuote(summary: AssetSummary, normalized: NormalizedQuote): AssetSummary {
  return {
    ...summary,
    quote: quoteFromNormalized(summary.quote, normalized)
  };
}

function uniqueSymbols(symbols: string[]) {
  return [...new Set(symbols.map((symbol) => decodeURIComponent(symbol).trim().toUpperCase()).filter(Boolean))].slice(0, MAX_BATCH_SIZE);
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}

async function* pollQuotes(provider: NearRealtimeProvider, symbols: string[], options?: MarketStreamOptions) {
  const intervalMs = Math.max(1500, options?.intervalMs ?? DEFAULT_STREAM_INTERVAL_MS);

  while (!options?.signal?.aborted) {
    const quotes = await provider.getQuotes(symbols);
    if (quotes.length) yield quotes;
    await sleep(intervalMs, options?.signal);
  }
}

class MockMarketDataProvider implements MarketDataProvider {
  readonly providerName = "StockPilot Mock Market Feed";
  readonly providerId = "mock" as const;
  readonly quality = "mock" as const;
  readonly streamMode = "mock_stream" as const;

  async getDashboard() {
    return getMockDashboard();
  }

  async getAsset(symbol: string) {
    return getMockAsset(symbol);
  }

  async getQuote(symbol: string) {
    const detail = getMockAsset(symbol);
    return detail ? normalizedFromDetail(detail) : null;
  }

  async getQuotes(symbols: string[]) {
    return uniqueSymbols(symbols)
      .map((symbol) => getMockAsset(symbol))
      .filter((detail): detail is AssetDetail => Boolean(detail))
      .map((detail) => normalizedFromDetail(detail));
  }

  async getDelayedQuote(symbol: string) {
    return this.getQuote(symbol);
  }

  async getCandles(symbol: string) {
    return getMockAsset(symbol)?.candles["1D"] ?? [];
  }

  streamQuotes(symbols: string[], options?: MarketStreamOptions) {
    return pollQuotes(this, symbols, options);
  }
}

abstract class HttpQuoteProvider implements QuoteProvider {
  abstract readonly providerName: string;
  abstract readonly providerId: MarketProviderId;
  abstract readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode = "rest_polling";

  abstract getQuote(symbol: string): Promise<NormalizedQuote | null>;

  async getQuotes(symbols: string[]) {
    const settled = await Promise.allSettled(uniqueSymbols(symbols).map((symbol) => this.getQuote(symbol)));
    return settled
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((quote): quote is NormalizedQuote => Boolean(quote));
  }
}

async function* streamFinnhubWebSocket(
  provider: FinnhubQuoteProvider,
  symbols: string[],
  options?: MarketStreamOptions
): AsyncIterable<NormalizedQuote[]> {
  const token = process.env.FINNHUB_API_KEY;

  if (!token || typeof WebSocket === "undefined") {
    yield* pollQuotes(provider, symbols, options);
    return;
  }

  const normalizedSymbols = uniqueSymbols(symbols);
  const socket = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);
  const queue: NormalizedQuote[][] = [];
  let done = false;
  let wake: (() => void) | null = null;
  const wakeReader = () => {
    wake?.();
    wake = null;
  };

  options?.signal?.addEventListener(
    "abort",
    () => {
      done = true;
      socket.close();
      wakeReader();
    },
    { once: true }
  );

  socket.addEventListener("open", () => {
    for (const symbol of normalizedSymbols) {
      socket.send(JSON.stringify({ type: "subscribe", symbol: symbolForProvider(symbol, "finnhub") }));
    }
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string;
        data?: Array<{ s?: string; p?: number; v?: number; t?: number }>;
      };

      if (payload.type !== "trade" || !payload.data?.length) return;

      const quotes = payload.data
        .map((trade) => {
          const providerSymbol = String(trade.s ?? "");
          const symbol =
            normalizedSymbols.find((item) => symbolForProvider(item, "finnhub") === providerSymbol) ??
            providerSymbol.replace(/^BINANCE:/, "").replace("USDT", "-USD");
          const price = parseNumber(trade.p);
          if (!price) return null;

          return toNormalizedQuote({
            symbol,
            price,
            volume: parseNumber(trade.v),
            timestamp: trade.t ? new Date(trade.t).toISOString() : nowIso(),
            provider: "Finnhub WebSocket",
            quality: "realtime",
            latencyMs: trade.t ? Math.max(0, Date.now() - trade.t) : undefined,
            marketStatus: "unknown"
          });
        })
        .filter((quote): quote is NormalizedQuote => Boolean(quote));

      if (quotes.length) {
        queue.push(quotes);
        wakeReader();
      }
    } catch {
      queue.push([]);
      wakeReader();
    }
  });

  socket.addEventListener("error", () => {
    done = true;
    wakeReader();
  });

  socket.addEventListener("close", () => {
    done = true;
    wakeReader();
  });

  try {
    while (!done && !options?.signal?.aborted) {
      const next = queue.shift();
      if (next) {
        if (next.length) yield next;
        continue;
      }

      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  } finally {
    socket.close();
  }
}

class FinnhubQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Finnhub";
  readonly providerId = "finnhub" as const;
  readonly quality = envQuality("FINNHUB_DATA_QUALITY", "near_realtime");
  readonly streamMode: StreamMode = process.env.FINNHUB_STREAM_ENABLED === "true" ? "provider_websocket" : "rest_polling";

  async getQuote(symbol: string) {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) throw new ProviderConfigurationError("FINNHUB_API_KEY fehlt");

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", providerSymbol);
    url.searchParams.set("token", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const price = parseNumber(data.c);
    if (!price) return null;

    const previousClose = parseNumber(data.pc);

    return toNormalizedQuote({
      symbol,
      price,
      previousClose,
      change: parseNumber(data.d),
      changePercent: parseNumber(data.dp),
      high: parseNumber(data.h),
      low: parseNumber(data.l),
      open: parseNumber(data.o),
      timestamp: parseNumber(data.t) ? new Date(Number(data.t) * 1000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }

  streamQuotes(symbols: string[], options?: MarketStreamOptions) {
    if (this.streamMode !== "provider_websocket") return pollQuotes(this, symbols, options);
    return streamFinnhubWebSocket(this, symbols, options);
  }
}

class TwelveDataQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Twelve Data";
  readonly providerId = "twelve_data" as const;
  readonly quality = envQuality("TWELVE_DATA_QUALITY", "near_realtime");

  async getQuote(symbol: string) {
    const token = process.env.TWELVE_DATA_API_KEY;
    if (!token) throw new ProviderConfigurationError("TWELVE_DATA_API_KEY fehlt");

    const url = new URL("https://api.twelvedata.com/quote");
    url.searchParams.set("symbol", symbolForProvider(symbol, this.providerId));
    url.searchParams.set("apikey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const price = parseNumber(data.close ?? data.price);
    if (!price) return null;

    const timestamp = typeof data.datetime === "string" ? new Date(data.datetime).toISOString() : nowIso();

    return toNormalizedQuote({
      symbol,
      price,
      currency: typeof data.currency === "string" ? data.currency : "USD",
      change: parseNumber(data.change),
      changePercent: parseNumber(data.percent_change),
      volume: parseNumber(data.volume),
      high: parseNumber(data.high),
      low: parseNumber(data.low),
      open: parseNumber(data.open),
      previousClose: parseNumber(data.previous_close),
      timestamp,
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }
}

class EodhdQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "EODHD";
  readonly providerId = "eodhd" as const;
  readonly quality = envQuality("EODHD_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const token = process.env.EODHD_API_KEY;
    if (!token) throw new ProviderConfigurationError("EODHD_API_KEY fehlt");

    const providerSymbol = symbolForProvider(symbol, this.providerId);
    const url = new URL(`https://eodhd.com/api/real-time/${encodeURIComponent(providerSymbol)}`);
    url.searchParams.set("api_token", token);
    url.searchParams.set("fmt", "json");

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const price = parseNumber(data.close ?? data.price);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      price,
      change: parseNumber(data.change),
      changePercent: parseNumber(data.change_p ?? data.changePercent),
      volume: parseNumber(data.volume),
      high: parseNumber(data.high),
      low: parseNumber(data.low),
      open: parseNumber(data.open),
      previousClose: parseNumber(data.previousClose ?? data.previous_close),
      timestamp: parseNumber(data.timestamp) ? new Date(Number(data.timestamp) * 1000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: normalizeMarketStatus(data.marketStatus)
    });
  }
}

class MassiveSnapshotProvider extends HttpQuoteProvider {
  readonly providerName = "Polygon/Massive";
  readonly providerId = "massive" as const;
  readonly quality = envQuality("MASSIVE_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const token = process.env.MASSIVE_API_KEY ?? process.env.POLYGON_API_KEY;
    if (!token) throw new ProviderConfigurationError("MASSIVE_API_KEY oder POLYGON_API_KEY fehlt");

    const url = new URL(
      process.env.MASSIVE_SNAPSHOT_URL ??
        process.env.POLYGON_SNAPSHOT_URL ??
        "https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers"
    );
    url.searchParams.set("tickers", symbolForProvider(symbol, this.providerId));
    url.searchParams.set("apiKey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName);
    const tickers = Array.isArray(data.tickers) ? data.tickers : [];
    const item = (tickers[0] ?? data.ticker ?? data) as Record<string, unknown>;
    const day = (item.day ?? {}) as Record<string, unknown>;
    const prevDay = (item.prevDay ?? {}) as Record<string, unknown>;
    const lastTrade = (item.lastTrade ?? {}) as Record<string, unknown>;
    const lastQuote = (item.lastQuote ?? {}) as Record<string, unknown>;
    const price = parseNumber(lastTrade.p ?? item.fmv ?? day.c ?? item.price);

    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      price,
      change: parseNumber(item.todaysChange),
      changePercent: parseNumber(item.todaysChangePerc),
      bid: parseNumber(lastQuote.p ?? lastQuote.bp),
      ask: parseNumber(lastQuote.P ?? lastQuote.ap),
      volume: parseNumber(day.v),
      high: parseNumber(day.h),
      low: parseNumber(day.l),
      open: parseNumber(day.o),
      previousClose: parseNumber(prevDay.c),
      timestamp: parseNumber(item.updated ?? lastTrade.t) ? new Date(Number(item.updated ?? lastTrade.t) / 1000000).toISOString() : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }
}

class AlphaVantageQuoteProvider extends HttpQuoteProvider {
  readonly providerName = "Alpha Vantage Fallback";
  readonly providerId = "alpha_vantage" as const;
  readonly quality = envQuality("ALPHA_VANTAGE_DATA_QUALITY", "delayed");

  async getQuote(symbol: string) {
    const token = process.env.ALPHA_VANTAGE_API_KEY;
    if (!token) throw new ProviderConfigurationError("ALPHA_VANTAGE_API_KEY fehlt");

    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbolForProvider(symbol, this.providerId));
    url.searchParams.set("apikey", token);

    const { data, latencyMs } = await fetchJson<Record<string, unknown>>(url, this.providerName, 7000);
    const quote = (data["Global Quote"] ?? {}) as Record<string, unknown>;
    const price = parseNumber(quote["05. price"]);
    if (!price) return null;

    return toNormalizedQuote({
      symbol,
      price,
      change: parseNumber(quote["09. change"]),
      changePercent: parseNumber(String(quote["10. change percent"] ?? "").replace("%", "")),
      volume: parseNumber(quote["06. volume"]),
      high: parseNumber(quote["03. high"]),
      low: parseNumber(quote["04. low"]),
      open: parseNumber(quote["02. open"]),
      previousClose: parseNumber(quote["08. previous close"]),
      timestamp: typeof quote["07. latest trading day"] === "string" ? `${quote["07. latest trading day"]}T21:00:00.000Z` : nowIso(),
      provider: this.providerName,
      quality: this.quality,
      latencyMs,
      marketStatus: "unknown"
    });
  }
}

class ProviderBackedMarketDataProvider implements MarketDataProvider {
  readonly providerName: string;
  readonly providerId: MarketProviderId;
  readonly quality: MarketDataQuality;
  readonly streamMode: StreamMode;
  private readonly fallback = new MockMarketDataProvider();

  constructor(private readonly quoteProvider: QuoteProvider) {
    this.providerName = quoteProvider.providerName;
    this.providerId = quoteProvider.providerId;
    this.quality = quoteProvider.quality;
    this.streamMode = quoteProvider.streamMode;
  }

  async getDashboard() {
    const dashboard = await this.fallback.getDashboard();
    const symbols = uniqueSymbols([
      ...dashboard.watchlist.map((item) => item.asset.symbol),
      ...dashboard.gainers.map((item) => item.asset.symbol),
      ...dashboard.losers.map((item) => item.asset.symbol)
    ]);
    const quotes = await this.getQuotes(symbols);
    const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));
    const enrichList = (items: AssetSummary[]) =>
      items.map((item) => {
        const quote = quoteMap.get(item.asset.symbol);
        return quote ? enrichSummaryWithQuote(item, quote) : item;
      });
    const mockSources = quotes.filter((quote) => quote.quality === "mock").length;

    return {
      ...dashboard,
      watchlist: enrichList(dashboard.watchlist),
      gainers: enrichList(dashboard.gainers),
      losers: enrichList(dashboard.losers),
      mostActive: enrichList(dashboard.mostActive),
      trendingAssets: enrichList(dashboard.trendingAssets),
      dataQualitySummary: {
        ...dashboard.dataQualitySummary,
        label: mockSources === quotes.length ? "Mock-Fallback aktiv" : `${this.providerName} + Fallback`,
        mockSources
      }
    };
  }

  async getAsset(symbol: string) {
    const detail = await this.fallback.getAsset(symbol);
    if (!detail) return null;

    const quote = await this.getQuote(symbol);
    return quote ? enrichAssetWithQuote(detail, quote) : detail;
  }

  async getQuote(symbol: string) {
    try {
      const quote = await this.quoteProvider.getQuote(symbol);
      if (quote) return quote;
    } catch (error) {
      if (!(error instanceof ProviderConfigurationError)) {
        console.error("market-provider quote failed", { provider: this.providerName, symbol, error });
      }
    }

    return this.fallback.getQuote(symbol);
  }

  async getQuotes(symbols: string[]) {
    const requested = uniqueSymbols(symbols);
    let realQuotes: NormalizedQuote[] = [];

    try {
      realQuotes = await this.quoteProvider.getQuotes(requested);
    } catch (error) {
      if (!(error instanceof ProviderConfigurationError)) {
        console.error("market-provider batch failed", { provider: this.providerName, error });
      }
    }

    const realMap = new Map(realQuotes.map((quote) => [quote.symbol, quote]));
    const missing = requested.filter((symbol) => !realMap.has(symbol));
    const fallbackQuotes = missing.length ? await this.fallback.getQuotes(missing) : [];

    return [...realQuotes, ...fallbackQuotes].sort((a, b) => requested.indexOf(a.symbol) - requested.indexOf(b.symbol));
  }

  async getDelayedQuote(symbol: string) {
    return this.getQuote(symbol);
  }

  async getCandles(symbol: string, interval: "1m" | "5m" | "15m" | "1h" | "1d") {
    const detail = await this.fallback.getAsset(symbol);
    if (!detail) return [];
    if (interval === "1d") return detail.candles["1Y"];
    return detail.candles["1D"];
  }

  streamQuotes(symbols: string[], options?: MarketStreamOptions) {
    if (this.quoteProvider.streamMode === "provider_websocket" && this.quoteProvider.streamQuotes) {
      return this.quoteProvider.streamQuotes(symbols, options);
    }

    return pollQuotes(this, symbols, options);
  }
}

function selectedProviderId(): MarketProviderId {
  const provider = (process.env.STOCKPILOT_MARKET_PROVIDER ?? process.env.STOCKPILOT_QUOTE_PROVIDER ?? "mock").toLowerCase();

  if (provider === "polygon") return "polygon";
  if (provider === "twelvedata") return "twelve_data";
  if (
    provider === "mock" ||
    provider === "finnhub" ||
    provider === "twelve_data" ||
    provider === "eodhd" ||
    provider === "massive" ||
    provider === "alpha_vantage" ||
    provider === "databento"
  ) {
    return provider;
  }

  return "mock";
}

export function getMarketDataProvider(): MarketDataProvider {
  const provider = selectedProviderId();

  switch (provider) {
    case "finnhub":
      return new ProviderBackedMarketDataProvider(new FinnhubQuoteProvider());
    case "twelve_data":
      return new ProviderBackedMarketDataProvider(new TwelveDataQuoteProvider());
    case "eodhd":
      return new ProviderBackedMarketDataProvider(new EodhdQuoteProvider());
    case "massive":
    case "polygon":
      return new ProviderBackedMarketDataProvider(new MassiveSnapshotProvider());
    case "alpha_vantage":
      return new ProviderBackedMarketDataProvider(new AlphaVantageQuoteProvider());
    case "databento":
      return new MockMarketDataProvider();
    case "mock":
    default:
      return new MockMarketDataProvider();
  }
}
