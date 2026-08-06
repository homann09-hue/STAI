import type { MarketDataQuality, MarketUniverseAssetClass, MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";
import { enrichInstrumentSearchResults, resolveInstrumentUniverse } from "@/lib/instrument-master";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { getServerCacheAdapter } from "@/lib/server-cache";

const now = () => new Date().toISOString();
const universeCache = getServerCacheAdapter();

export const marketUniverseCoverage: MarketUniverseCoverage[] = [
  {
    label: "US Aktien & ETFs",
    assetClasses: ["stock", "etf"],
    exchanges: ["NYSE", "NASDAQ", "NYSE Arca", "Cboe"],
    providerCandidates: ["Polygon/Massive", "Finnhub", "Twelve Data", "Databento", "EODHD"],
    status: "license_required",
    note: "Breite US-Abdeckung und echte Realtime-Daten sind boersen- und planabhängig."
  },
  {
    label: "Europa / Xetra / London / Euronext",
    assetClasses: ["stock", "etf", "index"],
    exchanges: ["XETRA", "Frankfurt", "London", "Euronext", "SIX"],
    providerCandidates: ["EODHD", "Twelve Data", "Databento", "Polygon/Massive"],
    status: "license_required",
    note: "Realtime für europaeische Handelsplaetze benoetigt passende Exchange-Lizenzen."
  },
  {
    label: "Krypto Spot",
    assetClasses: ["crypto"],
    exchanges: ["Binance", "Coinbase", "Kraken", "Crypto.com"],
    providerCandidates: ["Binance", "Coinbase", "CCXT-kompatible Provider"],
    status: "connected",
    note: "BTC/USD und ETH/USD sind über freie Krypto-Provider vorbereitet. Aktualität, Limits und Verfügbarkeit werden erst beim Quote-Abruf bestätigt."
  },
  {
    label: "Indizes, Rohstoffe, Forex",
    assetClasses: ["index", "commodity", "forex", "future"],
    exchanges: ["CME", "ICE", "Cboe", "OTC FX", "Index Vendors"],
    providerCandidates: ["Databento", "Twelve Data", "EODHD", "Polygon/Massive"],
    status: "prepared",
    note: "Index-, Futures- und Rohstoffdaten sind lizenzsensibel und werden nicht als live gefaked."
  },
  {
    label: "Derivate",
    assetClasses: ["option", "warrant", "future"],
    exchanges: ["OPRA", "Eurex", "CME", "ICE"],
    providerCandidates: ["Databento", "Polygon/Massive", "Eurex/OPRA-lizenzierte Feeds"],
    status: "license_required",
    note: "Optionen/Futures brauchen professionelle Datenpakete, Symbologie und sehr klare Risiko-Hinweise."
  }
];

function selectedMarketProvider() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" &&
    process.env.STOCKPILOT_ALLOW_PROVIDER_DURING_BUILD !== "true"
  ) {
    return "mock";
  }

  const configured = (
    process.env.MARKET_DATA_PROVIDER ??
    process.env.STOCKPILOT_MARKET_PROVIDER ??
    process.env.STOCKPILOT_QUOTE_PROVIDER
  )
    ?.trim()
    .toLowerCase();

  if (configured && configured !== "auto") return configured;
  if (process.env.FMP_API_KEY) return "fmp";
  if (process.env.FINNHUB_API_KEY) return "finnhub";
  if (process.env.TWELVE_DATA_API_KEY) return "twelve_data";
  if (process.env.EODHD_API_KEY) return "eodhd";
  if (process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY) return "massive";
  if (process.env.ALPHA_VANTAGE_API_KEY) return "alpha_vantage";
  return "mock";
}

function fmpBaseUrl() {
  return (process.env.FMP_API_BASE_URL ?? "https://financialmodelingprep.com/stable")
    .trim()
    .replace(/\/$/, "");
}

