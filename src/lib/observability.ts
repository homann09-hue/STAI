import { getCostControls } from "@/lib/cost-controls";

type LogLevel = "info" | "warn" | "error";
type LogDetails = Record<string, unknown>;

const SECRET_KEY_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer|cookie|session)/i;
const PRIVATE_IDENTIFIER_KEY_PATTERN =
  /^(userId|user_id|user-id|clientKey|client_key|client-key|ip|ipAddress|ip_address|ip-address|xForwardedFor|x-forwarded-for|x_forwarded_for|xRealIp|x-real-ip|x_real_ip|email)$/i;
const SENSITIVE_QUERY_VALUE_PATTERN = /([?&](?:api[_-]?key|apikey|api_token|token|access_token|secret|password|authorization)=)[^&#\s]+/gi;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL_VALUE_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const MAX_LOG_DEPTH = 4;
const MAX_LOG_KEYS = 32;
const MAX_LOG_ARRAY_ITEMS = 20;
const MAX_LOG_STRING_LENGTH = 800;

function redactSensitiveString(value: string) {
  const redacted = value
    .replace(SENSITIVE_QUERY_VALUE_PATTERN, "$1[REDACTED]")
    .replace(BEARER_VALUE_PATTERN, "Bearer [REDACTED]")
    .replace(EMAIL_VALUE_PATTERN, "[REDACTED_EMAIL]");

  return redacted.length > MAX_LOG_STRING_LENGTH ? `${redacted.slice(0, MAX_LOG_STRING_LENGTH)}…[TRUNCATED]` : redacted;
}

function redact(key: string, value: unknown, depth: number): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";
  if (PRIVATE_IDENTIFIER_KEY_PATTERN.test(key)) return "[REDACTED_IDENTIFIER]";
  if (depth > MAX_LOG_DEPTH) return "[MAX_DEPTH]";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message)
    };
  }

  if (Array.isArray(value)) {
    const sliced = value.slice(0, MAX_LOG_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
    return value.length > MAX_LOG_ARRAY_ITEMS ? [...sliced, `[TRUNCATED_${value.length - MAX_LOG_ARRAY_ITEMS}_ITEMS]`] : sliced;
  }

  if (value && typeof value === "object") {
    return sanitizeDetails(value, depth + 1);
  }

  return typeof value === "string" ? redactSensitiveString(value) : value;
}

function sanitizeValue(input: unknown, depth: number): unknown {
  if (Array.isArray(input)) {
    const sliced = input.slice(0, MAX_LOG_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
    return input.length > MAX_LOG_ARRAY_ITEMS ? [...sliced, `[TRUNCATED_${input.length - MAX_LOG_ARRAY_ITEMS}_ITEMS]`] : sliced;
  }

  if (input && typeof input === "object") {
    return sanitizeDetails(input, depth + 1);
  }

  return typeof input === "string" ? redactSensitiveString(input) : input;
}

function sanitizeDetails(input: unknown, depth = 0): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  if (depth > MAX_LOG_DEPTH) return { truncated: "[MAX_DEPTH]" };

  const entries = Object.entries(input as Record<string, unknown>).slice(0, MAX_LOG_KEYS);
  const sanitized = Object.fromEntries(entries.map(([key, value]) => [key, redact(key, value, depth)]));
  const totalKeys = Object.keys(input as Record<string, unknown>).length;

  if (totalKeys > MAX_LOG_KEYS) {
    sanitized.truncatedKeys = totalKeys - MAX_LOG_KEYS;
  }

  return sanitized;
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
      supabase: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
          (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
      ),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      fmp: Boolean(process.env.FMP_API_KEY),
      alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
      newsApi: Boolean(process.env.NEWS_API_KEY || process.env.NEWSAPI_API_KEY),
      marketaux: Boolean(process.env.MARKETAUX_API_KEY)
    }
  };
}
