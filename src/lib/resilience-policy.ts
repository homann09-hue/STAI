import type { ProviderId } from "@/lib/providers/provider-registry";

export type ProviderCacheKind =
  | "quote"
  | "asset_detail"
  | "dashboard"
  | "fundamentals"
  | "news"
  | "macro"
  | "filings"
  | "historical_bars"
  | "instrument_metadata"
  | "ai_analysis"
  | "forecast"
  | "professional";

export type ProviderCachePolicy = {
  kind: ProviderCacheKind;
  ttlMs: number;
  staleTtlMs: number;
  allowEmpty: boolean;
  distributedLockMs: number;
};

export type ProviderRequestPolicy = {
  providerId: ProviderId | "unknown";
  requestsPerMinute: number;
  burstCapacity: number;
  maxConcurrency: number;
  maxQueueSize: number;
  queueTimeoutMs: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  maxRetryDelayMs: number;
  circuitFailureThreshold: number;
  circuitOpenMs: number;
};

type CachePolicyDefinition = Omit<ProviderCachePolicy, "kind"> & {
  ttlEnv?: string;
  staleEnv?: string;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const cachePolicies: Record<ProviderCacheKind, CachePolicyDefinition> = {
  quote: {
    ttlMs: 8_000,
    staleTtlMs: 90_000,
    allowEmpty: false,
    distributedLockMs: 8_000,
    ttlEnv: "STOCKPILOT_QUOTES_TTL_MS",
    staleEnv: "STOCKPILOT_QUOTES_STALE_TTL_MS",
  },
  asset_detail: {
    ttlMs: 5_000,
    staleTtlMs: 120_000,
    allowEmpty: false,
    distributedLockMs: 12_000,
  },
  dashboard: {
    ttlMs: 10_000,
    staleTtlMs: 120_000,
    allowEmpty: false,
    distributedLockMs: 12_000,
  },
  fundamentals: {
    ttlMs: HOUR,
    staleTtlMs: DAY,
    allowEmpty: false,
    distributedLockMs: 15_000,
    ttlEnv: "STOCKPILOT_FUNDAMENTALS_TTL_MS",
    staleEnv: "STOCKPILOT_FUNDAMENTALS_STALE_TTL_MS",
  },
  news: {
    ttlMs: 2 * MINUTE,
    staleTtlMs: 15 * MINUTE,
    allowEmpty: true,
    distributedLockMs: 10_000,
    ttlEnv: "STOCKPILOT_NEWS_TTL_MS",
    staleEnv: "STOCKPILOT_NEWS_STALE_TTL_MS",
  },
  macro: {
    ttlMs: HOUR,
    staleTtlMs: DAY,
    allowEmpty: false,
    distributedLockMs: 20_000,
  },
  filings: {
    ttlMs: 15 * MINUTE,
    staleTtlMs: DAY,
    allowEmpty: true,
    distributedLockMs: 15_000,
  },
  historical_bars: {
    ttlMs: 6 * HOUR,
    staleTtlMs: 7 * DAY,
    allowEmpty: false,
    distributedLockMs: 20_000,
  },
  instrument_metadata: {
    ttlMs: DAY,
    staleTtlMs: 30 * DAY,
    allowEmpty: false,
    distributedLockMs: 15_000,
  },
  ai_analysis: {
    ttlMs: 5 * MINUTE,
    staleTtlMs: 30 * MINUTE,
    allowEmpty: false,
    distributedLockMs: 30_000,
    ttlEnv: "STOCKPILOT_AI_TTL_MS",
    staleEnv: "STOCKPILOT_AI_STALE_TTL_MS",
  },
  forecast: {
    ttlMs: 30_000,
    staleTtlMs: 5 * MINUTE,
    allowEmpty: false,
    distributedLockMs: 15_000,
  },
  professional: {
    ttlMs: 2 * MINUTE,
    staleTtlMs: 10 * MINUTE,
    allowEmpty: false,
    distributedLockMs: 15_000,
    ttlEnv: "STOCKPILOT_PROFESSIONAL_TTL_MS",
    staleEnv: "STOCKPILOT_PROFESSIONAL_STALE_TTL_MS",
  },
};

const requestDefaults: Partial<
  Record<ProviderId, Partial<ProviderRequestPolicy>>
> = {
  alpaca: {
    requestsPerMinute: 200,
    burstCapacity: 20,
    maxConcurrency: 4,
    maxRetries: 1,
  },
  alpha_vantage: {
    requestsPerMinute: 5,
    burstCapacity: 1,
    maxConcurrency: 1,
  },
  twelve_data: {
    requestsPerMinute: 8,
    // Das offizielle Basic-Budget ist acht Credits pro Minute. Ein Burst von
    // nur zwei blockierte den normalen Flow Suche -> Quote -> Historie lokal,
    // obwohl noch sechs Provider-Credits verfuegbar waren.
    burstCapacity: 8,
    maxConcurrency: 2,
    // Drei Versuche wuerden bereits beim Basic-Burstlimit den eigentlichen
    // 5xx-Fehler durch einen lokalen 429 ersetzen.
    maxRetries: 1,
  },
  finnhub: {
    requestsPerMinute: 60,
    burstCapacity: 8,
    maxConcurrency: 4,
  },
  fmp: {
    requestsPerMinute: 60,
    burstCapacity: 8,
    maxConcurrency: 4,
  },
  sec_edgar: {
    requestsPerMinute: 300,
    burstCapacity: 5,
    maxConcurrency: 1,
  },
  fred: {
    requestsPerMinute: 60,
    burstCapacity: 6,
    maxConcurrency: 3,
  },
  ecb: {
    requestsPerMinute: 60,
    burstCapacity: 6,
    maxConcurrency: 3,
  },
  marketaux: {
    requestsPerMinute: 60,
    burstCapacity: 6,
    maxConcurrency: 3,
  },
  newsapi: {
    requestsPerMinute: 60,
    burstCapacity: 6,
    maxConcurrency: 3,
  },
  binance: {
    requestsPerMinute: 600,
    burstCapacity: 40,
    maxConcurrency: 8,
  },
  coinbase: {
    requestsPerMinute: 300,
    burstCapacity: 20,
    maxConcurrency: 8,
  },
};

type ResilienceEnvironment = Readonly<Record<string, string | undefined>>;

function envInteger(
  env: ResilienceEnvironment,
  key: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = key ? Number(env[key]) : Number.NaN;
  return Number.isSafeInteger(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
}

export function getProviderCachePolicy(
  kind: ProviderCacheKind,
  env: ResilienceEnvironment = process.env,
): ProviderCachePolicy {
  const definition = cachePolicies[kind];
  const ttlMs = envInteger(
    env,
    definition.ttlEnv,
    definition.ttlMs,
    1_000,
    30 * DAY,
  );
  const staleTtlMs = Math.max(
    ttlMs,
    envInteger(
      env,
      definition.staleEnv,
      definition.staleTtlMs,
      ttlMs,
      30 * DAY,
    ),
  );

  return {
    kind,
    ttlMs,
    staleTtlMs,
    allowEmpty: definition.allowEmpty,
    distributedLockMs: definition.distributedLockMs,
  };
}

function providerEnvSuffix(providerId: ProviderId | "unknown") {
  return providerId.toUpperCase().replaceAll("-", "_");
}

export function getProviderRequestPolicy(
  providerId: ProviderId | "unknown",
  env: ResilienceEnvironment = process.env,
): ProviderRequestPolicy {
  const overrides = requestDefaults[providerId as ProviderId] ?? {};
  const suffix = providerEnvSuffix(providerId);
  const requestsPerMinute = envInteger(
    env,
    `MARKET_DATA_RATE_LIMIT_${suffix}_PER_MINUTE`,
    overrides.requestsPerMinute ?? 60,
    1,
    60_000,
  );
  const burstCapacity = envInteger(
    env,
    `MARKET_DATA_BURST_${suffix}`,
    Math.min(
      requestsPerMinute,
      overrides.burstCapacity ?? Math.max(1, Math.ceil(requestsPerMinute / 10)),
    ),
    1,
    requestsPerMinute,
  );
  const globalMaxRetries = envInteger(
    env,
    "MARKET_DATA_RETRY_ATTEMPTS",
    2,
    0,
    5,
  );
  const maxRetries = envInteger(
    env,
    `MARKET_DATA_RETRY_ATTEMPTS_${suffix}`,
    Math.min(globalMaxRetries, overrides.maxRetries ?? globalMaxRetries),
    0,
    5,
  );

  return {
    providerId,
    requestsPerMinute,
    burstCapacity,
    maxConcurrency: envInteger(
      env,
      `MARKET_DATA_CONCURRENCY_${suffix}`,
      overrides.maxConcurrency ?? 4,
      1,
      32,
    ),
    maxQueueSize: envInteger(
      env,
      "MARKET_DATA_PROVIDER_MAX_QUEUE",
      100,
      1,
      1_000,
    ),
    queueTimeoutMs: envInteger(
      env,
      "MARKET_DATA_PROVIDER_QUEUE_TIMEOUT_MS",
      1_500,
      100,
      10_000,
    ),
    maxRetries,
    retryBaseDelayMs: envInteger(
      env,
      "MARKET_DATA_RETRY_BASE_DELAY_MS",
      150,
      10,
      5_000,
    ),
    maxRetryDelayMs: envInteger(
      env,
      "MARKET_DATA_RETRY_MAX_DELAY_MS",
      2_000,
      100,
      10_000,
    ),
    circuitFailureThreshold: envInteger(
      env,
      "MARKET_DATA_CIRCUIT_FAILURE_THRESHOLD",
      5,
      2,
      20,
    ),
    circuitOpenMs: envInteger(
      env,
      "MARKET_DATA_CIRCUIT_OPEN_MS",
      30_000,
      1_000,
      30 * MINUTE,
    ),
  };
}
