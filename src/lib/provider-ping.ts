import "server-only";

import { getProviderHealthReport } from "@/lib/provider-health";

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

export async function runProviderPings() {
  const report = getProviderHealthReport();
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const fmpKey = process.env.FMP_API_KEY;
  const alphaKey = process.env.ALPHA_VANTAGE_API_KEY;
  const newsKey = process.env.NEWS_API_KEY ?? process.env.NEWSAPI_API_KEY;
  const marketauxKey = process.env.MARKETAUX_API_KEY;

  const checks = await Promise.all([
    timedCheck("finnhub", "Finnhub", finnhubKey ? `https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(finnhubKey)}` : null, Boolean(finnhubKey)),
    timedCheck("fmp", "Financial Modeling Prep", fmpKey ? `https://financialmodelingprep.com/api/v3/quote-short/AAPL?apikey=${encodeURIComponent(fmpKey)}` : null, Boolean(fmpKey)),
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
