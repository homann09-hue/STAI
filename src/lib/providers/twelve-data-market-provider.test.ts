import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetProviderResilienceForTests } from "@/lib/provider-resilience";
import {
  getMarketDataProvider,
  resetMarketProviderRuntimeStateForTests,
} from "@/lib/providers/market-provider";

beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("MARKET_DATA_ENV", "test");
  vi.stubEnv("TWELVE_DATA_API_KEY", "server-secret");
  vi.stubEnv("MARKET_DATA_ENABLE_TWELVE_DATA", "true");
  vi.stubEnv("MARKET_DATA_ENABLE_FINNHUB", "false");
  vi.stubEnv("MARKET_DATA_ENABLE_FMP", "false");
  vi.stubEnv("MARKET_DATA_ENABLE_EODHD", "false");
  vi.stubEnv("MARKET_DATA_ENABLE_MASSIVE", "false");
  vi.stubEnv("MARKET_DATA_ENABLE_ALPHA_VANTAGE", "false");
  await resetMarketProviderRuntimeStateForTests();
  await resetProviderResilienceForTests();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await resetMarketProviderRuntimeStateForTests();
  await resetProviderResilienceForTests();
});

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Twelve Data market provider integration", () => {
  it("loads real intraday candles through the central provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          status: "ok",
          meta: {
            symbol: "SAP",
            interval: "5min",
            currency: "EUR",
            exchange: "XETRA",
            mic_code: "XETR",
            exchange_timezone: "Europe/Berlin",
            type: "Common Stock",
          },
          values: [
            {
              datetime: "2026-08-11 15:30:00",
              open: "190",
              high: "192",
              low: "189",
              close: "191",
              volume: "5000",
            },
          ],
        }),
      ),
    );

    const bars = await getMarketDataProvider().getCandles("SAP", "5m");
    expect(bars).toEqual([
      expect.objectContaining({
        symbol: "SAP",
        providerId: "twelve_data",
        interval: "5m",
        venue: "XETR",
        close: 191,
      }),
    ]);
  });

  it("uses one capped provider batch instead of N single quote requests", async () => {
    vi.stubEnv("TWELVE_DATA_BATCH_MAX_SYMBOLS", "2");
    const fetchMock = vi.fn(async () =>
      response({
        AAPL: { symbol: "AAPL", close: "220", currency: "USD" },
        MSFT: { symbol: "MSFT", close: "510", currency: "USD" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const quotes = await getMarketDataProvider().getQuotes([
      "AAPL",
      "MSFT",
      "NVDA",
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(quotes.map((quote) => quote.symbol)).toEqual(["AAPL", "MSFT"]);
  });
});
