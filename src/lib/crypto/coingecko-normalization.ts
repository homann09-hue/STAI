export type CryptoPairIdentity = { rawSymbol: string; baseSymbol: string; quoteSymbol: string | null };

export type CoinGeckoSearchCandidate = {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | null;
};

export type CoinGeckoIdentityResolution =
  | { status: "resolved"; pair: CryptoPairIdentity; coinId: string; method: "verified_mapping" | "unique_search"; candidate: CoinGeckoSearchCandidate | null }
  | { status: "ambiguous"; pair: CryptoPairIdentity; candidates: CoinGeckoSearchCandidate[] }
  | { status: "not_found"; pair: CryptoPairIdentity };

export type CryptoReferenceMetadata = {
  coinId: string;
  symbol: string;
  name: string;
  pair: CryptoPairIdentity;
  mappingMethod: "verified_mapping" | "unique_search";
  marketCapRank: number | null;
  categories: string[];
  blockchainAddresses: Array<{ network: string; address: string }>;
  market: {
    currency: "USD";
    price: number | null;
    marketCap: number | null;
    volume24h: number | null;
    circulatingSupply: number | null;
    totalSupply: number | null;
    maxSupply: number | null;
    fullyDilutedValuation: number | null;
    lastUpdated: string | null;
  };
  exchanges: Array<{ id: string; name: string; base: string; target: string; last: number | null; volume: number | null; tradeUrl: string | null }>;
  provider: "CoinGecko";
  fetchedAt: string;
  latencyMs: number;
};

export type CryptoGlobalReference = {
  activeCryptocurrencies: number | null;
  markets: number | null;
  totalMarketCapUsd: number | null;
  totalVolumeUsd: number | null;
  marketCapPercentages: Array<{ symbol: string; percentage: number }>;
  exchanges: Array<{ id: string; name: string; country: string | null; yearEstablished: number | null; trustScore: number | null; trustScoreRank: number | null; tradeVolume24hBtc: number | null }>;
  provider: "CoinGecko";
  providerUpdatedAt: string | null;
  fetchedAt: string;
  latencyMs: number;
};

