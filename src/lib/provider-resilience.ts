import { createHash } from "node:crypto";
import { logEvent } from "@/lib/observability";
import {
  normalizeProviderId,
  type ProviderId,
} from "@/lib/providers/provider-registry";
import {
  getProviderRequestPolicy,
  type ProviderRequestPolicy,
} from "@/lib/resilience-policy";
import { getServerCacheAdapter } from "@/lib/server-cache";

type ResilienceProviderId = ProviderId | "unknown";

type CircuitState = {
  state: "closed" | "open" | "half_open";
  failureCount: number;
  openedAt: number | null;
  nextAttemptAt: number | null;
  lastFailureAt: number | null;
  lastStatus: number | null;
};

type LocalBucket = {
  tokens: number;
  lastRefillAt: number;
};

type ProviderMetrics = {
  requests: number;
  succeeded: number;
  failed: number;
  retries: number;
  deduplicated: number;
  rateLimited: number;
  circuitOpened: number;
};

type ConcurrencyWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type CircuitProbeLease = {
  key: string;
  token: string;
};

export type ProviderRequestContext = {
  providerName: string;
  providerId?: ProviderId;
  requestKey: string;
  operation?: string;
};

export class ProviderCircuitOpenError extends Error {
  constructor(
    readonly providerId: ResilienceProviderId,
    readonly retryAfterMs: number,
  ) {
    super(`${providerId} circuit is open`);
    this.name = "ProviderCircuitOpenError";
  }
}

export class ProviderBudgetExceededError extends Error {
  constructor(
    readonly providerId: ResilienceProviderId,
    readonly retryAfterMs: number,
    message = "Provider request budget exhausted",
  ) {
    super(message);
    this.name = "ProviderBudgetExceededError";
  }
}

export class ProviderConcurrencyError extends Error {
  constructor(readonly providerId: ResilienceProviderId) {
    super(`${providerId} concurrency queue is full`);
    this.name = "ProviderConcurrencyError";
  }
}

const sharedCache = getServerCacheAdapter();
const inFlight = new Map<string, Promise<unknown>>();
const localBuckets = new Map<ResilienceProviderId, LocalBucket>();
const localCircuits = new Map<ResilienceProviderId, CircuitState>();
const activeByProvider = new Map<ResilienceProviderId, number>();
const queues = new Map<ResilienceProviderId, ConcurrencyWaiter[]>();
const metrics = new Map<ResilienceProviderId, ProviderMetrics>();
const MAX_IN_FLIGHT_REQUESTS = 2_000;
const CIRCUIT_STATE_TTL_MS = 24 * 60 * 60 * 1_000;

function emptyMetrics(): ProviderMetrics {
  return {
    requests: 0,
    succeeded: 0,
    failed: 0,
    retries: 0,
    deduplicated: 0,
    rateLimited: 0,
    circuitOpened: 0,
  };
}

function providerMetrics(providerId: ResilienceProviderId) {
  const current = metrics.get(providerId) ?? emptyMetrics();
  metrics.set(providerId, current);
  return current;
}

export function providerIdFromName(providerName: string): ResilienceProviderId {
  const normalized = providerName.trim().toLowerCase();
  const direct = normalizeProviderId(normalized.replaceAll(" ", "_"));
  if (direct) return direct;

  if (/financial modeling|financialmodelingprep|\bfmp\b/.test(normalized)) return "fmp";
  if (/twelve|twelvedata/.test(normalized)) return "twelve_data";
  if (/finnhub/.test(normalized)) return "finnhub";
  if (/alpha|alphavantage/.test(normalized)) return "alpha_vantage";
  if (/massive|polygon/.test(normalized)) return "massive";
  if (/eodhd|eod historical/.test(normalized)) return "eodhd";
  if (/binance/.test(normalized)) return "binance";
  if (/coinbase/.test(normalized)) return "coinbase";
  if (/marketaux/.test(normalized)) return "marketaux";
  if (/newsapi|news api/.test(normalized)) return "newsapi";
  if (/sec|edgar/.test(normalized)) return "sec_edgar";
  if (/fred|st\. louis|stlouisfed/.test(normalized)) return "fred";
  if (/ecb|ezb|european central/.test(normalized)) return "ecb";
  if (/coingecko/.test(normalized)) return "coingecko";
  if (/alpaca/.test(normalized)) return "alpaca";
  if (/databento/.test(normalized)) return "databento";
  return "unknown";
}

