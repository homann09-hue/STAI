import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicRuntimeDiagnostics, logEvent } from "./observability";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.STOCKPILOT_TEST_LOGS;
});

describe("observability diagnostics", () => {
  it("exposes provider configuration without leaking secret values", () => {
    process.env.FMP_API_KEY = "secret-value";
    process.env.STOCKPILOT_NEWS_PROVIDER = "marketaux";

    const diagnostics = getPublicRuntimeDiagnostics();

    expect(diagnostics.app).toBe("stockpilot-ai");
    expect(diagnostics.configured.fmp).toBe(true);
    expect(diagnostics.providers.news).toBe("marketaux");
    expect(JSON.stringify(diagnostics)).not.toContain("secret-value");
  });

  it("writes structured logs and redacts sensitive fields", () => {
    process.env.STOCKPILOT_TEST_LOGS = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logEvent("info", "observability.info", { apiKey: "secret", nested: { token: "hidden", value: 1 } });
    logEvent("warn", "observability.warn", { warning: "cache" });
    logEvent("error", "observability.error", { error: new Error("provider failed") });

    expect(info).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();

    const infoPayload = JSON.parse(String(info.mock.calls[0]?.[0]));
    const errorPayload = JSON.parse(String(error.mock.calls[0]?.[0]));

    expect(infoPayload.apiKey).toBe("[REDACTED]");
    expect(infoPayload.nested.token).toBe("[REDACTED]");
    expect(infoPayload.nested.value).toBe(1);
    expect(errorPayload.error.message).toBe("provider failed");
    expect(JSON.stringify(infoPayload)).not.toContain("secret");
  });
});
