import { getMockAsset } from "@/lib/mock/market";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { fmpRowsSchema, getFmpClient } from "@/lib/providers/fmp-client";
import { resolveProviderRoute, type ProviderId } from "@/lib/providers/provider-registry";
import { developmentFixturesAllowed } from "@/lib/runtime-data-policy";
import type { Fundamentals, FundamentalsFieldSource, MarketDataQuality } from "@/lib/types";

type FundamentalsProviderResult = {
  actualProvider: "fmp" | "alpha_vantage" | "mock";
  provider: string;
  quality: MarketDataQuality;
  fundamentals: Fundamentals;
  fields: Partial<Record<keyof Fundamentals, FundamentalsFieldSource>>;
};

export interface FundamentalsProvider {
  getFundamentals(symbol: string): Promise<FundamentalsProviderResult | null>;
}

export type FundamentalsProviderMetadata = {
  provider: string;
  requestedProvider: string;
  actualProvider: string;
  quality: MarketDataQuality;
  fetchedAt: string;
  fields: Partial<Record<keyof Fundamentals, FundamentalsFieldSource>>;
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

const fundamentalsMetricKeys = [
  "peRatio",
  "revenueGrowth",
  "earningsGrowth",
  "debtToEquity",
  "cashflow",
  "dividendYield",
  "marketCap"
] as const satisfies ReadonlyArray<keyof Fundamentals>;

type ProviderValues = Partial<Record<keyof Fundamentals, number | null | undefined>>;

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

/** Normalisiert Providerquoten auf die in StockPilot verwendete Prozent-Skala. */
export function normalizeProviderPercentage(value: unknown) {
  const parsed = parseNumber(value);
  if (parsed === undefined) return undefined;
  return Math.abs(parsed) <= 1 ? Number((parsed * 100).toFixed(6)) : parsed;
}

function growth(latest?: number, previous?: number) {
  if (latest === undefined || previous === undefined || previous === 0) return undefined;
  return Number((((latest - previous) / Math.abs(previous)) * 100).toFixed(2));
}

function selectedFundamentalsProvider() {
  const selected = (process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER ?? "auto").trim().toLowerCase();
  if (selected === "fmp" || selected === "alpha_vantage" || selected === "mock" || selected === "auto") {
    return selected;
  }
  return "auto";
}

function providerResult(
  actualProvider: "fmp" | "alpha_vantage",
  provider: string,
  quality: MarketDataQuality,
  values: ProviderValues
): FundamentalsProviderResult | null {
  const fields = Object.fromEntries(
    fundamentalsMetricKeys.map((key) => [
      key,
      values[key] === undefined || values[key] === null ? "unavailable" : "provider"
    ])
  ) as Partial<Record<keyof Fundamentals, FundamentalsFieldSource>>;

  if (!fundamentalsMetricKeys.some((key) => fields[key] === "provider")) return null;

  return {
    actualProvider,
    provider,
    quality,
    fundamentals: {
      peRatio: values.peRatio ?? null,
      revenueGrowth: values.revenueGrowth ?? 0,
      earningsGrowth: values.earningsGrowth ?? 0,
      debtToEquity: values.debtToEquity ?? 0,
      cashflow: values.cashflow ?? 0,
      dividendYield: values.dividendYield ?? null,
      marketCap: values.marketCap ?? 0
    },
    fields
  };
}

class MockFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(symbol: string) {
    const fundamentals = getMockAsset(symbol)?.fundamentals;
    if (!fundamentals) return null;

    return {
      actualProvider: "mock" as const,
      provider: "StockPilot Mock Fundamentals",
      quality: "mock" as const,
      fundamentals,
      fields: Object.fromEntries(fundamentalsMetricKeys.map((key) => [key, "mock"])) as Partial<
        Record<keyof Fundamentals, FundamentalsFieldSource>
      >
    };
  }
}

