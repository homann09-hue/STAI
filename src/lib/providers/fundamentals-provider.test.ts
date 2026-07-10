import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { getFundamentalsProvider } from "./fundamentals-provider";

vi.mock("@/lib/providers/http-json", () => ({
  fetchBoundedProviderJson: vi.fn()
}));

const mockedFetchBoundedProviderJson = vi.mocked(fetchBoundedProviderJson);

const envKeys = [
  "STOCKPILOT_FUNDAMENTALS_PROVIDER",
  "FMP_API_KEY",
  "FMP_API_BASE_URL",
  "ALPHA_VANTAGE_API_KEY"
] as const;
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function stubProviderEnv(key: (typeof envKeys)[number], value: string) {
  vi.stubEnv(key, value);
  process.env[key] = value;
}

describe("fundamentals provider edge cases", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    mockedFetchBoundedProviderJson.mockReset();
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does not turn an unknown FMP symbol into fake zero fundamentals", async () => {
    stubProviderEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    stubProviderEnv("FMP_API_KEY", "test-key");
    stubProviderEnv("FMP_API_BASE_URL", "https://financialmodelingprep.com/stable");
    mockedFetchBoundedProviderJson.mockResolvedValue({ data: [], latencyMs: 1 });

    await expect(getFundamentalsProvider().getFundamentals("DOESNOTEXIST")).resolves.toBeNull();
  });

  it("keeps mock fallback fundamentals for known symbols when FMP has no payload", async () => {
    stubProviderEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    stubProviderEnv("FMP_API_KEY", "test-key");
    stubProviderEnv("FMP_API_BASE_URL", "https://financialmodelingprep.com/stable");
    mockedFetchBoundedProviderJson.mockResolvedValue({ data: [], latencyMs: 1 });

    const fundamentals = await getFundamentalsProvider().getFundamentals("AAPL");

    expect(fundamentals).toMatchObject({
      peRatio: expect.any(Number),
      marketCap: expect.any(Number)
    });
  });

  it("maps FMP stable payloads into normalized fundamentals", async () => {
    stubProviderEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    stubProviderEnv("FMP_API_KEY", "test-key");
    stubProviderEnv("FMP_API_BASE_URL", "https://financialmodelingprep.com/stable");
    mockedFetchBoundedProviderJson.mockImplementation(async (input) => {
        const url = input as URL;
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

        return { data: payload, latencyMs: 1 };
      });

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
    stubProviderEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "fmp");
    stubProviderEnv("FMP_API_KEY", "test-key");
    stubProviderEnv("FMP_API_BASE_URL", "https://financialmodelingprep.com/stable");
    mockedFetchBoundedProviderJson.mockRejectedValue(new Error("FMP HTTP 402"));

    const fundamentals = await getFundamentalsProvider().getFundamentals("MSFT");

    expect(fundamentals).toMatchObject({
      peRatio: expect.any(Number),
      marketCap: expect.any(Number)
    });
  });

  it("maps Alpha Vantage overview payloads and preserves null for unknown empty symbols", async () => {
    stubProviderEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "alpha_vantage");
    stubProviderEnv("ALPHA_VANTAGE_API_KEY", "test-key");
    mockedFetchBoundedProviderJson.mockResolvedValue({
      data: {
            PERatio: "18.5",
            QuarterlyRevenueGrowthYOY: "0.11",
            QuarterlyEarningsGrowthYOY: "-0.04",
            OperatingCashflowTTM: "123456",
            DividendYield: "0.012",
            MarketCapitalization: "987654321"
      },
      latencyMs: 1
    });

    await expect(getFundamentalsProvider().getFundamentals("AAPL")).resolves.toMatchObject({
      peRatio: 18.5,
      revenueGrowth: 11,
      earningsGrowth: -4,
      cashflow: 123456,
      dividendYield: 1.2,
      marketCap: 987654321
    });

    mockedFetchBoundedProviderJson.mockResolvedValue({ data: {}, latencyMs: 1 });

    await expect(getFundamentalsProvider().getFundamentals("DOESNOTEXIST")).resolves.toBeNull();
  });

  it("uses mock or null fallback when no fundamentals provider key is configured", async () => {
    stubProviderEnv("STOCKPILOT_FUNDAMENTALS_PROVIDER", "auto");
    stubProviderEnv("FMP_API_KEY", "");
    stubProviderEnv("ALPHA_VANTAGE_API_KEY", "");

    await expect(getFundamentalsProvider().getFundamentals("NVDA")).resolves.toMatchObject({
      marketCap: expect.any(Number)
    });
    await expect(getFundamentalsProvider().getFundamentals("UNKNOWN")).resolves.toBeNull();
  });
});
