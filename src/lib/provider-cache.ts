import { getServerCacheAdapter } from "@/lib/server-cache";
import { logEvent } from "@/lib/observability";
import {
  getProviderCachePolicy,
  type ProviderCacheKind,
} from "@/lib/resilience-policy";

type ProviderCacheEntry<T> = {
  value: T;
  storedAt: string;
  ttlMs: number;
};

const providerCache = getServerCacheAdapter();
const inFlightProviderLoads = new Map<string, Promise<unknown>>();

function cacheAgeMs(entry: ProviderCacheEntry<unknown>) {
  const storedAt = new Date(entry.storedAt).getTime();
  const ageMs = Number.isFinite(storedAt) ? Date.now() - storedAt : Number.POSITIVE_INFINITY;
  return Number.isFinite(ageMs) ? ageMs : Number.POSITIVE_INFINITY;
}

function isUsableCacheEntry<T>(entry: ProviderCacheEntry<T> | null, maxAgeMs: number) {
  if (!entry) return false;
  if (!Number.isFinite(entry.ttlMs) || entry.ttlMs <= 0) return false;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return false;
  const ageMs = cacheAgeMs(entry);
  return ageMs >= 0 && ageMs < maxAgeMs;
}

export async function withCacheFallback<T>(
  key: string,
  loader: () => Promise<T>,
  options: {
    allowEmpty?: boolean;
    policy?: ProviderCacheKind;
    staleTtlMs?: number;
    ttlMs?: number;
  } = {},
) {
  const policy = options.policy
    ? getProviderCachePolicy(options.policy)
    : null;
  const ttlMs = Math.max(
    1000,
    Math.min(30 * 86400000, options.ttlMs ?? policy?.ttlMs ?? 30000),
  );
  const staleTtlMs = Math.max(
    ttlMs,
    Math.min(
      30 * 86400000,
      options.staleTtlMs ??
        policy?.staleTtlMs ??
        Math.max(ttlMs * 12, 300000),
    ),
  );
  const allowEmpty = options.allowEmpty ?? policy?.allowEmpty ?? false;
  const distributedLockMs = policy?.distributedLockMs ?? 12_000;
  const cacheKey = `provider:${key}`;
  const lockKey = `${cacheKey}:load-lock`;
  const lockToken = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

  try {
    const cached = await providerCache.get<ProviderCacheEntry<T>>(cacheKey);
    if (cached && isUsableCacheEntry(cached, cached.ttlMs)) {
      return {
        value: cached.value,
        fromCache: true,
        cacheStoredAt: cached.storedAt,
        warning: "Antwort stammt aus TTL-Cache.",
      };
    }

    const existingLoad = inFlightProviderLoads.get(cacheKey) as Promise<T> | undefined;
    let value: T;

    if (existingLoad) {
      value = await existingLoad;
    } else {
      const ownsDistributedLock = await providerCache.setIfAbsent(
        lockKey,
        lockToken,
        distributedLockMs,
      );

      if (!ownsDistributedLock && cached && isUsableCacheEntry(cached, staleTtlMs)) {
        return {
          value: cached.value,
          fromCache: true,
          cacheStoredAt: cached.storedAt,
          warning: "Aktualisierung läuft. Vorhandene Server-Cache-Daten werden verwendet.",
        };
      }

      value = ownsDistributedLock
        ? await loadWithDistributedLock(cacheKey, lockKey, lockToken, loader)
        : await waitForSharedLoad(cacheKey, loader, ttlMs);
    }
    const empty = value === null || (Array.isArray(value) && value.length === 0);

    if (!empty || allowEmpty) {
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

    if (cached && isUsableCacheEntry(cached, staleTtlMs)) {
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

async function loadWithDistributedLock<T>(
  cacheKey: string,
  lockKey: string,
  lockToken: string,
  loader: () => Promise<T>,
) {
  try {
    return await loadOnce(cacheKey, loader);
  } finally {
    await providerCache.deleteIfValue(lockKey, lockToken);
  }
}

async function waitForSharedLoad<T>(
  cacheKey: string,
  loader: () => Promise<T>,
  ttlMs: number,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const local = inFlightProviderLoads.get(cacheKey) as Promise<T> | undefined;
    if (local) return local;

    await new Promise<void>((resolve) => setTimeout(resolve, 50 + attempt * 20));
    const cached = await providerCache.get<ProviderCacheEntry<T>>(cacheKey);
    if (cached && isUsableCacheEntry(cached, ttlMs)) return cached.value;
  }

  return loadOnce(cacheKey, loader);
}
