import { beforeEach, describe, expect, it, vi } from "vitest";

const { boundedFetch } = vi.hoisted(() => ({
  boundedFetch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/providers/http-json", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/providers/http-json")
  >();
  return {
    ...original,
    fetchBoundedProviderJson: boundedFetch,
  };
});

import { pingProviderEndpoint } from "@/lib/provider-ping";
import { ProviderHttpResponseError } from "@/lib/providers/http-json";

describe("pingProviderEndpoint", () => {
  beforeEach(() => {
    boundedFetch.mockReset();
  });

  it("verbraucht ohne Konfiguration weder Netzwerk noch Provider-Budget", async () => {
    const result = await pingProviderEndpoint(
      "newsapi",
      "NewsAPI",
      null,
      false,
    );

    expect(result.status).toBe("missing_key");
    expect(result.latencyMs).toBeNull();
    expect(boundedFetch).not.toHaveBeenCalled();
  });

  it("nutzt ausschließlich den begrenzten Provider-HTTP-Layer", async () => {
    boundedFetch.mockResolvedValue({
      data: {},
      latencyMs: 42,
      responseHeaders: {},
    });
    const url = new URL(
      "https://newsapi.org/v2/top-headlines?language=en&pageSize=1",
    );

    const result = await pingProviderEndpoint(
      "newsapi",
      "NewsAPI",
      url,
      true,
      { requestHeaders: { "X-Api-Key": "server-secret" } },
    );

    expect(result).toMatchObject({ status: "ok", latencyMs: 42 });
    expect(url.toString()).not.toContain("server-secret");
    expect(boundedFetch).toHaveBeenCalledWith(
      url,
      "NewsAPI",
      expect.objectContaining({
        maxBytes: 128_000,
        timeoutMs: 2_500,
        requestHeaders: { "X-Api-Key": "server-secret" },
      }),
    );
  });

  it("klassifiziert ein Provider-Rate-Limit als eingeschränkt", async () => {
    boundedFetch.mockRejectedValue(
      new ProviderHttpResponseError("NewsAPI", 429, 60_000),
    );

    const result = await pingProviderEndpoint(
      "newsapi",
      "NewsAPI",
      new URL("https://newsapi.org/v2/top-headlines?language=en&pageSize=1"),
      true,
    );

    expect(result.status).toBe("degraded");
    expect(result.message).toBe("Rate-Limit aktiv.");
  });

  it("gibt bei ungültiger Antwort keine internen Fehlerdetails aus", async () => {
    boundedFetch.mockRejectedValue(
      new Error("secret-token=should-never-reach-the-client"),
    );

    const result = await pingProviderEndpoint(
      "coinbase",
      "Coinbase",
      new URL("https://api.coinbase.com/v2/prices/BTC-USD/spot"),
      true,
    );

    expect(result.status).toBe("error");
    expect(result.message).not.toContain("secret-token");
  });
});