export function createProviderRequestKey(
  url: URL,
  representation: string,
): string {
  return createHash("sha256")
    .update(`${representation}:${url.toString()}`)
    .digest("hex")
    .slice(0, 32);
}

function circuitCacheKey(providerId: ResilienceProviderId) {
  return `provider-circuit:${providerId}`;
}

function cooldownCacheKey(providerId: ResilienceProviderId) {
  return `provider-cooldown:${providerId}`;
}

function circuitProbeCacheKey(providerId: ResilienceProviderId) {
  return `provider-circuit-probe:${providerId}`;
}

function budgetCacheKey(providerId: ResilienceProviderId, now: number) {
  return `provider-budget:${providerId}:${Math.floor(now / 60_000)}`;
}

function statusFromError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

function retryAfterFromError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "retryAfterMs" in error &&
    typeof error.retryAfterMs === "number" &&
    Number.isFinite(error.retryAfterMs)
  ) {
    return Math.max(0, error.retryAfterMs);
  }
  return null;
}

function isAbortOrNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError ||
    /network|fetch failed|timeout|timed out|aborted/i.test(error.message)
  );
}

export function classifyProviderFailure(error: unknown) {
  const status = statusFromError(error);
  const retryAfterMs = retryAfterFromError(error);
  const retryable =
    status === 408 ||
    status === 418 ||
    status === 429 ||
    (status !== null && status >= 500 && status <= 599) ||
    (status === null && isAbortOrNetworkError(error));
  const rateLimited = status === 418 || status === 429;
  const circuitFailure =
    (status !== null && status >= 500 && status <= 599) ||
    status === 408 ||
    (status === null && isAbortOrNetworkError(error));

  return {
    status,
    retryAfterMs,
    retryable,
    rateLimited,
    circuitFailure,
  };
}

function refillLocalBucket(
  providerId: ResilienceProviderId,
  policy: ProviderRequestPolicy,
  now: number,
) {
  const existing = localBuckets.get(providerId) ?? {
    tokens: policy.burstCapacity,
    lastRefillAt: now,
  };
  const refillPerMs = policy.requestsPerMinute / 60_000;
  const elapsed = Math.max(0, now - existing.lastRefillAt);
  existing.tokens = Math.min(
    policy.burstCapacity,
    existing.tokens + elapsed * refillPerMs,
  );
  existing.lastRefillAt = now;
  localBuckets.set(providerId, existing);
  return existing;
}

async function consumeProviderBudget(
  providerId: ResilienceProviderId,
  policy: ProviderRequestPolicy,
) {
  const now = Date.now();
  const cooldownUntil =
    (await sharedCache.get<number>(cooldownCacheKey(providerId))) ?? 0;
  if (cooldownUntil > now) {
    providerMetrics(providerId).rateLimited += 1;
    throw new ProviderBudgetExceededError(
      providerId,
      cooldownUntil - now,
      "Provider Retry-After cooldown is active",
    );
  }

  const bucket = refillLocalBucket(providerId, policy, now);
  if (bucket.tokens < 1) {
    const retryAfterMs = Math.ceil(
      (1 - bucket.tokens) / (policy.requestsPerMinute / 60_000),
    );
    providerMetrics(providerId).rateLimited += 1;
    throw new ProviderBudgetExceededError(providerId, retryAfterMs);
  }
  bucket.tokens -= 1;

  const resetAt = (Math.floor(now / 60_000) + 1) * 60_000;
  const count = await sharedCache.increment(
    budgetCacheKey(providerId, now),
    resetAt - now + 1_000,
  );
  if (count > policy.requestsPerMinute) {
    providerMetrics(providerId).rateLimited += 1;
    throw new ProviderBudgetExceededError(providerId, resetAt - now);
  }
}

