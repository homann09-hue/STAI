import { describe, expect, it } from "vitest";
import { normalizeCoinGeckoGlobal, normalizeCoinGeckoMetadata, normalizeCoinGeckoSearch, normalizeCryptoPair, resolveCoinGeckoIdentity } from "@/lib/crypto/coingecko-normalization";

describe("CoinGecko normalization", () => {
  it.each([["BTC-USD", "BTC", "USD"], ["eth/usd", "ETH", "USD"], ["SOLUSDT", "SOL", "USDT"], ["ADA", "ADA", null]])("normalisiert %s", (raw, base, quote) => {
    expect(normalizeCryptoPair(raw)).toMatchObject({ baseSymbol: base, quoteSymbol: quote });
  });
  it("weist unsichere Eingaben ab", () => {
    expect(normalizeCryptoPair("<script>")).toBeNull();
    expect(normalizeCryptoPair("BTC-USD-EUR")).toBeNull();
  });
  it("nutzt nur explizite kanonische Mappings", () => {
    expect(resolveCoinGeckoIdentity(normalizeCryptoPair("BTC-USD")!, [])).toMatchObject({ status: "resolved", coinId: "bitcoin", method: "verified_mapping" });
  });
  it("löst unbekannte Symbole nur bei genau einem exakten Treffer auf", () => {
    expect(resolveCoinGeckoIdentity(normalizeCryptoPair("ZZZ-USD")!, [{ id: "zzz-token", symbol: "ZZZ", name: "ZZZ", marketCapRank: 10 }])).toMatchObject({ status: "resolved", coinId: "zzz-token", method: "unique_search" });
  });
  it("wählt bei Mehrdeutigkeit keinen Treffer", () => {
    expect(resolveCoinGeckoIdentity(normalizeCryptoPair("PAY-USD")!, [{ id: "pay-a", symbol: "PAY", name: "Pay A", marketCapRank: 1 }, { id: "pay-b", symbol: "PAY", name: "Pay B", marketCapRank: 2 }])).toMatchObject({ status: "ambiguous", candidates: [{ id: "pay-a" }, { id: "pay-b" }] });
  });
  it("filtert unvollständige Suchtreffer", () => {
    expect(normalizeCoinGeckoSearch({ coins: [{ id: "bitcoin", symbol: "btc", name: "Bitcoin", market_cap_rank: 1 }, { id: "broken", symbol: "", name: "Broken" }] })).toEqual([{ id: "bitcoin", symbol: "BTC", name: "Bitcoin", marketCapRank: 1 }]);
  });
  it("normalisiert Markt-, Supply-, Adress- und Börsenfelder", () => {
    const result = normalizeCoinGeckoMetadata({ pair: normalizeCryptoPair("BTC-USD")!, mappingMethod: "verified_mapping", fetchedAt: "2026-08-17T10:00:00.000Z", latencyMs: 42.4, payload: { id: "bitcoin", symbol: "btc", name: "Bitcoin", market_cap_rank: 1, categories: ["Layer 1"], platforms: { ethereum: "0xabc", native: "" }, last_updated: "2026-08-17T09:59:00.000Z", market_data: { current_price: { usd: 100 }, market_cap: { usd: 2_000 }, total_volume: { usd: 300 }, fully_diluted_valuation: { usd: 2_100 }, circulating_supply: 19, total_supply: 20, max_supply: 21 }, tickers: [{ market: { identifier: "exchange", name: "Exchange" }, base: "BTC", target: "USD", last: 100, volume: 12, trade_url: "https://exchange.test/btc" }] } });
    expect(result).toMatchObject({ coinId: "bitcoin", marketCapRank: 1, blockchainAddresses: [{ network: "ethereum", address: "0xabc" }], market: { marketCap: 2_000, circulatingSupply: 19, maxSupply: 21 }, exchanges: [{ id: "exchange", base: "BTC", target: "USD" }], latencyMs: 42 });
  });
  it("behält fehlende optionale Zahlen als null", () => {
    const result = normalizeCoinGeckoMetadata({ pair: normalizeCryptoPair("ETH-USD")!, mappingMethod: "verified_mapping", fetchedAt: "2026-08-17T10:00:00.000Z", latencyMs: 0, payload: { id: "ethereum", symbol: "eth", name: "Ethereum", market_data: {} } });
    expect(result.market.maxSupply).toBeNull();
    expect(result.market.marketCap).toBeNull();
  });
  it("normalisiert globale Marktbreite und Börsenvertrauen", () => {
    const result = normalizeCoinGeckoGlobal({ fetchedAt: "2026-08-17T10:00:00.000Z", latencyMs: 20, globalPayload: { data: { active_cryptocurrencies: 10_000, markets: 900, total_market_cap: { usd: 5_000 }, total_volume: { usd: 200 }, market_cap_percentage: { btc: 55, eth: 12 }, updated_at: 1_786_963_200 } }, exchangesPayload: [{ id: "exchange", name: "Exchange", country: "DE", year_established: 2020, trust_score: 9, trust_score_rank: 2, trade_volume_24h_btc: 10 }] });
    expect(result).toMatchObject({ activeCryptocurrencies: 10_000, totalMarketCapUsd: 5_000 });
    expect(result.marketCapPercentages[0]).toEqual({ symbol: "BTC", percentage: 55 });
    expect(result.exchanges[0]).toMatchObject({ id: "exchange", trustScore: 9 });
  });
  it("verwirft strukturell ungültige Antworten", () => {
    expect(() => normalizeCoinGeckoMetadata({ payload: {}, pair: normalizeCryptoPair("BTC")!, mappingMethod: "verified_mapping", fetchedAt: "x", latencyMs: 0 })).toThrow("unvollständig");
    expect(() => normalizeCoinGeckoGlobal({ globalPayload: {}, exchangesPayload: [], fetchedAt: "x", latencyMs: 0 })).toThrow("unvollständig");
  });
});