function selectedCryptoProvider() {
  return (process.env.STOCKPILOT_CRYPTO_PROVIDER ?? "binance").trim().toLowerCase();
}

function configuredProviderQuality(assetClass: MarketUniverseAssetClass, coverage: MarketUniverseInstrument["coverage"]): MarketDataQuality {
  if (coverage !== "available") return "unavailable" as const;

  if (assetClass === "crypto") {
    const cryptoProvider = selectedCryptoProvider();
    if (cryptoProvider === "none" || cryptoProvider === "off") return "unavailable" as const;
    return "delayed" as const;
  }

  const provider = selectedMarketProvider();
  const configured =
    (provider === "finnhub" && Boolean(process.env.FINNHUB_API_KEY)) ||
    ((provider === "twelve_data" || provider === "twelvedata") && Boolean(process.env.TWELVE_DATA_API_KEY)) ||
    (provider === "eodhd" && Boolean(process.env.EODHD_API_KEY)) ||
    ((provider === "massive" || provider === "polygon") && Boolean(process.env.MASSIVE_API_KEY ?? process.env.POLYGON_API_KEY)) ||
    (provider === "alpha_vantage" && Boolean(process.env.ALPHA_VANTAGE_API_KEY));

  return configured ? "near_realtime" : "unavailable";
}

const universeSeeds: MarketUniverseInstrument[] = [
  ["AAPL", "Apple Inc.", "stock", "NASDAQ", "USA", "USD", "Finnhub/Polygon prepared", "license_required"],
  ["MSFT", "Microsoft Corp.", "stock", "NASDAQ", "USA", "USD", "Finnhub/Polygon prepared", "license_required"],
  ["NVDA", "NVIDIA Corp.", "stock", "NASDAQ", "USA", "USD", "Finnhub/Polygon prepared", "license_required"],
  ["TSLA", "Tesla Inc.", "stock", "NASDAQ", "USA", "USD", "Finnhub/Polygon prepared", "license_required"],
  ["AMZN", "Amazon.com Inc.", "stock", "NASDAQ", "USA", "USD", "Finnhub/Polygon prepared", "license_required"],
  ["VOO", "Vanguard S&P 500 ETF", "etf", "NYSE Arca", "USA", "USD", "ETF Provider prepared", "prepared"],
  ["IVV", "iShares Core S&P 500 ETF", "etf", "NYSE Arca", "USA", "USD", "ETF Provider prepared", "prepared"],
  ["SPY", "SPDR S&P 500 ETF Trust", "etf", "NYSE Arca", "USA", "USD", "ETF Provider prepared", "prepared"],
  ["DAX", "DAX Index", "index", "XETRA", "Deutschland", "EUR", "Index Provider required", "license_required"],
  ["SDAX", "SDAX Index", "index", "XETRA", "Deutschland", "EUR", "Index Provider required", "license_required"],
  ["SPX", "S&P 500 Index", "index", "Cboe", "USA", "USD", "Index Provider required", "license_required"],
  ["NDX", "NASDAQ 100 Index", "index", "NASDAQ", "USA", "USD", "Index Provider required", "license_required"],
  ["BTC-USD", "Bitcoin", "crypto", "Crypto", "Global", "USD", "Binance/Coinbase", "available"],
  ["ETH-USD", "Ethereum", "crypto", "Crypto", "Global", "USD", "Binance/Coinbase", "available"],
  ["EURUSD", "Euro / US Dollar", "forex", "OTC FX", "Global", "USD", "FX Provider prepared", "prepared"],
  ["XAUUSD", "Gold Spot", "commodity", "OTC Metals", "Global", "USD", "Commodity Provider prepared", "prepared"],
  ["CL", "WTI Crude Oil Futures", "future", "NYMEX", "USA", "USD", "Futures Provider required", "license_required"],
  ["ES", "E-mini S&P 500 Futures", "future", "CME", "USA", "USD", "Futures Provider required", "license_required"],
  ["AAPL240119C00190000", "Apple Call Option Beispiel", "option", "OPRA", "USA", "USD", "Options Provider required", "license_required"]
].map(([symbol, name, assetClass, exchange, country, currency, provider, coverage]) => {
  const typedAssetClass = assetClass as MarketUniverseAssetClass;
  const typedCoverage = coverage as MarketUniverseInstrument["coverage"];
  const quoteQuality = configuredProviderQuality(typedAssetClass, typedCoverage);

  return {
    symbol: String(symbol),
    name: String(name),
    assetClass: typedAssetClass,
    exchange: String(exchange),
    country: String(country),
    currency: String(currency),
    provider: String(provider),
    quality: quoteQuality,
    quoteQuality,
    coverage: typedCoverage,
    subscribable: quoteQuality === "realtime" || quoteQuality === "near_realtime",
    lastUpdatedAt: now(),
    note:
      quoteQuality === "near_realtime"
        ? "Anbieterstruktur aktiv. Realtime/Near-Realtime haengt vom konkreten Feed ab."
        : typedAssetClass === "crypto" && quoteQuality === "delayed"
          ? "Krypto-Public-Provider vorbereitet. Echte Aktualität wird beim Quote-Abruf geprüft und nicht im Universum garantiert."
        : typedCoverage === "prepared"
          ? "Datenmodell vorbereitet, echter Anbieter noch nicht verbunden."
          : typedCoverage === "license_required"
            ? "Nicht als live anzeigen: Für diese Instrumente sind Anbieterplan und/oder Börsenlizenz erforderlich."
            : "Kein aktiver Provider konfiguriert; keine Live-Abdeckung wird behauptet."
  };
});