async function loadCircuit(providerId: ResilienceProviderId) {
  const local = localCircuits.get(providerId);
  if (local?.state === "open") return local;
  const shared = await sharedCache.get<CircuitState>(
    circuitCacheKey(providerId),
  );
  if (shared) {
    localCircuits.set(providerId, shared);
    return shared;
  }
  return (
    local ?? {
      state: "closed",
      failureCount: 0,
      openedAt: null,
      nextAttemptAt: null,
      lastFailureAt: null,
      lastStatus: null,
    }
  );
}

async function acquireCircuitProbe(
  providerId: ResilienceProviderId,
): Promise<CircuitProbeLease> {
  const key = circuitProbeCacheKey(providerId);
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const acquired = await sharedCache.setIfAbsent(key, token, 10_000);
  if (!acquired) {
    throw new ProviderCircuitOpenError(providerId, 1_000);
  }
  return { key, token };
}

async function assertCircuitAllows(
  providerId: ResilienceProviderId,
): Promise<CircuitProbeLease | null> {
  const state = await loadCircuit(providerId);
  const now = Date.now();

  if (
    state.state === "open" &&
    state.nextAttemptAt !== null &&
    state.nextAttemptAt > now
  ) {
    throw new ProviderCircuitOpenError(
      providerId,
      state.nextAttemptAt - now,
    );
  }

  if (state.state === "open") {
    const halfOpen = { ...state, state: "half_open" as const };
    localCircuits.set(providerId, halfOpen);
    await sharedCache.set(
      circuitCacheKey(providerId),
      halfOpen,
      CIRCUIT_STATE_TTL_MS,
    );
    return acquireCircuitProbe(providerId);
  }

  if (state.state === "half_open") {
    return acquireCircuitProbe(providerId);
  }

  return null;
}

async function recordSuccess(providerId: ResilienceProviderId) {
  localCircuits.delete(providerId);
  await sharedCache.delete(circuitCacheKey(providerId));
}

async function recordFailure(
  providerId: ResilienceProviderId,
  policy: ProviderRequestPolicy,
  status: number | null,
) {
  const previous = await loadCircuit(providerId);
  const failureCount = previous.failureCount + 1;
  const now = Date.now();
  const open = failureCount >= policy.circuitFailureThreshold;
  const next: CircuitState = {
    state: open ? "open" : "closed",
    failureCount,
    openedAt: open ? now : null,
    nextAttemptAt: open ? now + policy.circuitOpenMs : null,
    lastFailureAt: now,
    lastStatus: status,
  };
  localCircuits.set(providerId, next);
  await sharedCache.set(
    circuitCacheKey(providerId),
    next,
    CIRCUIT_STATE_TTL_MS,
  );

  if (open && previous.state !== "open") {
    providerMetrics(providerId).circuitOpened += 1;
    logEvent("warn", "provider.circuit_opened", {
      providerId,
      failureCount,
      retryInMs: policy.circuitOpenMs,
      status,
    });
  }
}

function releaseConcurrency(providerId: ResilienceProviderId) {
  const active = Math.max(0, (activeByProvider.get(providerId) ?? 1) - 1);
  activeByProvider.set(providerId, active);

  const queue = queues.get(providerId);
  const next = queue?.shift();
  if (!next) return;
  clearTimeout(next.timeout);
  activeByProvider.set(providerId, active + 1);
  next.resolve();
}

async function acquireConcurrency(
  providerId: ResilienceProviderId,
  policy: ProviderRequestPolicy,
) {
  const active = activeByProvider.get(providerId) ?? 0;
  if (active < policy.maxConcurrency) {
    activeByProvider.set(providerId, active + 1);
    return;
  }

  const queue = queues.get(providerId) ?? [];
  if (queue.length >= policy.maxQueueSize) {
    throw new ProviderConcurrencyError(providerId);
  }

  await new Promise<void>((resolve, reject) => {
    const waiter: ConcurrencyWaiter = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        const current = queues.get(providerId) ?? [];
        const index = current.indexOf(waiter);
        if (index >= 0) current.splice(index, 1);
        reject(new ProviderConcurrencyError(providerId));
      }, policy.queueTimeoutMs),
    };
    queue.push(waiter);
    queues.set(providerId, queue);
  });
}

