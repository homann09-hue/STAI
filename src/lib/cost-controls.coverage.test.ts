import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheControlHeaders, getCostControls, getStreamIntervalMs, secondsFromMs } from "./cost-controls";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cost controls", () => {
  it("uses safe defaults for cache and stream controls", () => {
    const controls = getCostControls();

    expect(controls.quoteTtlMs).toBe(8000);
    expect(controls.quoteStaleTtlMs).toBe(90000);
    expect(controls.newsTtlMs).toBe(120000);
    expect(controls.fundamentalsTtlMs).toBe(3600000);
    expect(controls.streamDefaultIntervalMs).toBe(15000);
    expect(controls.streamMinIntervalMs).toBe(5000);
    expect(controls.streamMaxIntervalMs).toBe(60000);
    expect(secondsFromMs(1001)).toBe(2);
    expect(cacheControlHeaders(8000, 90000)).toEqual({
      "Cache-Control": "s-maxage=8, stale-while-revalidate=90",
      "CDN-Cache-Control": "s-maxage=8, stale-while-revalidate=90",
      "Vercel-CDN-Cache-Control": "s-maxage=8, stale-while-revalidate=90"
    });
  });

  it("clamps unsafe environment and request values", () => {
    vi.stubEnv("STOCKPILOT_QUOTES_TTL_MS", "100");
    vi.stubEnv("STOCKPILOT_STREAM_MIN_INTERVAL_MS", "2000");
    vi.stubEnv("STOCKPILOT_STREAM_MAX_INTERVAL_MS", "10000");
    vi.stubEnv("STOCKPILOT_STREAM_INTERVAL_MS", "999999");

    const controls = getCostControls();

    expect(controls.quoteTtlMs).toBe(1000);
    expect(controls.streamDefaultIntervalMs).toBe(10000);
    expect(getStreamIntervalMs(new Request("https://stockpilot.test/api/market/stream?intervalMs=50"))).toBe(2000);
    expect(getStreamIntervalMs(new Request("https://stockpilot.test/api/market/stream?intervalMs=20000"))).toBe(10000);
    expect(getStreamIntervalMs(new Request("https://stockpilot.test/api/market/stream?pollMs=7000"))).toBe(7000);
    expect(getStreamIntervalMs(new Request("https://stockpilot.test/api/market/stream?pollMs=nope"))).toBe(10000);
  });
});
