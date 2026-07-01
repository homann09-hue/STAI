import type { MarketDataQuality, MarketUniverseAssetClass, MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";

const now = () => new Date().toISOString();

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
    note: "BTC/USD und ETH/USD sind bereits near-realtime über freie Krypto-Provider vorbereitet."
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
  return (
    process.env.MARKET_DATA_PROVIDER ??
    process.env.STOCKPILOT_MARKET_PROVIDER ??
    process.env.STOCKPILOT_QUOTE_PROVIDER ??
    "mock"
  )
    .trim()
    .toLowerCase();
}

function selectedCryptoProvider() {
  return (process.env.STOCKPILOT_CRYPTO_PROVIDER ?? "binance").trim().toLowerCase();
}

function configuredProviderQuality(assetClass: MarketUniverseAssetClass, coverage: MarketUniverseInstrument["coverage"]): MarketDataQuality {
  if (coverage !== "available") return "unavailable" as const;

  if (assetClass === "crypto") {
    const cryptoProvider = selectedCryptoProvider();
    if (cryptoProvider === "none" || cryptoProvider === "off") return "unavailable" as const;
    return "near_realtime" as const;
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

function searchPreparedUniverse(input: UniverseSearchInput = {}) {
  const query = input.query?.trim().toLowerCase() ?? "";
  const assetClass = input.assetClass ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 80, 1), 250);

  return universeSeeds
    .filter((item) => {
      if (assetClass !== "all" && item.assetClass !== assetClass) return false;
      if (!query) return true;
      return `${item.symbol} ${item.name} ${item.exchange} ${item.country} ${item.assetClass}`.toLowerCase().includes(query);
    })
    .slice(0, limit);
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

export function getMarketUniverseProvider(): UniverseProvider {
  return new PreparedUniverseProvider();
}

export function getMarketUniverse(input: UniverseSearchInput = {}) {
  return searchPreparedUniverse(input);
}
