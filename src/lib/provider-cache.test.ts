import { describe, expect, it } from "vitest";
import { clearProviderCache, withCacheFallback } from "@/lib/provider-cache";

describe("provider cache fallback", () => {
  it("falls back to the last cached value", async () => {
    clearProviderCache();

    const fresh = await withCacheFallback("unit:test", async () => ({ ok: true }));
    const fallback = await withCacheFallback("unit:test", async () => {
      throw new Error("provider down");
    });

    expect(fresh.fromCache).toBe(false);
    expect(fallback.fromCache).toBe(true);
    expect(fallback.value).toEqual({ ok: true });
  });
});
