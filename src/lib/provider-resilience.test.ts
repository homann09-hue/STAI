import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyProviderFailure,
  createProviderRequestKey,
  executeProviderRequest,
  getProviderResilienceSnapshot,
  providerIdFromName,
  resetProviderResilienceForTests,
} from "@/lib/provider-resilience";

class HttpFailure extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | null = null,
  ) {
    super(`HTTP ${status}`);
  }
}

describe("provider resilience", () => {
  beforeEach(async () => {
    vi.stubEnv("MARKET_DATA_RETRY_ATTEMPTS", "2");
    vi.stubEnv("MARKET_DATA_RETRY_BASE_DELAY_MS", "10");
    vi.stubEnv("MARKET_DATA_RETRY_MAX_DELAY_MS", "100");
    vi.stubEnv("MARKET_DATA_RATE_LIMIT_FINNHUB_PER_MINUTE", "1000");
    vi.stubEnv("MARKET_DATA_BURST_FINNHUB", "1000");
    await resetProviderResilienceForTests();
  });

  afterEach(async () => {
    await resetProviderResilienceForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("normalizes provider names and hashes secret-bearing URLs", () => {
    const url = new URL("https://finnhub.io/api/v1/quote?token=secret");
    const key = createProviderRequestKey(url, "json");

    expect(providerIdFromName("finnhub.io")).toBe("finnhub");
    expect(providerIdFromName("financialmodelingprep.com")).toBe("fmp");
    expect(key).toHaveLength(32);
    expect(key).not.toContain("secret");
  });

  it("never retries authentication, entitlement or invalid request failures", async () => {
    for (const status of [400, 401, 402, 403, 404]) {
      const operation = vi.fn().mockRejectedValue(new HttpFailure(status));
      await expect(
        executeProviderRequest(
          { providerName: "Finnhub", requestKey: `no-retry-${status}` },
          operation,
        ),
      ).rejects.toMatchObject({ status });
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });

  it("retries transient server failures and succeeds", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new HttpFailure(503))
      .mockResolvedValue("ok");

    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "retry-success" },
        operation,
      ),
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("coalesces identical concurrent requests", async () => {
    let release: ((value: string) => void) | undefined;
    const operation = vi.fn(
      () => new Promise<string>((resolve) => { release = resolve; }),
    );

    const first = executeProviderRequest(
      { providerName: "Finnhub", requestKey: "same-request" },
      operation,
    );
    const second = executeProviderRequest(
      { providerName: "Finnhub", requestKey: "same-request" },
      operation,
    );
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(1));
    release?.("shared");

    await expect(Promise.all([first, second])).resolves.toEqual([
      "shared",
      "shared",
    ]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(
      getProviderResilienceSnapshot().providers[0]?.metrics.deduplicated,
    ).toBe(1);
  });

  it("classifies only transient failures as retryable", () => {
    expect(classifyProviderFailure(new HttpFailure(429, 500))).toMatchObject({
      retryable: true,
      rateLimited: true,
      circuitFailure: false,
    });
    expect(classifyProviderFailure(new HttpFailure(403))).toMatchObject({
      retryable: false,
      circuitFailure: false,
    });
    expect(classifyProviderFailure(new TypeError("fetch failed"))).toMatchObject({
      retryable: true,
      circuitFailure: true,
    });
  });

  it("opens a circuit after repeated transient failures and recovers half-open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T10:00:00.000Z"));
    vi.stubEnv("MARKET_DATA_RETRY_ATTEMPTS", "0");
    vi.stubEnv("MARKET_DATA_CIRCUIT_FAILURE_THRESHOLD", "2");
    vi.stubEnv("MARKET_DATA_CIRCUIT_OPEN_MS", "1000");
    const failure = vi.fn().mockRejectedValue(new HttpFailure(503));

    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "failure-1" },
        failure,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "failure-2" },
        failure,
      ),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "blocked" },
        vi.fn().mockResolvedValue("not-called"),
      ),
    ).rejects.toMatchObject({ name: "ProviderCircuitOpenError" });

    vi.advanceTimersByTime(1001);
    let releaseRecovery: ((value: string) => void) | undefined;
    const recoveryOperation = vi.fn(
      () => new Promise<string>((resolve) => { releaseRecovery = resolve; }),
    );
    const recovery = executeProviderRequest(
      { providerName: "Finnhub", requestKey: "recovery" },
      recoveryOperation,
    );
    await vi.waitFor(() => expect(recoveryOperation).toHaveBeenCalledTimes(1));
    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "second-recovery-probe" },
        vi.fn().mockResolvedValue("must-not-run"),
      ),
    ).rejects.toMatchObject({ name: "ProviderCircuitOpenError" });
    releaseRecovery?.("recovered");
    await expect(recovery).resolves.toBe("recovered");
    expect(
      getProviderResilienceSnapshot().providers.find(
        (provider) => provider.providerId === "finnhub",
      )?.circuit,
    ).toBeNull();
    vi.useRealTimers();
  });

  it("does not wait inside a serverless request for a long Retry-After", async () => {
    const operation = vi.fn().mockRejectedValue(new HttpFailure(429, 60_000));

    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "long-retry-after" },
        operation,
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("isolates an open provider circuit from healthy providers", async () => {
    vi.stubEnv("MARKET_DATA_RETRY_ATTEMPTS", "0");
    vi.stubEnv("MARKET_DATA_CIRCUIT_FAILURE_THRESHOLD", "2");
    const failing = vi.fn().mockRejectedValue(new HttpFailure(503));

    for (const requestKey of ["isolation-1", "isolation-2"]) {
      await expect(
        executeProviderRequest(
          { providerName: "Finnhub", requestKey },
          failing,
        ),
      ).rejects.toMatchObject({ status: 503 });
    }

    await expect(
      executeProviderRequest(
        { providerName: "Binance", requestKey: "healthy-provider" },
        vi.fn().mockResolvedValue("healthy"),
      ),
    ).resolves.toBe("healthy");
  });

  it("fails fast when a provider request budget is exhausted", async () => {
    vi.stubEnv("MARKET_DATA_RATE_LIMIT_FINNHUB_PER_MINUTE", "1");
    vi.stubEnv("MARKET_DATA_BURST_FINNHUB", "1");
    vi.stubEnv("MARKET_DATA_RETRY_ATTEMPTS", "0");

    await executeProviderRequest(
      { providerName: "Finnhub", requestKey: "budget-first" },
      vi.fn().mockResolvedValue("first"),
    );
    await expect(
      executeProviderRequest(
        { providerName: "Finnhub", requestKey: "budget-second" },
        vi.fn().mockResolvedValue("second"),
      ),
    ).rejects.toMatchObject({ name: "ProviderBudgetExceededError" });
  });
});
