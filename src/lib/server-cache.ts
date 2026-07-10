type CacheMode = "memory" | "upstash_rest";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type ServerCacheAdapter = {
  readonly mode: CacheMode;
  readonly sharedConfigured: boolean;
  get<T>(key: string): Promise<T | null>;
  increment(key: string, ttlMs: number): Promise<number>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
};

const memoryStore = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_KEY_CHARS = 240;
const MAX_CACHE_JSON_CHARS = 1_500_000;
const MAX_MEMORY_CACHE_ENTRIES = 10_000;
const MAX_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const configuredUpstashRestUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const upstashRestUrl = normalizeUpstashRestUrl(configuredUpstashRestUrl);
const upstashConfigured = Boolean(upstashRestUrl && upstashRestToken);

export const isSharedCacheConfigured = upstashConfigured;

function normalizeUpstashRestUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const privateHost =
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    if (url.protocol !== "https:" || privateHost) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeCacheKey(key: string) {
  const normalized = key.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_CACHE_KEY_CHARS);
  return normalized || "stockpilot:invalid-cache-key";
}

function normalizeTtlMs(ttlMs: number) {
  return Math.max(1, Math.min(MAX_CACHE_TTL_MS, Number.isFinite(ttlMs) ? ttlMs : 1));
}

function pruneMemoryStoreCapacity() {
  while (memoryStore.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = memoryStore.keys().next().value as string | undefined;
    if (!oldestKey) return;
    memoryStore.delete(oldestKey);
  }
}

function safeSerializeCacheValue(value: unknown) {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") return null;
  if (serialized.length > MAX_CACHE_JSON_CHARS) return null;
  return serialized;
}

function pruneExpired(key: string, entry: CacheEntry<unknown> | undefined) {
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }

  return entry;
}

const memoryCacheAdapter: ServerCacheAdapter = {
  mode: "memory",
  sharedConfigured: isSharedCacheConfigured,

  async get<T>(key: string) {
    const safeKey = normalizeCacheKey(key);
    const entry = pruneExpired(safeKey, memoryStore.get(safeKey));
    return entry ? (entry.value as T) : null;
  },

  async increment(key: string, ttlMs: number) {
    const safeKey = normalizeCacheKey(key);
    const current = (await this.get<number>(safeKey)) ?? 0;
    const next = current + 1;
    await this.set(safeKey, next, ttlMs);
    return next;
  },

  async set<T>(key: string, value: T, ttlMs: number) {
    const safeKey = normalizeCacheKey(key);
    pruneMemoryStoreCapacity();
    memoryStore.set(safeKey, {
      value,
      expiresAt: Date.now() + normalizeTtlMs(ttlMs),
    });
  },

  async delete(key: string) {
    memoryStore.delete(normalizeCacheKey(key));
  },

  async clear() {
    memoryStore.clear();
  },
};

async function upstashCommand<T>(command: unknown[]) {
  if (!upstashRestUrl || !upstashRestToken) return null;

  const body = safeSerializeCacheValue(command);
  if (!body) throw new Error("Upstash REST cache command is too large");

  const response = await fetch(upstashRestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashRestToken}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash REST cache failed with HTTP ${response.status}`);
  }

  const rawPayload = await response.text();
  if (rawPayload.length > MAX_CACHE_JSON_CHARS) {
    throw new Error("Upstash REST cache response is too large");
  }

  const payload = JSON.parse(rawPayload) as { error?: string; result?: T };
  if (payload.error) throw new Error(payload.error);
  return payload.result ?? null;
}

function parseCachedValue<T>(value: unknown) {
  if (value === null || value === undefined) return null;

  if (typeof value !== "string") {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

const cacheMode: CacheMode = upstashConfigured ? "upstash_rest" : "memory";

const serverCacheAdapter: ServerCacheAdapter = {
  mode: cacheMode,
  sharedConfigured: isSharedCacheConfigured,

  async get<T>(key: string) {
    const safeKey = normalizeCacheKey(key);

    if (upstashConfigured) {
      try {
        const value = await upstashCommand<unknown>(["GET", safeKey]);
        const parsed = parseCachedValue<T>(value);
        if (parsed !== null) return parsed;
      } catch {
        // External cache is an optimization; local cache remains the safe fallback.
      }
    }

    return memoryCacheAdapter.get<T>(safeKey);
  },

  async increment(key: string, ttlMs: number) {
    const safeKey = normalizeCacheKey(key);
    const safeTtlMs = normalizeTtlMs(ttlMs);

    if (upstashConfigured) {
      try {
        const count = (await upstashCommand<number>(["INCR", safeKey])) ?? 1;
        if (count === 1) {
          await upstashCommand<number>(["PEXPIRE", safeKey, safeTtlMs]);
        }
        return count;
      } catch {
        // Fall through to local memory when shared cache is temporarily unavailable.
      }
    }

    return memoryCacheAdapter.increment(safeKey, safeTtlMs);
  },

  async set<T>(key: string, value: T, ttlMs: number) {
    const safeKey = normalizeCacheKey(key);
    const safeTtlMs = normalizeTtlMs(ttlMs);
    const serialized = safeSerializeCacheValue(value);
    if (!serialized) return;

    await memoryCacheAdapter.set(safeKey, value, safeTtlMs);

    if (upstashConfigured) {
      try {
        await upstashCommand<string>(["SET", safeKey, serialized, "PX", safeTtlMs]);
      } catch {
        // Keep serving from memory if the shared cache is temporarily unavailable.
      }
    }
  },

  async delete(key: string) {
    const safeKey = normalizeCacheKey(key);
    await memoryCacheAdapter.delete(safeKey);

    if (upstashConfigured) {
      try {
        await upstashCommand<number>(["DEL", safeKey]);
      } catch {
        // Best-effort invalidation only.
      }
    }
  },

  async clear() {
    await memoryCacheAdapter.clear();
  },
};

export function getServerCacheAdapter(): ServerCacheAdapter {
  return serverCacheAdapter;
}