async function fetchJson<T>(url: URL, providerName: string, timeoutMs = 7000): Promise<T> {
  const { data } = await fetchBoundedProviderJson<T>(url, providerName, {
    timeoutMs,
    userAgent: "StockPilotAI/0.1 fundamentals-layer"
  });

  return data;
}

class FmpFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(symbol: string) {
    try {
      const client = getFmpClient();

      const [profileResult, ratiosResult, incomeResult, cashflowResult, balanceResult] = await Promise.allSettled([
        client.request("profile", { symbol }, fmpRowsSchema),
        client.request("ratios-ttm", { symbol }, fmpRowsSchema),
        client.request("income-statement", { symbol, period: "annual", limit: "2" }, fmpRowsSchema),
        client.request("cash-flow-statement", { symbol, period: "annual", limit: "1" }, fmpRowsSchema),
        client.request("balance-sheet-statement", { symbol, period: "annual", limit: "1" }, fmpRowsSchema)
      ]);

      const profile = profileResult.status === "fulfilled" ? profileResult.value.data[0] ?? {} : {};
      const ratios = ratiosResult.status === "fulfilled" ? ratiosResult.value.data[0] ?? {} : {};
      const income = incomeResult.status === "fulfilled" ? incomeResult.value.data : [];
      const cashflow = cashflowResult.status === "fulfilled" ? cashflowResult.value.data[0] ?? {} : {};
      const balance = balanceResult.status === "fulfilled" ? balanceResult.value.data[0] ?? {} : {};
      const latestIncome = income[0] ?? {};
      const previousIncome = income[1] ?? {};
      const price = parseNumber(profile.price);
      const lastDividend = parseNumber(profile.lastDividend ?? profile.lastDiv);
      const totalDebt = parseNumber(balance.totalDebt ?? balance.shortTermDebt);
      const equity = parseNumber(balance.totalStockholdersEquity ?? balance.totalEquity);

      return providerResult("fmp", "Financial Modeling Prep", "delayed", {
        peRatio: parseNumber(ratios.priceToEarningsRatioTTM ?? ratios.peRatioTTM ?? ratios.priceEarningsRatioTTM ?? profile.pe),
        revenueGrowth: growth(parseNumber(latestIncome.revenue), parseNumber(previousIncome.revenue)),
        earningsGrowth: growth(parseNumber(latestIncome.netIncome), parseNumber(previousIncome.netIncome)),
        debtToEquity:
          parseNumber(ratios.debtEquityRatioTTM) ??
          (totalDebt !== undefined && equity ? Number((totalDebt / equity).toFixed(2)) : undefined),
        cashflow: parseNumber(cashflow.freeCashFlow ?? cashflow.operatingCashFlow ?? cashflow.netCashProvidedByOperatingActivities),
        dividendYield:
          normalizeProviderPercentage(ratios.dividendYieldTTM) ??
          (lastDividend !== undefined && price ? Number(((lastDividend / price) * 100).toFixed(2)) : undefined),
        marketCap: parseNumber(profile.marketCap ?? profile.mktCap)
      });
    } catch {
      return null;
    }
  }
}

class AlphaVantageFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(symbol: string) {
    const token = process.env.ALPHA_VANTAGE_API_KEY;
    if (!token) return null;

    try {
      const url = new URL("https://www.alphavantage.co/query");
      url.searchParams.set("function", "OVERVIEW");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", token);

      const data = await fetchJson<Record<string, unknown>>(url, "Alpha Vantage overview", 8000);

      return providerResult("alpha_vantage", "Alpha Vantage", "delayed", {
        peRatio: parseNumber(data.PERatio),
        revenueGrowth: normalizeProviderPercentage(data.QuarterlyRevenueGrowthYOY),
        earningsGrowth: normalizeProviderPercentage(data.QuarterlyEarningsGrowthYOY),
        cashflow: parseNumber(data.OperatingCashflowTTM),
        dividendYield: normalizeProviderPercentage(data.DividendYield),
        marketCap: parseNumber(data.MarketCapitalization)
      });
    } catch {
      return null;
    }
  }
}

