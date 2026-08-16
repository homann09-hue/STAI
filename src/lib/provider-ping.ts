import "server-only";

import { getProviderHealthReport } from "@/lib/provider-health";
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

export type ProviderPingStatus = "ok" | "missing_key" | "degraded" | "skipped" | "error";

export type ProviderPingResult = {
  id: string;
  name: string;
  status: ProviderPingStatus;
  latencyMs: number | null;
  checkedAt: string;
  message: string;
};

async function timedCheck(id: string, name: string, url: string | null, configured: boolean): Promise<ProviderPingResult> {
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
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500)
    });
    const latencyMs = Date.now() - started;

    return {
      id,
      name,
      status: response.ok ? "ok" : response.status === 429 ? "degraded" : "error",
      latencyMs,
      checkedAt,
      message: response.ok
        ? "Ping erfolgreich."
        : response.status === 429
          ? "Rate-Limit aktiv."
          : `HTTP ${response.status}.`
    };
  } catch {
    return {
      id,
      name,
      status: "error",
      latencyMs: Date.now() - started,
      checkedAt,
      message: "Ping fehlgeschlagen oder Timeout."
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

export async function runProviderPings() {
  const report = getProviderHealthReport();
  const alpacaCredentials = getAlpacaCredentials();
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const fmpKey = process.env.FMP_API_KEY;
  const twelveDataKey = getTwelveDataApiKey();
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const newsKey = process.env.NEWS_API_KEY ?? process.env.NEWSAPI_API_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const checks = await Promise.all([
    timedAlpacaCheck(Boolean(alpacaCredentials)),
    timedCheck("finnhub", "Finnhub", finnhubKey ? `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(finnhubKey)}` : null, Boolean(finnhubKey)),
    timedFmpCheck(Boolean(fmpKey)),
    timedTwelveDataCheck(Boolean(twelveDataKey)),
    timedCheck("alpha-vantage", "Alpha Vantage", alphaKey ? `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${encodeURIComponent(alphaKey)}` : null, Boolean(alphaKey)),
    timedCheck("newsapi", "NewsAPI", newsKey ? `https://newsapi.org/v2/top-headlines?language=en&pageSize=1&apiKey=${encodeURIComponent(newsKey)}` : null, Boolean(newsKey)),
    timedCheck("marketaux", "Marketaux", marketauxKey ? `https://api.marketaux.com/v1/news/all?symbols=AAPL&limit=1&api_token=${encodeURIComponent(marketauxKey)}` : null, Boolean(marketauxKey)),
    timedCheck("binance", "Binance", "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", true),
    timedCheck("coinbase", "Coinbase", "https://api.coinbase.com/v2/prices/BTC-USD/spot", true)
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
