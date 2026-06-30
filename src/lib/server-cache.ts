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
const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const upstashConfigured = Boolean(upstashRestUrl && upstashRestToken);
const externalPrepared = Boolean(
  process.env.VERCEL_RUNTIME_CACHE ||
    process.env.REDIS_URL ||
    process.env.STOCKPILOT_SHARED_CACHE_URL,
);

export const isSharedCacheConfigured = upstashConfigured || externalPrepared;

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
    const entry = pruneExpired(key, memoryStore.get(key));
    return entry ? (entry.value as T) : null;
  },

  async increment(key: string, ttlMs: number) {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, ttlMs);
    return next;
  },

  async set<T>(key: string, value: T, ttlMs: number) {
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + Math.max(ttlMs, 1),
    });
  },

  async delete(key: string) {
    memoryStore.delete(key);
  },

  async clear() {
    memoryStore.clear();
  },
};

async function upstashCommand<T>(command: unknown[]) {
  if (!upstashRestUrl || !upstashRestToken) return null;

  const response = await fetch(upstashRestUrl.replace(/\/$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${upstashRestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash REST cache failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { error?: string; result?: T };
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
    return value as T;
  }
}

const cacheMode: CacheMode = upstashConfigured ? "upstash_rest" : "memory";

const serverCacheAdapter: ServerCacheAdapter = {
  mode: cacheMode,
  sharedConfigured: isSharedCacheConfigured,

  async get<T>(key: string) {
    if (upstashConfigured) {
      try {
        const value = await upstashCommand<unknown>(["GET", key]);
        const parsed = parseCachedValue<T>(value);
        if (parsed !== null) return parsed;
      } catch {
        // External cache is an optimization; local cache remains the safe fallback.
      }
    }

    return memoryCacheAdapter.get<T>(key);
  },

  async increment(key: string, ttlMs: number) {
    if (upstashConfigured) {
      try {
        const count = (await upstashCommand<number>(["INCR", key])) ?? 1;
        if (count === 1) {
          await upstashCommand<number>(["PEXPIRE", key, Math.max(ttlMs, 1)]);
        }
        return count;
      } catch {
        // Fall through to local memory when shared cache is temporarily unavailable.
      }
    }

    return memoryCacheAdapter.increment(key, ttlMs);
  },

  async set<T>(key: string, value: T, ttlMs: number) {
    await memoryCacheAdapter.set(key, value, ttlMs);

    if (upstashConfigured) {
      try {
        await upstashCommand<string>(["SET", key, JSON.stringify(value), "PX", Math.max(ttlMs, 1)]);
      } catch {
        // Keep serving from memory if the shared cache is temporarily unavailable.
      }
    }
  },

  async delete(key: string) {
    await memoryCacheAdapter.delete(key);

    if (upstashConfigured) {
      try {
        await upstashCommand<number>(["DEL", key]);
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
