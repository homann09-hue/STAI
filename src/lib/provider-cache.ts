import { getServerCacheAdapter } from "@/lib/server-cache";
import { logEvent } from "@/lib/observability";

type ProviderCacheEntry<T> = {
  value: T;
  storedAt: string;
  ttlMs: number;
};

const providerCache = getServerCacheAdapter();
const inFlightProviderLoads = new Map<string, Promise<unknown>>();

export async function withCacheFallback<T>(
  key: string,
  loader: () => Promise<T>,
  options: { allowEmpty?: boolean; staleTtlMs?: number; ttlMs?: number } = {},
) {
  const ttlMs = options.ttlMs ?? 30000;
  const staleTtlMs = Math.max(ttlMs, options.staleTtlMs ?? Math.max(ttlMs * 12, 300000));
  const cacheKey = `provider:${key}`;

  try {
    const cached = await providerCache.get<ProviderCacheEntry<T>>(cacheKey);
    if (cached && Date.now() - new Date(cached.storedAt).getTime() < cached.ttlMs) {
      return {
        value: cached.value,
        fromCache: true,
        cacheStoredAt: cached.storedAt,
        warning: "Antwort stammt aus TTL-Cache.",
      };
    }

    const existingLoad = inFlightProviderLoads.get(cacheKey) as Promise<T> | undefined;
    const value = existingLoad ? await existingLoad : await loadOnce(cacheKey, loader);
    const empty = value === null || (Array.isArray(value) && value.length === 0);

    if (!empty || options.allowEmpty) {
      await providerCache.set<ProviderCacheEntry<T>>(
        cacheKey,
        { value, storedAt: new Date().toISOString(), ttlMs },
        staleTtlMs,
      );
    }

    return {
      value,
      fromCache: false,
      cacheStoredAt: null,
      warning: null,
    };
  } catch (error) {
    const cached = await providerCache.get<ProviderCacheEntry<T>>(cacheKey);

    if (cached) {
      logEvent("warn", "provider.cache_fallback", {
        key,
        cacheMode: providerCache.mode,
        cacheStoredAt: cached.storedAt,
        error
      });

      return {
        value: cached.value,
        fromCache: true,
        cacheStoredAt: cached.storedAt,
        warning: "Provider nicht erreichbar. Antwort stammt aus Server-Cache.",
      };
    }

    logEvent("error", "provider.unavailable_without_cache", {
      key,
      cacheMode: providerCache.mode,
      error
    });

    throw new Error("Provider unavailable and no cache fallback exists");
  }
}

export function clearProviderCache() {
  void providerCache.clear();
  inFlightProviderLoads.clear();
}

async function loadOnce<T>(cacheKey: string, loader: () => Promise<T>) {
  const request = loader().finally(() => {
    inFlightProviderLoads.delete(cacheKey);
  });
  inFlightProviderLoads.set(cacheKey, request);
  return request;
}