export interface UniverseSearchInput {
  query?: string;
  assetClass?: MarketUniverseAssetClass | "all";
  limit?: number;
}

export interface UniverseSearchResult {
  instruments: MarketUniverseInstrument[];
  coverage: MarketUniverseCoverage[];
  provider: string;
  updatedAt: string;
  disclaimer: string;
}

export interface UniverseProvider {
  readonly providerName: string;
  search(input?: UniverseSearchInput): Promise<UniverseSearchResult>;
}

type RawFmpSearchItem = {
  symbol?: string;
  name?: string;
  companyName?: string;
  exchange?: string;
  exchangeShortName?: string;
  stockExchange?: string;
  currency?: string;
  type?: string;
};

type RawFinnhubSearchResponse = {
  result?: Array<{
    symbol?: string;
    displaySymbol?: string;
    description?: string;
    type?: string;
  }>;
};

function normalizeSymbol(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[^A-Z0-9./:-]/g, "").slice(0, 32);
}

function normalizeText(value: unknown, fallback: string, maxLength = 120) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function inferAssetClassFromText(symbol: string, type?: string): MarketUniverseAssetClass {
  const normalizedType = String(type ?? "").toLowerCase();
  if (normalizedType.includes("etf") || normalizedType.includes("fund")) return "etf";
  if (normalizedType.includes("crypto") || symbol.includes("-USD") || symbol.includes("/USD")) return "crypto";
  if (normalizedType.includes("forex") || /^[A-Z]{6}$/.test(symbol)) return "forex";
  if (normalizedType.includes("index")) return "index";
  return "stock";
}

function quoteQualityForProvider(provider: string, assetClass: MarketUniverseAssetClass): MarketDataQuality {
  if (assetClass === "crypto") {
    const cryptoProvider = selectedCryptoProvider();
    return cryptoProvider === "none" || cryptoProvider === "off" ? "unavailable" : "near_realtime";
  }

  if (provider === "fmp") return "delayed";
  if (provider === "finnhub" || provider === "twelve_data") return "near_realtime";
  if (provider === "eodhd" || provider === "massive" || provider === "polygon" || provider === "alpha_vantage") return "delayed";
  return "unavailable";
}

