import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerCacheAdapter } from "./server-cache";
import { clearProviderCache, withCacheFallback } from "./provider-cache";

describe("provider cache branch coverage", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T10:00:00.000Z"));
    await getServerCacheAdapter().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("serves fresh cached values inside TTL", async () => {
    const first = await withCacheFallback("quotes", async () => ({ price: 100 }), { ttlMs: 1000 });
    const second = await withCacheFallback("quotes", async () => ({ price: 200 }), { ttlMs: 1000 });

    expect(first).toMatchObject({ value: { price: 100 }, fromCache: false, warning: null });
    expect(second).toMatchObject({
      value: { price: 100 },
      fromCache: true,
      cacheStoredAt: "2026-06-30T10:00:00.000Z",
      warning: "Antwort stammt aus TTL-Cache."
    });
  });

  it("does not cache empty values unless explicitly allowed", async () => {
    await withCacheFallback("empty-blocked", async () => [], { ttlMs: 1000 });

    await expect(
      withCacheFallback("empty-blocked", async () => {
        throw new Error("provider down");
      })
    ).rejects.toThrow("Provider unavailable and no cache fallback exists");

    const allowed = await withCacheFallback("empty-allowed", async () => [], {
      allowEmpty: true,
      ttlMs: 1000
    });
    const cached = await withCacheFallback("empty-allowed", async () => ["fresh"], { ttlMs: 1000 });

    expect(allowed.fromCache).toBe(false);
    expect(cached).toMatchObject({ value: [], fromCache: true });
  });

  it("refreshes expired values and falls back to stale cache on loader errors", async () => {
    await withCacheFallback("refresh", async () => "old", { ttlMs: 100, staleTtlMs: 5000 });
    vi.advanceTimersByTime(101);

    const refreshed = await withCacheFallback("refresh", async () => "new", { ttlMs: 100, staleTtlMs: 5000 });
    expect(refreshed).toMatchObject({ value: "new", fromCache: false });

    vi.advanceTimersByTime(101);
    const fallback = await withCacheFallback("refresh", async () => {
      throw new Error("provider down");
    });

    expect(fallback).toMatchObject({
      value: "new",
      fromCache: true,
      warning: "Provider nicht erreichbar. Antwort stammt aus Server-Cache."
    });
  });

  it("clears provider cache without throwing", async () => {
    await withCacheFallback("clearable", async () => "cached", { ttlMs: 1000 });
    clearProviderCache();
    await Promise.resolve();

    const fresh = await withCacheFallback("clearable", async () => "fresh", { ttlMs: 1000 });
    expect(fresh).toMatchObject({ value: "fresh", fromCache: false });
  });

  it("deduplicates concurrent loader calls for the same cache key", async () => {
    let loaderCalls = 0;
    const loader = vi.fn(async () => {
      loaderCalls += 1;
      await Promise.resolve();
      return { price: 123 };
    });

    const [first, second, third] = await Promise.all([
      withCacheFallback("dedupe", loader, { ttlMs: 1000 }),
      withCacheFallback("dedupe", loader, { ttlMs: 1000 }),
      withCacheFallback("dedupe", loader, { ttlMs: 1000 })
    ]);

    expect(loaderCalls).toBe(1);
    expect(first.value).toEqual({ price: 123 });
    expect(second.value).toEqual({ price: 123 });
    expect(third.value).toEqual({ price: 123 });
  });
});
