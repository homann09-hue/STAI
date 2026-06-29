const providerCache = new Map<string, { value: unknown; storedAt: string }>();

export async function withCacheFallback<T>(
  key: string,
  loader: () => Promise<T>,
  options: { allowEmpty?: boolean } = {}
) {
  try {
    const value = await loader();
    const empty = value === null || (Array.isArray(value) && value.length === 0);

    if (!empty || options.allowEmpty) {
      providerCache.set(key, { value, storedAt: new Date().toISOString() });
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
