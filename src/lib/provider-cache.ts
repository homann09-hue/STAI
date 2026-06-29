const providerCache = new Map<string, { value: unknown; storedAt: string; ttlMs: number }>();

export async function withCacheFallback<T>(
  key: string,
  loader: () => Promise<T>,
  options: { allowEmpty?: boolean; ttlMs?: number } = {}
) {
  const ttlMs = options.ttlMs ?? 30000;

  try {
    const cached = providerCache.get(key);
    if (cached && Date.now() - new Date(cached.storedAt).getTime() < cached.ttlMs) {
      return {
        value: cached.value as T,
        fromCache: true,
        cacheStoredAt: cached.storedAt,
        warning: "Antwort stammt aus TTL-Cache."
      };
    }

    const value = await loader();
    const empty = value === null || (Array.isArray(value) && value.length === 0);

    if (!empty || options.allowEmpty) {
      providerCache.set(key, { value, storedAt: new Date().toISOString(), ttlMs });
    }

    return {
      value,
      fromCache: false,
      cacheStoredAt: null,
      warning: null
    };
  } catch {
    const cached = providerCache.get(key);

    if (cached) {
      return {
        value: cached.value as T,
        fromCache: true,
        cacheStoredAt: cached.storedAt,
        warning: "Provider nicht erreichbar. Antwort stammt aus Server-Cache."
      };
    }

    throw new Error("Provider unavailable and no cache fallback exists");
  }
}

export function clearProviderCache() {
  providerCache.clear();
}
