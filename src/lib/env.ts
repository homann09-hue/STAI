import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));
const optionalInteger = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  MARKET_DATA_PROVIDER: z.string().optional(),
  STOCKPILOT_MARKET_PROVIDER: z.string().optional(),
  STOCKPILOT_QUOTE_PROVIDER: z.string().optional(),
  STOCKPILOT_CRYPTO_PROVIDER: z.string().optional(),
  STOCKPILOT_QUOTE_CACHE_TTL_MS: optionalInteger,
  STOCKPILOT_CRYPTO_QUOTE_CACHE_TTL_MS: optionalInteger,
  STOCKPILOT_STALE_QUOTE_CACHE_TTL_MS: optionalInteger,
  STOCKPILOT_RATE_LIMIT_BACKOFF_MS: optionalInteger,
  STOCKPILOT_PROVIDER_CONCURRENCY: optionalInteger,
  STOCKPILOT_DASHBOARD_QUOTE_TIMEOUT_MS: optionalInteger,
  STOCKPILOT_ASSET_QUOTE_TIMEOUT_MS: optionalInteger,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  KV_REST_API_URL: optionalUrl,
  KV_REST_API_TOKEN: z.string().optional()
});

export const env = serverEnvSchema.parse(process.env);

export function envNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function siteUrlFromEnv() {
  const rawUrl =
    env.NEXT_PUBLIC_SITE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL ||
    "https://stockpilot-ai-beta.vercel.app";

  return rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
}