function retryDelayMs(
  attempt: number,
  policy: ProviderRequestPolicy,
  retryAfterMs: number | null,
) {
  if (retryAfterMs !== null) return retryAfterMs;
  const exponential = Math.min(
    policy.maxRetryDelayMs,
    policy.retryBaseDelayMs * 2 ** attempt,
  );
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runProviderRequest<T>(
  providerId: ResilienceProviderId,
  context: ProviderRequestContext,
  operation: () => Promise<T>,
) {
  const policy = getProviderRequestPolicy(providerId);
  const currentMetrics = providerMetrics(providerId);
  currentMetrics.requests += 1;
  const circuitProbe = await assertCircuitAllows(providerId);
  let concurrencyAcquired = false;

  try {
    await acquireConcurrency(providerId, policy);
    concurrencyAcquired = true;
    let lastError: unknown;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
      await consumeProviderBudget(providerId, policy);

      try {
        const value = await operation();
        currentMetrics.succeeded += 1;
        await recordSuccess(providerId);
        return value;
      } catch (error) {
        lastError = error;
        const failure = classifyProviderFailure(error);

        if (failure.rateLimited) {
          const cooldownMs =
            failure.retryAfterMs ?? policy.retryBaseDelayMs * 2 ** attempt;
          await sharedCache.set(
            cooldownCacheKey(providerId),
            Date.now() + cooldownMs,
            Math.max(1_000, cooldownMs),
          );
        }

        const canRetry =
          failure.retryable && attempt < policy.maxRetries;
        if (!canRetry) {
          if (failure.circuitFailure) {
            await recordFailure(providerId, policy, failure.status);
          }
          currentMetrics.failed += 1;
          throw error;
        }

        const delayMs = retryDelayMs(
          attempt,
          policy,
          failure.retryAfterMs,
        );
        if (delayMs > policy.maxRetryDelayMs) {
          currentMetrics.failed += 1;
          throw error;
        }

        currentMetrics.retries += 1;
        logEvent("warn", "provider.request_retry", {
          providerId,
          operation: context.operation ?? "request",
          attempt: attempt + 1,
          delayMs,
          status: failure.status,
        });
        await sleep(delayMs);
      }
    }

    currentMetrics.failed += 1;
    throw lastError;
  } finally {
    if (concurrencyAcquired) releaseConcurrency(providerId);
    if (circuitProbe) {
      await sharedCache.deleteIfValue(circuitProbe.key, circuitProbe.token);
    }
  }
}

export async function executeProviderRequest<T>(
  context: ProviderRequestContext,
  operation: () => Promise<T>,
): Promise<T> {
  const providerId =
    context.providerId ?? providerIdFromName(context.providerName);
  const dedupeKey = `${providerId}:${context.requestKey}`;
  const existing = inFlight.get(dedupeKey) as Promise<T> | undefined;

  if (existing) {
    providerMetrics(providerId).deduplicated += 1;
    return existing;
  }

  const request = runProviderRequest(
    providerId,
    context,
    operation,
  ).finally(() => {
    inFlight.delete(dedupeKey);
  });

  if (inFlight.size < MAX_IN_FLIGHT_REQUESTS) {
    inFlight.set(dedupeKey, request);
  }

  return request;
}

export function getProviderResilienceSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    sharedCache: sharedCache.sharedConfigured,
    inFlight: inFlight.size,
    providers: [...new Set([
      ...metrics.keys(),
      ...localCircuits.keys(),
      ...activeByProvider.keys(),
    ])].map((providerId) => ({
      providerId,
      metrics: { ...(metrics.get(providerId) ?? emptyMetrics()) },
      circuit: localCircuits.get(providerId) ?? null,
      active: activeByProvider.get(providerId) ?? 0,
      queued: queues.get(providerId)?.length ?? 0,
    })),
  };
}

export async function resetProviderResilienceForTests() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Provider resilience state may only be reset in tests.");
  }
  inFlight.clear();
  localBuckets.clear();
  localCircuits.clear();
  activeByProvider.clear();
  for (const queue of queues.values()) {
    for (const waiter of queue) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("Provider resilience reset"));
    }
  }
  queues.clear();
  metrics.clear();
  await sharedCache.clear();
}