const COMMON_QUOTES = ["USDT", "USDC", "BUSD", "USD", "EUR", "GBP", "BTC", "ETH"] as const;
const VERIFIED_IDS: Readonly<Record<string, string>> = {
  ADA: "cardano", AVAX: "avalanche-2", BCH: "bitcoin-cash", BNB: "binancecoin",
  BTC: "bitcoin", DOGE: "dogecoin", DOT: "polkadot", ETH: "ethereum",
  LINK: "chainlink", LTC: "litecoin", SOL: "solana", USDC: "usd-coin",
  USDT: "tether", XRP: "ripple",
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function integer(value: unknown) {
  const parsed = finite(value);
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
}

function safeHttpUrl(value: unknown) {
  const candidate = text(value, 1000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeCryptoPair(input: string): CryptoPairIdentity | null {
  const rawSymbol = input.trim().toUpperCase();
  if (!rawSymbol || rawSymbol.length > 32 || !/^[A-Z0-9./:_-]+$/.test(rawSymbol)) return null;
  const separated = rawSymbol.split(/[./:_-]+/).filter(Boolean);
  if (separated.length > 2 || separated.some((part) => !/^[A-Z0-9]{1,16}$/.test(part))) return null;
  if (separated.length === 2) return { rawSymbol, baseSymbol: separated[0], quoteSymbol: separated[1] };
  const compact = separated[0];
  const quoteSymbol = COMMON_QUOTES.find((quote) => compact.length > quote.length + 1 && compact.endsWith(quote));
  return quoteSymbol
    ? { rawSymbol, baseSymbol: compact.slice(0, -quoteSymbol.length), quoteSymbol }
    : { rawSymbol, baseSymbol: compact, quoteSymbol: null };
}

export function normalizeCoinGeckoSearch(value: unknown): CoinGeckoSearchCandidate[] {
  const coins = Array.isArray(record(value)?.coins) ? record(value)!.coins as unknown[] : [];
  const seen = new Set<string>();
  return coins.flatMap((entry) => {
    const item = record(entry);
    const id = text(item?.id, 120);
    const symbol = text(item?.symbol, 24)?.toUpperCase();
    const name = text(item?.name, 160);
    if (!id || !symbol || !name || seen.has(id)) return [];
    seen.add(id);
    return [{ id, symbol, name, marketCapRank: integer(item?.market_cap_rank) }];
  }).slice(0, 50);
}

export function resolveCoinGeckoIdentity(pair: CryptoPairIdentity, candidates: readonly CoinGeckoSearchCandidate[]): CoinGeckoIdentityResolution {
  const verifiedId = VERIFIED_IDS[pair.baseSymbol];
  if (verifiedId) return { status: "resolved", pair, coinId: verifiedId, method: "verified_mapping", candidate: candidates.find((candidate) => candidate.id === verifiedId) ?? null };
  const exact = candidates.filter((candidate) => candidate.symbol === pair.baseSymbol);
  if (exact.length === 1) return { status: "resolved", pair, coinId: exact[0].id, method: "unique_search", candidate: exact[0] };
  if (exact.length > 1) return { status: "ambiguous", pair, candidates: exact.slice(0, 10) };
  return { status: "not_found", pair };
}

export function normalizeCoinGeckoMetadata(input: { payload: unknown; pair: CryptoPairIdentity; mappingMethod: "verified_mapping" | "unique_search"; fetchedAt: string; latencyMs: number }): CryptoReferenceMetadata {
  const root = record(input.payload);
  const id = text(root?.id, 120);
  const symbol = text(root?.symbol, 24)?.toUpperCase();
  const name = text(root?.name, 160);
  if (!root || !id || !symbol || !name) throw new Error("CoinGecko-Metadaten sind unvollständig.");
  const platforms = record(root.platforms) ?? {};
  const blockchainAddresses = Object.entries(platforms).flatMap(([network, address]) => {
    const normalizedAddress = text(address, 240);
    return normalizedAddress ? [{ network: network.slice(0, 80), address: normalizedAddress }] : [];
  }).slice(0, 30);
  const marketData = record(root.market_data) ?? {};
  const usd = (field: string) => finite(record(marketData[field])?.usd);
  const tickers = Array.isArray(root.tickers) ? root.tickers : [];
  const seenMarkets = new Set<string>();
  const exchanges = tickers.flatMap((entry) => {
    const ticker = record(entry);
    const market = record(ticker?.market);
    const exchangeId = text(market?.identifier, 100);
    const exchangeName = text(market?.name, 120);
    const base = text(ticker?.base, 24)?.toUpperCase();
    const target = text(ticker?.target, 24)?.toUpperCase();
    if (!exchangeId || !exchangeName || !base || !target) return [];
    const key = `${exchangeId}:${base}:${target}`;
    if (seenMarkets.has(key)) return [];
    seenMarkets.add(key);
    return [{ id: exchangeId, name: exchangeName, base, target, last: finite(ticker?.last), volume: finite(ticker?.volume), tradeUrl: safeHttpUrl(ticker?.trade_url) }];
  }).slice(0, 30);
  return {
    coinId: id,
    symbol,
    name,
    pair: input.pair,
    mappingMethod: input.mappingMethod,
    marketCapRank: integer(root.market_cap_rank),
    categories: (Array.isArray(root.categories) ? root.categories : []).flatMap((category) => text(category, 100) ?? []).slice(0, 30),
    blockchainAddresses,
    market: {
      currency: "USD",
      price: usd("current_price"),
      marketCap: usd("market_cap"),
      volume24h: usd("total_volume"),
      circulatingSupply: finite(marketData.circulating_supply),
      totalSupply: finite(marketData.total_supply),
      maxSupply: finite(marketData.max_supply),
      fullyDilutedValuation: usd("fully_diluted_valuation"),
      lastUpdated: text(root.last_updated, 64),
    },
    exchanges,
    provider: "CoinGecko",
    fetchedAt: input.fetchedAt,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
  };
}

export function normalizeCoinGeckoGlobal(input: { globalPayload: unknown; exchangesPayload: unknown; fetchedAt: string; latencyMs: number }): CryptoGlobalReference {
  const data = record(record(input.globalPayload)?.data);
  if (!data) throw new Error("CoinGecko-Gesamtmarktdaten sind unvollständig.");
  const percentages = record(data.market_cap_percentage) ?? {};
  const exchanges = Array.isArray(input.exchangesPayload) ? input.exchangesPayload : [];
  const providerUpdatedSeconds = finite(data.updated_at);
  return {
    activeCryptocurrencies: integer(data.active_cryptocurrencies),
    markets: integer(data.markets),
    totalMarketCapUsd: finite(record(data.total_market_cap)?.usd),
    totalVolumeUsd: finite(record(data.total_volume)?.usd),
    marketCapPercentages: Object.entries(percentages).flatMap(([symbol, value]) => {
      const percentage = finite(value);
      return percentage === null ? [] : [{ symbol: symbol.toUpperCase().slice(0, 24), percentage }];
    }).sort((left, right) => right.percentage - left.percentage).slice(0, 20),
    exchanges: exchanges.flatMap((entry) => {
      const item = record(entry);
      const id = text(item?.id, 100);
      const exchangeName = text(item?.name, 120);
      return id && exchangeName ? [{ id, name: exchangeName, country: text(item?.country, 100), yearEstablished: integer(item?.year_established), trustScore: finite(item?.trust_score), trustScoreRank: integer(item?.trust_score_rank), tradeVolume24hBtc: finite(item?.trade_volume_24h_btc) }] : [];
    }).slice(0, 25),
    provider: "CoinGecko",
    providerUpdatedAt: providerUpdatedSeconds === null ? null : new Date(providerUpdatedSeconds * 1000).toISOString(),
    fetchedAt: input.fetchedAt,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
  };
}
