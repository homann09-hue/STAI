import { getMockAsset } from "@/lib/mock/market";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import type { Fundamentals, MarketDataQuality } from "@/lib/types";

export interface FundamentalsProvider {
  getFundamentals(symbol: string): Promise<Fundamentals | null>;
}

export type FundamentalsProviderMetadata = {
  provider: string;
  quality: MarketDataQuality;
  fields: Partial<Record<keyof Fundamentals, "provider" | "mock" | "unavailable">>;
  fieldCoverage: {
    provider: number;
    mock: number;
    unavailable: number;
    total: number;
  };
  caveat: string | null;
  fallback: {
    degraded: boolean;
    mockLike: boolean;
    fallbackFields: string[];
    warning: string | null;
  };
};

class MockFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(symbol: string) {
    return getMockAsset(symbol)?.fundamentals ?? null;
  }
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function growth(latest?: number, previous?: number) {
  if (latest === undefined || previous === undefined || previous === 0) return undefined;
  return Number((((latest - previous) / Math.abs(previous)) * 100).toFixed(2));
}

function hasObjectData(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function selectedFundamentalsProvider() {
  return (process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER ?? "mock").trim().toLowerCase();
}

function hasConfiguredFundamentalsProvider(provider: string) {
  if (provider === "fmp") return Boolean(process.env.FMP_API_KEY);
  if (provider === "alpha_vantage") return Boolean(process.env.ALPHA_VANTAGE_API_KEY);
  if (provider === "auto") return Boolean(process.env.FMP_API_KEY || process.env.ALPHA_VANTAGE_API_KEY);
  return false;
}

function fundamentalsProviderLabel(provider: string) {
  if (provider === "fmp") return "Financial Modeling Prep";
  if (provider === "alpha_vantage") return "Alpha Vantage";
  if (provider === "auto") return "Fundamentals Provider Auto-Fallback";
  return "StockPilot Mock Fundamentals";
}

function sameMetric(a: number | null | undefined, b: number | null | undefined) {
  return a === b || (a === null && b === undefined) || (a === undefined && b === null);
}

const fundamentalsMetricKeys = [
  "peRatio",
  "revenueGrowth",
  "earningsGrowth",
  "debtToEquity",
  "cashflow",
  "dividendYield",
  "marketCap"
] as const satisfies ReadonlyArray<keyof Fundamentals>;

function mockLikeFundamentalFields(symbol: string, fundamentals: Fundamentals | null) {
  const mock = getMockAsset(symbol)?.fundamentals;
  if (!mock || !fundamentals) return [];

  return fundamentalsMetricKeys.filter((key) => sameMetric(fundamentals[key], mock[key]));
}

function fundamentalFieldSources(symbol: string, fundamentals: Fundamentals | null) {
  const fallbackFields = mockLikeFundamentalFields(symbol, fundamentals);

  return Object.fromEntries(
    fundamentalsMetricKeys.map((key) => [
      key,
      !fundamentals || fundamentals[key] === null || fundamentals[key] === undefined
        ? "unavailable"
        : fallbackFields.includes(key)
          ? "mock"
          : "provider"
    ])
  ) as Partial<Record<keyof Fundamentals, "provider" | "mock" | "unavailable">>;
}

function buildFundamentalsMetadata(symbol: string, fundamentals: Fundamentals | null): FundamentalsProviderMetadata {
  const provider = selectedFundamentalsProvider();
  const configured = hasConfiguredFundamentalsProvider(provider);
  const fallbackFields = mockLikeFundamentalFields(symbol, fundamentals);
  const fields = fundamentalFieldSources(symbol, fundamentals);
  const fieldCoverage = {
    provider: fundamentalsMetricKeys.filter((key) => fields[key] === "provider").length,
    mock: fundamentalsMetricKeys.filter((key) => fields[key] === "mock").length,
    unavailable: fundamentalsMetricKeys.filter((key) => fields[key] === "unavailable").length,
    total: fundamentalsMetricKeys.length
  };
  const mockLike = Boolean(fundamentals && fallbackFields.length === fundamentalsMetricKeys.length);
  const partiallyMockLike = fallbackFields.length > 0;
  const providerIsMock = provider === "mock";
  const degraded = !fundamentals || partiallyMockLike || providerIsMock || !configured;
  const quality: MarketDataQuality = !fundamentals
    ? "unavailable"
    : mockLike || providerIsMock || !configured
      ? "mock"
      : "delayed";

  return {
    provider: mockLike || providerIsMock ? "StockPilot Mock Fundamentals" : fundamentalsProviderLabel(provider),
    quality,
    fields,
    fieldCoverage,
    caveat: fundamentals && !degraded
      ? "Providerdaten koennen je nach Anbieter verzögert, gecached oder unvollständig sein."
      : null,
    fallback: {
      degraded,
      mockLike,
      fallbackFields,
      warning: degraded
        ? "Fundamentaldaten stammen ganz oder teilweise aus Mock-/Fallback-Daten. Nicht als bestätigte Unternehmenskennzahlen interpretieren."
        : null
    }
  };
}

async function fetchJson<T>(url: URL, providerName: string, timeoutMs = 7000): Promise<T> {
  const { data } = await fetchBoundedProviderJson<T>(url, providerName, {
    timeoutMs,
    userAgent: "StockPilotAI/0.1 fundamentals-layer"
  });

  return data;
}

class FmpFundamentalsProvider implements FundamentalsProvider {
  private readonly fallback = new MockFundamentalsProvider();

  async getFundamentals(symbol: string) {
    const token = process.env.FMP_API_KEY;
    if (!token) return this.fallback.getFundamentals(symbol);

    try {
      const baseUrl = process.env.FMP_API_BASE_URL ?? "https://financialmodelingprep.com/stable";
      const makeUrl = (path: string, params: Record<string, string> = {}) => {
        const url = new URL(`${baseUrl}/${path}`);
        url.searchParams.set("symbol", symbol);
        url.searchParams.set("apikey", token);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        return url;
      };

      const [profileResult, ratiosResult, incomeResult, cashflowResult, balanceResult] = await Promise.allSettled([
        fetchJson<Record<string, unknown>[]>(makeUrl("profile"), "FMP profile"),
        fetchJson<Record<string, unknown>[]>(makeUrl("ratios-ttm"), "FMP ratios"),
        fetchJson<Record<string, unknown>[]>(makeUrl("income-statement", { period: "annual", limit: "2" }), "FMP income"),
        fetchJson<Record<string, unknown>[]>(makeUrl("cash-flow-statement", { period: "annual", limit: "1" }), "FMP cashflow"),
        fetchJson<Record<string, unknown>[]>(makeUrl("balance-sheet-statement", { period: "annual", limit: "1" }), "FMP balance")
      ]);

      const profile = profileResult.status === "fulfilled" ? profileResult.value[0] ?? {} : {};
      const ratios = ratiosResult.status === "fulfilled" ? ratiosResult.value[0] ?? {} : {};
      const income = incomeResult.status === "fulfilled" ? incomeResult.value : [];
      const cashflow = cashflowResult.status === "fulfilled" ? cashflowResult.value[0] ?? {} : {};
      const balance = balanceResult.status === "fulfilled" ? balanceResult.value[0] ?? {} : {};
      const providerHasData =
        hasObjectData(profile) || hasObjectData(ratios) || income.length > 0 || hasObjectData(cashflow) || hasObjectData(balance);
      const latestIncome = income[0] ?? {};
      const previousIncome = income[1] ?? {};
      const marketCap = parseNumber(profile.marketCap ?? profile.mktCap);
      const price = parseNumber(profile.price);
      const lastDividend = parseNumber(profile.lastDividend ?? profile.lastDiv);
      const totalDebt = parseNumber(balance.totalDebt ?? balance.shortTermDebt);
      const equity = parseNumber(balance.totalStockholdersEquity ?? balance.totalEquity);
      const fallback = await this.fallback.getFundamentals(symbol);

      if (!providerHasData && !fallback) return null;

      return {
        peRatio:
          parseNumber(ratios.priceToEarningsRatioTTM ?? ratios.peRatioTTM ?? ratios.priceEarningsRatioTTM ?? profile.pe) ??
          fallback?.peRatio ??
          null,
        revenueGrowth:
          growth(parseNumber(latestIncome.revenue), parseNumber(previousIncome.revenue)) ?? fallback?.revenueGrowth ?? 0,
        earningsGrowth:
          growth(parseNumber(latestIncome.netIncome), parseNumber(previousIncome.netIncome)) ?? fallback?.earningsGrowth ?? 0,
        debtToEquity:
          parseNumber(ratios.debtEquityRatioTTM) ??
          (totalDebt !== undefined && equity ? Number((totalDebt / equity).toFixed(2)) : undefined) ??
          fallback?.debtToEquity ??
          0,
        cashflow:
          parseNumber(cashflow.freeCashFlow ?? cashflow.operatingCashFlow ?? cashflow.netCashProvidedByOperatingActivities) ??
          fallback?.cashflow ??
          0,
        dividendYield:
          parseNumber(ratios.dividendYieldTTM) ??
          (lastDividend !== undefined && price ? Number(((lastDividend / price) * 100).toFixed(2)) : undefined) ??
          fallback?.dividendYield ??
          null,
        marketCap: marketCap ?? fallback?.marketCap ?? 0
      };
    } catch {
      return this.fallback.getFundamentals(symbol);
    }
  }
}

class AlphaVantageFundamentalsProvider implements FundamentalsProvider {
  private readonly fallback = new MockFundamentalsProvider();

  async getFundamentals(symbol: string) {
    const token = process.env.ALPHA_VANTAGE_API_KEY;
    if (!token) return this.fallback.getFundamentals(symbol);

    try {
      const url = new URL("https://www.alphavantage.co/query");
      url.searchParams.set("function", "OVERVIEW");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", token);

      const data = await fetchJson<Record<string, unknown>>(url, "Alpha Vantage overview", 8000);
      const fallback = await this.fallback.getFundamentals(symbol);
      const revenueGrowth = parseNumber(data.QuarterlyRevenueGrowthYOY);
      const earningsGrowth = parseNumber(data.QuarterlyEarningsGrowthYOY);
      const dividendYield = parseNumber(data.DividendYield);
      const providerHasData =
        parseNumber(data.PERatio) !== undefined ||
        revenueGrowth !== undefined ||
        earningsGrowth !== undefined ||
        parseNumber(data.OperatingCashflowTTM) !== undefined ||
        dividendYield !== undefined ||
        parseNumber(data.MarketCapitalization) !== undefined;

      if (!providerHasData && !fallback) return null;

      return {
        peRatio: parseNumber(data.PERatio) ?? fallback?.peRatio ?? null,
        revenueGrowth: revenueGrowth !== undefined ? Number((revenueGrowth * 100).toFixed(2)) : fallback?.revenueGrowth ?? 0,
        earningsGrowth: earningsGrowth !== undefined ? Number((earningsGrowth * 100).toFixed(2)) : fallback?.earningsGrowth ?? 0,
        debtToEquity: fallback?.debtToEquity ?? 0,
        cashflow: parseNumber(data.OperatingCashflowTTM) ?? fallback?.cashflow ?? 0,
        dividendYield: dividendYield !== undefined ? Number((dividendYield * 100).toFixed(2)) : fallback?.dividendYield ?? null,
        marketCap: parseNumber(data.MarketCapitalization) ?? fallback?.marketCap ?? 0
      };
    } catch {
      return this.fallback.getFundamentals(symbol);
    }
  }
}

class FallbackFundamentalsProvider implements FundamentalsProvider {
  constructor(private readonly providers: FundamentalsProvider[]) {}

  async getFundamentals(symbol: string) {
    for (const provider of this.providers) {
      const fundamentals = await provider.getFundamentals(symbol);
      if (fundamentals) return fundamentals;
    }

    return null;
  }
}

export function getFundamentalsProvider(): FundamentalsProvider {
  const provider = selectedFundamentalsProvider();
  const fmp = new FmpFundamentalsProvider();
  const alphaVantage = new AlphaVantageFundamentalsProvider();
  const mock = new MockFundamentalsProvider();

  switch (provider) {
    case "auto":
      return new FallbackFundamentalsProvider([
        ...(process.env.FMP_API_KEY ? [fmp] : []),
        ...(process.env.ALPHA_VANTAGE_API_KEY ? [alphaVantage] : []),
        mock
      ]);
    case "fmp":
      return new FallbackFundamentalsProvider([fmp, ...(process.env.ALPHA_VANTAGE_API_KEY ? [alphaVantage] : []), mock]);
    case "alpha_vantage":
      return new FallbackFundamentalsProvider([alphaVantage, ...(process.env.FMP_API_KEY ? [fmp] : []), mock]);
    case "mock":
      return mock;
    default:
      return mock;
  }
}

export async function getFundamentalsWithMetadata(symbol: string) {
  const fundamentals = await getFundamentalsProvider().getFundamentals(symbol);

  return {
    fundamentals,
    metadata: buildFundamentalsMetadata(symbol, fundamentals)
  };
}
