import { afterEach, describe, expect, it, vi } from "vitest";
import { getFundamentalsProvider } from "./fundamentals-provider";

describe("fundamentals provider edge cases", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not turn an unknown FMP symbol into fake zero fundamentals", async () => {
    vi.stubEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    vi.stubEnv("FMP_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );

    await expect(getFundamentalsProvider().getFundamentals("DOESNOTEXIST")).resolves.toBeNull();
  });

  it("keeps mock fallback fundamentals for known symbols when FMP has no payload", async () => {
    vi.stubEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    vi.stubEnv("FMP_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );

    const fundamentals = await getFundamentalsProvider().getFundamentals("AAPL");

    expect(fundamentals).toMatchObject({
      peRatio: expect.any(Number),
      marketCap: expect.any(Number)
    });
  });

  it("maps FMP stable payloads into normalized fundamentals", async () => {
    vi.stubEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    vi.stubEnv("FMP_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        const path = url.pathname;
        const payload = path.endsWith("/profile")
          ? [{ marketCap: 1000, price: 100, lastDividend: 2 }]
          : path.endsWith("/ratios-ttm")
            ? [{ priceToEarningsRatioTTM: 25, debtEquityRatioTTM: 0.5, dividendYieldTTM: 2.1 }]
            : path.endsWith("/income-statement")
              ? [
                  { revenue: 120, netIncome: 20 },
                  { revenue: 100, netIncome: 10 }
                ]
              : path.endsWith("/cash-flow-statement")
                ? [{ freeCashFlow: 50 }]
                : path.endsWith("/balance-sheet-statement")
                  ? [{ totalDebt: 200, totalStockholdersEquity: 400 }]
                  : [];

        return new Response(JSON.stringify(payload), { status: 200 });
      })
    );

    await expect(getFundamentalsProvider().getFundamentals("AAPL")).resolves.toEqual({
      peRatio: 25,
      revenueGrowth: 20,
      earningsGrowth: 100,
      debtToEquity: 0.5,
      cashflow: 50,
      dividendYield: 2.1,
      marketCap: 1000
    });
  });

  it("falls back to mock fundamentals when FMP has a provider error", async () => {
    vi.stubEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    vi.stubEnv("FMP_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("blocked", { status: 402 })));

    const fundamentals = await getFundamentalsProvider().getFundamentals("MSFT");

    expect(fundamentals).toMatchObject({
      peRatio: expect.any(Number),
      marketCap: expect.any(Number)
    });
  });

  it("maps Alpha Vantage overview payloads and preserves null for unknown empty symbols", async () => {
    vi.stubEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "alpha_vantage");
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            PERatio: "18.5",
            QuarterlyRevenueGrowthYOY: "0.11",
            QuarterlyEarningsGrowthYOY: "-0.04",
            OperatingCashflowTTM: "123456",
            DividendYield: "0.012",
            MarketCapitalization: "987654321"
          }),
          { status: 200 }
        )
      )
    );

    await expect(getFundamentalsProvider().getFundamentals("AAPL")).resolves.toMatchObject({
      peRatio: 18.5,
      revenueGrowth: 11,
      earningsGrowth: -4,
      cashflow: 123456,
      dividendYield: 1.2,
      marketCap: 987654321
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));

    await expect(getFundamentalsProvider().getFundamentals("DOESNOTEXIST")).resolves.toBeNull();
  });

  it("uses mock or null fallback when no fundamentals provider key is configured", async () => {
    vi.stubEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "auto");
    vi.stubEnv("FMP_API_KEY", "");
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");

    await expect(getFundamentalsProvider().getFundamentals("NVDA")).resolves.toMatchObject({
      marketCap: expect.any(Number)
    });
    await expect(getFundamentalsProvider().getFundamentals("UNKNOWN")).resolves.toBeNull();
  });
});
