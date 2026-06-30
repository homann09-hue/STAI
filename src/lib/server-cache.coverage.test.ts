import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("server cache adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("stores, expires, increments, deletes and clears values in memory", async () => {
    const { getServerCacheAdapter } = await import("./server-cache");
    const cache = getServerCacheAdapter();

    await cache.clear();
    expect(cache.mode).toBe("memory");
    expect(await cache.get("missing")).toBeNull();

    await cache.set("quote:NVDA", { price: 148.42 }, 100);
    expect(await cache.get<{ price: number }>("quote:NVDA")).toEqual({ price: 148.42 });

    expect(await cache.increment("rate:market", 1000)).toBe(1);
    expect(await cache.increment("rate:market", 1000)).toBe(2);

    await cache.delete("quote:NVDA");
    expect(await cache.get("quote:NVDA")).toBeNull();

    await cache.set("short-lived", "ok", 50);
    vi.advanceTimersByTime(51);
    expect(await cache.get("short-lived")).toBeNull();

    await cache.set("clear-me", true, 1000);
    await cache.clear();
    expect(await cache.get("clear-me")).toBeNull();
  });

  it("uses Upstash REST when configured and parses JSON payloads", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://cache.example.com/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret-token");

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ result: "{\"tier\":\"pro\"}" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getServerCacheAdapter, isSharedCacheConfigured } = await import("./server-cache");
    const cache = getServerCacheAdapter();

    expect(isSharedCacheConfigured).toBe(true);
    expect(cache.mode).toBe("upstash_rest");
    await expect(cache.get("plan")).resolves.toEqual({ tier: "pro" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cache.example.com",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("falls back to memory when the shared cache is unavailable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://cache.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "secret-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ error: "temporarily down" }), { status: 200 });
      })
    );

    const { getServerCacheAdapter } = await import("./server-cache");
    const cache = getServerCacheAdapter();

    await cache.clear();
    await cache.set("fallback", { safe: true }, 1000);
    await expect(cache.get("fallback")).resolves.toEqual({ safe: true });
    await expect(cache.increment("fallback-count", 1000)).resolves.toBe(1);
    await cache.delete("fallback");
    await expect(cache.get("fallback")).resolves.toBeNull();
  });
});
