import "server-only";

import { getProviderHealthReport } from "@/lib/provider-health";
import {
  fetchBoundedProviderJson,
  ProviderHttpResponseError,
} from "@/lib/providers/http-json";
import {
  AlpacaClientError,
  getAlpacaClient,
  getAlpacaCredentials,
} from "@/lib/providers/alpaca-client";
import {
  FmpClientError,
  fmpRowsOrRecordSchema,
  getFmpClient,
} from "@/lib/providers/fmp-client";
import {
  getTwelveDataApiKey,
  getTwelveDataClient,
  TwelveDataClientError,
} from "@/lib/providers/twelve-data-client";
import {
  FinnhubClientError,
  getFinnhubApiKey,
  getFinnhubClient,
} from "@/lib/providers/finnhub-client";

export type ProviderPingStatus = "ok" | "missing_key" | "degraded" | "skipped" | "error";

export type ProviderPingResult = {
  id: string;
  name: string;
  status: ProviderPingStatus;
  latencyMs: number | null;
  checkedAt: string;
  message: string;
};

type ProviderPingRequestOptions = {
  requestHeaders?: Readonly<Record<string, string>>;
};

export async function pingProviderEndpoint(
  id: string,
  name: string,
  url: URL | null,
  configured: boolean,
  options: ProviderPingRequestOptions = {},
): Promise<ProviderPingResult> {
  const checkedAt = new Date().toISOString();

  if (!configured) {
    return {
      id,
      name,
      status: "missing_key",
      latencyMs: null,
      checkedAt,
      message: "API-Key fehlt oder Provider ist nicht aktiviert."
    };
  }

  if (!url) {
    return {
      id,
      name,
      status: "skipped",
      latencyMs: null,
      checkedAt,
      message: "Provider ist konfiguriert, aber kein sicherer Ping-Endpunkt hinterlegt."
    };
  }

  const started = Date.now();

  try {
    const response = await fetchBoundedProviderJson<unknown>(url, name, {
      timeoutMs: 2_500,
      maxBytes: 128_000,
      userAgent: "StockPilotAI/1.0 provider-health",
      requestHeaders: options.requestHeaders,
    });

    return {
      id,
      name,
      status: "ok",
      latencyMs: response.latencyMs,
      checkedAt,
      message: "Ping erfolgreich.",
    };
  } catch (error) {
    const isRateLimited =
      error instanceof ProviderHttpResponseError && error.status === 429;

    return {
      id,
      name,
      status: isRateLimited ? "degraded" : "error",
      latencyMs: Date.now() - started,
      checkedAt,
      message: isRateLimited
        ? "Rate-Limit aktiv."
        : "Ping fehlgeschlagen, Antwort ungültig oder Timeout.",
    };
  }
}

async function timedFmpCheck(configured: boolean): Promise<ProviderPingResult> {
  const checkedAt = new Date().toISOString();
  if (!configured) {
    return {
      id: "fmp",
      name: "Financial Modeling Prep",
      status: "missing_key",
      latencyMs: null,
      checkedAt,
      message: "API-Key fehlt oder Provider ist nicht aktiviert.",
    };
  }

  const started = Date.now();
  try {
    await getFmpClient().request(
      "quote",
      { symbol: "AAPL" },
      fmpRowsOrRecordSchema,
      { timeoutMs: 2_500, maxBytes: 128_000, userAgent: "StockPilotAI/1.0 provider-health" },
    );
    return {
      id: "fmp",
      name: "Financial Modeling Prep",
      status: "ok",
      latencyMs: Date.now() - started,
      checkedAt,
      message: "Ping erfolgreich.",
    };
  } catch (error) {
    const degraded = error instanceof FmpClientError && ["rate_limited", "not_entitled"].includes(error.code);
    return {
      id: "fmp",
      name: "Financial Modeling Prep",
      status: degraded ? "degraded" : "error",
      latencyMs: Date.now() - started,
      checkedAt,
      message:
        error instanceof FmpClientError
          ? error.code === "not_entitled"
            ? "Provider erreichbar, Testinstrument im Tarif nicht freigeschaltet."
            : error.message
          : "Ping fehlgeschlagen oder Timeout.",
    };
  }
}

