import type { MarketUniverseAssetClass, MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";

const now = () => new Date().toISOString();

export const marketUniverseCoverage: MarketUniverseCoverage[] = [
  {
    label: "US Aktien & ETFs",
    assetClasses: ["stock", "etf"],
    exchanges: ["NYSE", "NASDAQ", "NYSE Arca", "Cboe"],
    providerCandidates: ["Polygon/Massive", "Finnhub", "Twelve Data", "Databento", "EODHD"],
    status: "license_required",
    note: "Breite US-Abdeckung und echte Realtime-Daten sind boersen- und planabhaengig."
  },
  {
    label: "Europa / Xetra / London / Euronext",
    assetClasses: ["stock", "etf", "index"],
    exchanges: ["XETRA", "Frankfurt", "London", "Euronext", "SIX"],
    providerCandidates: ["EODHD", "Twelve Data", "Databento", "Polygon/Massive"],
    status: "license_required",
    note: "Realtime fuer europaeische Handelsplaetze benoetigt passende Exchange-Lizenzen."
  },
  {
    label: "Krypto Spot",
    assetClasses: ["crypto"],
    exchanges: ["Binance", "Coinbase", "Kraken", "Crypto.com"],
    providerCandidates: ["Binance", "Coinbase", "CCXT-kompatible Provider"],
    status: "connected",
    note: "BTC/USD und ETH/USD sind bereits near-realtime ueber freie Krypto-Provider vorbereitet."
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
].map(([symbol, name, assetClass, exchange, country, currency, provider, coverage]) => ({
  symbol: String(symbol),
  name: String(name),
  assetClass: assetClass as MarketUniverseAssetClass,
  exchange: String(exchange),
  country: String(country),
  currency: String(currency),
  provider: String(provider),
  quality: coverage === "available" ? "near_realtime" : coverage === "prepared" ? "unavailable" : "unavailable",
  coverage: coverage as MarketUniverseInstrument["coverage"],
  lastUpdatedAt: now(),
  note:
    coverage === "available"
      ? "Anbieterstruktur aktiv. Realtime/Near-Realtime haengt vom konkreten Feed ab."
      : coverage === "prepared"
        ? "Datenmodell vorbereitet, echter Anbieter noch nicht verbunden."
        : "Nicht als live anzeigen: Fuer diese Instrumente sind Anbieterplan und/oder Boersenlizenz erforderlich."
}));

export function getMarketUniverse(input: {
  query?: string;
  assetClass?: MarketUniverseAssetClass | "all";
  limit?: number;
} = {}) {
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
