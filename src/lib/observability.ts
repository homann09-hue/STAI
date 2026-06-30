import { getCostControls } from "@/lib/cost-controls";

type LogLevel = "info" | "warn" | "error";
type LogDetails = Record<string, unknown>;

const SECRET_KEY_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer|cookie|session)/i;

function redact(key: string, value: unknown): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDetails(item));
  }

  if (value && typeof value === "object") {
    return sanitizeDetails(value);
  }

  return value;
}

function sanitizeDetails(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [key, redact(key, value)])
  );
}

export function logEvent(level: LogLevel, event: string, details: LogDetails = {}) {
  if (process.env.NODE_ENV === "test" && process.env.STOCKPILOT_TEST_LOGS !== "true") return;

  const payload = {
    level,
    event,
    service: "stockpilot-ai",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
    ...sanitizeDetails(details)
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function getPublicRuntimeDiagnostics() {
  return {
    app: "stockpilot-ai",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    deployment: process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12) : "local",
    providers: {
      market: process.env.STOCKPILOT_MARKET_PROVIDER ?? process.env.MARKET_DATA_PROVIDER ?? "auto",
      quotes: process.env.STOCKPILOT_QUOTE_PROVIDER ?? process.env.MARKET_DATA_PROVIDER ?? "auto",
      news: process.env.STOCKPILOT_NEWS_PROVIDER ?? "auto",
      fundamentals: process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER ?? "auto"
    },
    costControls: getCostControls(),
    configured: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      fmp: Boolean(process.env.FMP_API_KEY),
      alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
      newsApi: Boolean(process.env.NEWS_API_KEY || process.env.NEWSAPI_API_KEY),
      marketaux: Boolean(process.env.MARKETAUX_API_KEY)
    }
  };
}