async function timedTwelveDataCheck(
  configured: boolean,
): Promise<ProviderPingResult> {
  const checkedAt = new Date().toISOString();
  if (!configured) {
    return {
      id: "twelve-data",
      name: "Twelve Data",
      status: "missing_key",
      latencyMs: null,
      checkedAt,
      message: "API-Key fehlt oder Provider ist nicht aktiviert.",
    };
  }
  const started = Date.now();
  try {
    const result = await getTwelveDataClient().healthCheck();
    return {
      id: "twelve-data",
      name: "Twelve Data",
      status: result.status,
      latencyMs: result.latencyMs,
      checkedAt,
      message: result.message,
    };
  } catch (error) {
    const degraded =
      error instanceof TwelveDataClientError &&
      ["rate_limited", "not_entitled"].includes(error.code);
    return {
      id: "twelve-data",
      name: "Twelve Data",
      status: degraded ? "degraded" : "error",
      latencyMs: Date.now() - started,
      checkedAt,
      message:
        error instanceof TwelveDataClientError
          ? error.message
          : "Ping fehlgeschlagen oder Timeout.",
    };
  }
}

async function timedAlpacaCheck(configured: boolean): Promise<ProviderPingResult> {
  const checkedAt = new Date().toISOString();
  if (!configured) {
    return {
      id: "alpaca",
      name: "Alpaca",
      status: "missing_key",
      latencyMs: null,
      checkedAt,
      message: "API-Key fehlt oder Provider ist nicht aktiviert.",
    };
  }
  const started = Date.now();
  try {
    const result = await getAlpacaClient().healthCheck();
    return {
      id: "alpaca",
      name: "Alpaca",
      status: result.status,
      latencyMs: result.latencyMs,
      checkedAt,
      message: result.message,
    };
  } catch (error) {
    const degraded = error instanceof AlpacaClientError && ["rate_limited", "not_entitled"].includes(error.code);
    return {
      id: "alpaca",
      name: "Alpaca",
      status: degraded ? "degraded" : "error",
      latencyMs: Date.now() - started,
      checkedAt,
      message: error instanceof AlpacaClientError ? error.message : "Ping fehlgeschlagen oder Timeout.",
    };
  }
}

async function timedFinnhubCheck(configured: boolean): Promise<ProviderPingResult> {
  const checkedAt = new Date().toISOString();
  if (!configured) {
    return {
      id: "finnhub",
      name: "Finnhub",
      status: "missing_key",
      latencyMs: null,
      checkedAt,
      message: "API-Key fehlt oder Provider ist nicht aktiviert.",
    };
  }
  const started = Date.now();
  try {
    const result = await getFinnhubClient().healthCheck();
    return { id: "finnhub", name: "Finnhub", checkedAt, ...result };
  } catch (error) {
    const degraded = error instanceof FinnhubClientError && ["rate_limited", "not_entitled"].includes(error.code);
    return {
      id: "finnhub",
      name: "Finnhub",
      status: degraded ? "degraded" : "error",
      latencyMs: Date.now() - started,
      checkedAt,
      message: error instanceof FinnhubClientError ? error.message : "Ping fehlgeschlagen oder Timeout.",
    };
  }
}

export async function runProviderPings() {
  const report = getProviderHealthReport();
  const alpacaCredentials = getAlpacaCredentials();
  const finnhubKey = getFinnhubApiKey();
  const fmpKey = process.env.FMP_API_KEY;
  const twelveDataKey = getTwelveDataApiKey();
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const newsKey = process.env.NEWS_API_KEY ?? process.env.NEWSAPI_API_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const checks = await Promise.all([
    timedAlpacaCheck(Boolean(alpacaCredentials)),
    timedFinnhubCheck(Boolean(finnhubKey)),
    timedFmpCheck(Boolean(fmpKey)),
    timedTwelveDataCheck(Boolean(twelveDataKey)),
    pingProviderEndpoint(
      "alpha-vantage",
      "Alpha Vantage",
      alphaKey
        ? new URL(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(alphaKey)}`)
        : null,
      Boolean(alphaKey),
    ),
    pingProviderEndpoint(
      "newsapi",
      "NewsAPI",
      newsKey ? new URL("https://newsapi.org/v2/top-headlines?language=en&pageSize=1") : null,
      Boolean(newsKey),
      newsKey ? { requestHeaders: { "X-Api-Key": newsKey } } : {},
    ),
    pingProviderEndpoint(
      "marketaux",
      "Marketaux",
      marketauxKey
        ? new URL(`https://api.marketaux.com/v1/news/all?symbols=AAPL&limit=1&api_token=${encodeURIComponent(marketauxKey)}`)
        : null,
      Boolean(marketauxKey),
    ),
    pingProviderEndpoint(
      "binance",
      "Binance",
      new URL("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      true,
    ),
    pingProviderEndpoint(
      "coinbase",
      "Coinbase",
      new URL("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
      true,
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    readinessScore: report.readinessScore,
    checks,
    summary: {
      ok: checks.filter((item) => item.status === "ok").length,
      degraded: checks.filter((item) => item.status === "degraded").length,
      missingKey: checks.filter((item) => item.status === "missing_key").length,
      error: checks.filter((item) => item.status === "error").length
    }
  };
}