function instrumentFromProvider(input: {
  symbol: string;
  name: string;
  assetClass: MarketUniverseAssetClass;
  exchange?: string;
  country?: string;
  currency?: string;
  provider: string;
  note?: string;
}): MarketUniverseInstrument | null {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) return null;
  const quoteQuality = quoteQualityForProvider(selectedMarketProvider(), input.assetClass);

  return {
    symbol,
    name: normalizeText(input.name, symbol),
    assetClass: input.assetClass,
    exchange: normalizeText(input.exchange, "Provider", 80),
    country: normalizeText(input.country, "nicht geliefert", 80),
    currency: normalizeText(input.currency, "USD", 8).toUpperCase(),
    provider: input.provider,
    quality: quoteQuality,
    quoteQuality,
    coverage: quoteQuality === "unavailable" ? "provider_missing" : "available",
    subscribable: quoteQuality === "realtime" || quoteQuality === "near_realtime",
    lastUpdatedAt: now(),
    note:
      input.note ??
      "Aus Provider-Suche normalisiert. Abdeckung, Verzögerung und Felder hängen vom Tarif und der Börsenlizenz ab."
  };
}

function searchPreparedUniverse(input: UniverseSearchInput = {}) {
  const query = input.query?.trim().toLowerCase() ?? "";
  const assetClass = input.assetClass ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 250);

  const matches = universeSeeds.filter((item) => {
      if (assetClass !== "all" && item.assetClass !== assetClass) return false;
      if (!query) return true;
      return `${item.symbol} ${item.name} ${item.exchange} ${item.country} ${item.assetClass}`.toLowerCase().includes(query);
    });

  return enrichInstrumentSearchResults(resolveInstrumentUniverse(matches, limit), input.query, limit);
}

function mergeUniverseResults(primary: MarketUniverseInstrument[], fallback: MarketUniverseInstrument[], limit: number, query?: string) {
  return enrichInstrumentSearchResults(resolveInstrumentUniverse([...primary, ...fallback], limit), query, limit);
}

class PreparedUniverseProvider implements UniverseProvider {
  readonly providerName = "StockPilot Prepared Universe";

  async search(input: UniverseSearchInput = {}): Promise<UniverseSearchResult> {
    return {
      instruments: searchPreparedUniverse(input),
      coverage: marketUniverseCoverage,
      provider: this.providerName,
      updatedAt: now(),
      disclaimer:
        "STAI kann ein globales Marktuniversum strukturieren. Echte Vollabdeckung und Realtime für alle Börsen erfordern Anbieterplaene und Börsenlizenzen."
    };
  }
}

class ProviderBackedUniverseProvider implements UniverseProvider {
  readonly providerName: string;

  constructor(private readonly fallback: UniverseProvider = new PreparedUniverseProvider()) {
    const provider = selectedMarketProvider();
    this.providerName =
      provider === "fmp"
        ? "Financial Modeling Prep + StockPilot Universe"
        : provider === "finnhub"
          ? "Finnhub + StockPilot Universe"
          : "StockPilot Provider Universe";
  }

  async search(input: UniverseSearchInput = {}): Promise<UniverseSearchResult> {
    const fallback = await this.fallback.search(input);
    const query = input.query?.trim() ?? "";
    const limit = Math.min(Math.max(input.limit ?? 80, 1), 250);
    const provider = selectedMarketProvider();

    if (query.length < 2) {
      return {
        ...fallback,
        provider: this.providerName,
        disclaimer:
          "Ohne Suchbegriff zeigt STAI eine kuratierte Startabdeckung. Gib mindestens zwei Zeichen ein, um den angebundenen Provider serverseitig zu durchsuchen."
      };
    }

    const cacheKey = `market-universe:${provider}:${input.assetClass ?? "all"}:${query.toLowerCase()}:${limit}`;
    const cached = await universeCache.get<MarketUniverseInstrument[]>(cacheKey);
    const providerInstruments = cached ?? (await this.searchProvider(provider, input));
    if (!cached) await universeCache.set(cacheKey, providerInstruments, 10 * 60 * 1000);

    return {
      ...fallback,
      instruments: mergeUniverseResults(providerInstruments, fallback.instruments, limit, query),
      provider: this.providerName,
      updatedAt: now(),
      disclaimer:
        "Provider-Suchergebnisse werden serverseitig normalisiert. Vollständigkeit, Realtime-Rechte und Feldabdeckung hängen vom Anbieterplan und Börsenlizenzen ab."
    };
  }