class FallbackFundamentalsProvider implements FundamentalsProvider {
  constructor(private readonly providers: FundamentalsProvider[]) {}

  async getFundamentals(symbol: string) {
    for (const provider of this.providers) {
      try {
        const result = await provider.getFundamentals(symbol);
        if (result) return result;
      } catch {
        // Der naechste echte Provider darf uebernehmen. Produktions-Fixtures
        // sind niemals ein Ausfall-Fallback.
      }
    }

    return null;
  }
}

function getFundamentalsProviderAttempts(selected: string): FundamentalsProvider[] {
  if (selected === "mock") {
    return developmentFixturesAllowed() ? [new MockFundamentalsProvider()] : [];
  }

  const route = resolveProviderRoute({
    capability: "fundamentals",
    preferredProvider: selected === "auto" ? null : selected,
  });
  const adapters: Partial<Record<ProviderId, FundamentalsProvider>> = {
    fmp: new FmpFundamentalsProvider(),
    alpha_vantage: new AlphaVantageFundamentalsProvider(),
  };

  return route.providers.flatMap((id) => {
    const adapter = adapters[id];
    return adapter ? [adapter] : [];
  });
}

export function getFundamentalsProvider(): FundamentalsProvider {
  return new FallbackFundamentalsProvider(getFundamentalsProviderAttempts(selectedFundamentalsProvider()));
}

function buildFundamentalsMetadata(
  requestedProvider: string,
  result: FundamentalsProviderResult | null
): FundamentalsProviderMetadata {
  const fields = result?.fields ?? Object.fromEntries(fundamentalsMetricKeys.map((key) => [key, "unavailable"]));
  const fieldCoverage = {
    provider: fundamentalsMetricKeys.filter((key) => fields[key] === "provider").length,
    mock: fundamentalsMetricKeys.filter((key) => fields[key] === "mock").length,
    unavailable: fundamentalsMetricKeys.filter((key) => fields[key] === "unavailable").length,
    total: fundamentalsMetricKeys.length
  };
  const mockLike = result?.actualProvider === "mock";
  const partial = Boolean(result && fieldCoverage.unavailable > 0);
  const degraded = !result || mockLike || partial;
  const warning = !result
    ? "Kein konfigurierter Fundamentals-Provider konnte verifizierte Kennzahlen liefern. Es werden keine Ersatzwerte angezeigt."
    : mockLike
      ? "Lokale Entwicklungs-Fixtures sind aktiv. Diese Kennzahlen sind keine echten Unternehmensdaten."
      : partial
        ? `${fieldCoverage.provider} von ${fieldCoverage.total} Kennzahlen sind durch den Provider belegt; fehlende Felder bleiben nicht verfügbar.`
        : null;

  return {
    provider: result?.provider ?? "Kein Fundamentals-Provider",
    requestedProvider,
    actualProvider: result?.actualProvider ?? "unavailable",
    quality: result?.quality ?? "unavailable",
    fetchedAt: new Date().toISOString(),
    fields,
    fieldCoverage,
    caveat:
      result && !mockLike
        ? "Providerdaten können je nach Anbieter verzögert, gecached oder unvollständig sein. Nur als Provider markierte Felder sind analysierbar."
        : null,
    fallback: {
      degraded,
      mockLike,
      fallbackFields: mockLike ? fundamentalsMetricKeys.map(String) : [],
      warning
    }
  };
}

export async function getFundamentalsWithMetadata(symbol: string) {
  const requestedProvider = selectedFundamentalsProvider();
  const result = await getFundamentalsProvider().getFundamentals(symbol);

  return {
    fundamentals: result?.fundamentals ?? null,
    metadata: buildFundamentalsMetadata(requestedProvider, result)
  };
}
