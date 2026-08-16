import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetProviderResilienceForTests } from "@/lib/provider-resilience";
import {
  getMarketDataProvider,
  resetMarketProviderRuntimeStateForTests,
} from "@/lib/providers/market-provider";

const snapshot = {
  latestTrade: { t: "2026-08-14T15:30:00Z", x: "V", p: 221.5, s: 10, i: 1, c: ["@"], z: "C" },
  latestQuote: { t: "2026-08-14T15:30:00Z", ax: "V", ap: 221.52, as: 4, bx: "V", bp: 221.48, bs: 7, c: ["R"], z: "C" },
  minuteBar: null,
  dailyBar: { t: "2026-08-14T15:30:00Z", o: 219, h: 223, l: 218, c: 221.5, v: 1_000, n: 200, vw: 220.4 },
  prevDailyBar: { t: "2026-08-13T20:00:00Z", o: 217, h: 220, l: 216, c: 219, v: 900, n: 180, vw: 218 },
};

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MARKET_DATA_ENV", "test");
  vi.stubEnv("MARKET_DATA_DEFAULT_PROVIDER", "alpaca");
  vi.stubEnv("ALPACA_API_KEY_ID", "key-id");
  vi.stubEnv("ALPACA_API_SECRET_KEY", "secret-key");
  vi.stubEnv("ALPACA_DATA_FEED", "iex");
  vi.stubEnv("MARKET_DATA_ENABLE_ALPACA", "true");
  for (const provider of ["TWELVE_DATA", "FINNHUB", "FMP", "EODHD", "MASSIVE", "ALPHA_VANTAGE"]) {
    vi.stubEnv(`MARKET_DATA_ENABLE_${provider}`, "false");
  }
  await resetMarketProviderRuntimeStateForTests();
  await resetProviderResilienceForTests();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await resetMarketProviderRuntimeStateForTests();
  await resetProviderResilienceForTests();
});

describe("Alpaca market provider integration", () => {
  it("routes a real IEX snapshot through the central market provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) =>
      new Response(JSON.stringify(String(input).includes("/clock")
        ? { timestamp: "2026-08-14T15:30:00Z", is_open: true, next_open: "2026-08-17T13:30:00Z", next_close: "2026-08-14T20:00:00Z" }
        : snapshot), { status: 200, headers: { "content-type": "application/json" } }),
    ));

    const provider = getMarketDataProvider();
    const quote = await provider.getQuote("AAPL");
    expect(provider).toMatchObject({ providerId: "alpaca", streamMode: "rest_polling" });
    expect(quote).toMatchObject({ providerId: "alpaca", provider: "Alpaca IEX (einzelner Handelsplatz)", bidSize: 7, askSize: 4 });
  });
});