  private async searchProvider(provider: string, input: UniverseSearchInput) {
    if (provider === "fmp" && process.env.FMP_API_KEY) return this.searchFmp(input);
    if (provider === "finnhub" && process.env.FINNHUB_API_KEY) return this.searchFinnhub(input);
    return [];
  }

  private async searchFmp(input: UniverseSearchInput) {
    const token = process.env.FMP_API_KEY;
    if (!token) return [];
    const query = input.query?.trim() ?? "";
    const limit = Math.min(Math.max(input.limit ?? 80, 1), 250);
    const assetClass = input.assetClass ?? "all";
    const url = new URL(`${fmpBaseUrl()}/search-symbol`);
    url.searchParams.set("query", query);
    url.searchParams.set("limit", `${limit}`);
    url.searchParams.set("apikey", token);

    const { data } = await fetchBoundedProviderJson<RawFmpSearchItem[] | { data?: RawFmpSearchItem[] }>(
      url,
      "Financial Modeling Prep",
      { timeoutMs: 6000, maxBytes: 900_000 }
    );
    const rows = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];

    return rows
      .map((item) => {
        const symbol = normalizeSymbol(item.symbol);
        const inferred = inferAssetClassFromText(symbol, item.type);
        if (assetClass !== "all" && inferred !== assetClass) return null;
        return instrumentFromProvider({
          symbol,
          name: item.name ?? item.companyName ?? symbol,
          assetClass: inferred,
          exchange: item.exchangeShortName ?? item.exchange ?? item.stockExchange,
          currency: item.currency,
          provider: "Financial Modeling Prep",
          note: "Aus FMP-Symbolsuche. Kursqualität bleibt delayed/near-realtime entsprechend Tarif und Route."
        });
      })
      .filter((item): item is MarketUniverseInstrument => Boolean(item))
      .slice(0, limit);
  }

  private async searchFinnhub(input: UniverseSearchInput) {
    const token = process.env.FINNHUB_API_KEY;
    if (!token) return [];
    const query = input.query?.trim() ?? "";
    const limit = Math.min(Math.max(input.limit ?? 80, 1), 250);
    const assetClass = input.assetClass ?? "all";
    const url = new URL("https://finnhub.io/api/v1/search");
    url.searchParams.set("q", query);
    url.searchParams.set("token", token);

    const { data } = await fetchBoundedProviderJson<RawFinnhubSearchResponse>(
      url,
      "Finnhub",
      { timeoutMs: 6000, maxBytes: 900_000 }
    );
    const rows = Array.isArray(data.result) ? data.result : [];

    return rows
      .map((item) => {
        const symbol = normalizeSymbol(item.symbol ?? item.displaySymbol);
        const inferred = inferAssetClassFromText(symbol, item.type);
        if (assetClass !== "all" && inferred !== assetClass) return null;
        return instrumentFromProvider({
          symbol,
          name: item.description ?? symbol,
          assetClass: inferred,
          exchange: "Provider",
          provider: "Finnhub",
          note: "Aus Finnhub-Symbolsuche. Kursqualität und verfügbare Felder hängen vom Tarif ab."
        });
      })
      .filter((item): item is MarketUniverseInstrument => Boolean(item))
      .slice(0, limit);
  }
}

export function getMarketUniverseProvider(): UniverseProvider {
  return new ProviderBackedUniverseProvider();
}

export function getMarketUniverse(input: UniverseSearchInput = {}) {
  return searchPreparedUniverse(input);
}
