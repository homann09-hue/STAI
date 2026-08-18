import "server-only";

import { normalizeCoinGeckoGlobal, normalizeCoinGeckoMetadata, normalizeCoinGeckoSearch, normalizeCryptoPair, resolveCoinGeckoIdentity, type CoinGeckoIdentityResolution, type CryptoGlobalReference, type CryptoReferenceMetadata } from "@/lib/crypto/coingecko-normalization";
import { withCacheFallback } from "@/lib/provider-cache";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { resolveProviderRoute } from "@/lib/providers/provider-registry";

export type CoinGeckoMetadataLookup =
  | { status: "resolved"; data: CryptoReferenceMetadata }
  | Extract<CoinGeckoIdentityResolution, { status: "ambiguous" | "not_found" }>;

export type CoinGeckoCachedResult<T> = { value: T; quality: "delayed" | "cached"; fromCache: boolean; cacheStoredAt: string | null; warning: string | null };

function assertAvailable() {
  const route = resolveProviderRoute({ capability: "crypto_metadata", assetClass: "crypto", preferredProvider: "coingecko" });
  if (!route.providers.includes("coingecko")) throw new Error("CoinGecko ist für diese Umgebung nicht freigeschaltet.");
}

function connection() {
  const key = process.env.COINGECKO_API_KEY?.trim();
  const pro = process.env.COINGECKO_API_PLAN?.trim().toLowerCase() === "pro";
  return {
    baseUrl: pro && key ? "https://pro-api.coingecko.com/api/v3" : "https://api.coingecko.com/api/v3",
    requestHeaders: key ? { [pro ? "x-cg-pro-api-key" : "x-cg-demo-api-key"]: key } : undefined,
  };
}

async function request<T>(path: string, query: Record<string, string> = {}) {
  const config = connection();
  const url = new URL(`${config.baseUrl}${path}`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return fetchBoundedProviderJson<T>(url, "CoinGecko", { maxBytes: 2_500_000, requestHeaders: config.requestHeaders, timeoutMs: 8_000 });
}

async function loadMetadata(symbol: string): Promise<CoinGeckoMetadataLookup> {
  assertAvailable();
  const pair = normalizeCryptoPair(symbol);
  if (!pair) throw new Error("Ungültiges Krypto-Symbol.");
  let resolution = resolveCoinGeckoIdentity(pair, []);
  let searchLatency = 0;
  if (resolution.status !== "resolved") {
    const search = await request<unknown>("/search", { query: pair.baseSymbol });
    searchLatency = search.latencyMs;
    resolution = resolveCoinGeckoIdentity(pair, normalizeCoinGeckoSearch(search.data));
  }
  if (resolution.status !== "resolved") return resolution;
  const details = await request<unknown>(`/coins/${encodeURIComponent(resolution.coinId)}`, { localization: "false", tickers: "true", market_data: "true", community_data: "false", developer_data: "false", sparkline: "false" });
  return { status: "resolved", data: normalizeCoinGeckoMetadata({ payload: details.data, pair, mappingMethod: resolution.method, fetchedAt: new Date().toISOString(), latencyMs: searchLatency + details.latencyMs }) };
}

async function loadGlobal() {
  assertAvailable();
  const [global, exchanges] = await Promise.all([request<unknown>("/global"), request<unknown>("/exchanges", { per_page: "25", page: "1" })]);
  return normalizeCoinGeckoGlobal({ globalPayload: global.data, exchangesPayload: exchanges.data, fetchedAt: new Date().toISOString(), latencyMs: Math.max(global.latencyMs, exchanges.latencyMs) });
}

async function cached<T>(key: string, loader: () => Promise<T>): Promise<CoinGeckoCachedResult<T>> {
  const result = await withCacheFallback(key, loader, { policy: "instrument_metadata" });
  return { value: result.value, quality: result.fromCache ? "cached" : "delayed", fromCache: result.fromCache, cacheStoredAt: result.cacheStoredAt, warning: result.warning };
}

export function getCoinGeckoMetadata(symbol: string) {
  const pair = normalizeCryptoPair(symbol);
  if (!pair) return Promise.reject(new Error("Ungültiges Krypto-Symbol."));
  return cached(`coingecko:metadata:${pair.baseSymbol}`, () => loadMetadata(pair.rawSymbol));
}

export function getCoinGeckoGlobalReference() {
  return cached<CryptoGlobalReference>("coingecko:global", loadGlobal);
}
