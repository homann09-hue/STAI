import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  FmpClient,
  FmpClientError,
  type FmpTransport,
  fmpRowsSchema,
  getFmpAdapterContract,
} from "@/lib/providers/fmp-client";
import { ProviderHttpResponseError } from "@/lib/providers/http-json";

function transport(data: unknown) {
  return vi.fn<FmpTransport>(async () => ({ data, latencyMs: 7 }));
}

describe("FMP client contract", () => {
  it("builds only allowlisted requests and never returns the key", async () => {
    const send = transport([{ symbol: "AAPL", price: 200 }]);
    const client = new FmpClient({ apiKey: "secret-key", transport: send });
    const response = await client.request("quote", { symbol: "AAPL" }, fmpRowsSchema);

    expect(response.data).toEqual([{ symbol: "AAPL", price: 200 }]);
    const url = send.mock.calls[0]![0];
    expect(url.pathname).toBe("/stable/quote");
    expect(url.searchParams.get("apikey")).toBe("secret-key");
    expect(JSON.stringify(response)).not.toContain("secret-key");
  });

  it("fails closed without a key or with an unsafe base URL", () => {
    expect(() => new FmpClient({ apiKey: "" })).toThrow("FMP_API_KEY fehlt");
    expect(() => new FmpClient({ apiKey: "x", baseUrl: "http://127.0.0.1" })).toThrow("nicht freigegeben");
  });

  it("rejects unknown parameters, invalid symbols and path casts", async () => {
    const client = new FmpClient({ apiKey: "x", transport: transport([]) });
    await expect(client.request("quote", { symbol: "AAPL", url: "x" }, fmpRowsSchema)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(client.request("quote", { symbol: "../../secret" }, fmpRowsSchema)).rejects.toMatchObject({ code: "invalid_request" });
    await expect(client.request("not-real" as "quote", {}, fmpRowsSchema)).rejects.toMatchObject({ code: "invalid_request" });
  });

  it.each([
    [401, "authentication", false],
    [402, "not_entitled", false],
    [403, "not_entitled", false],
    [404, "invalid_request", false],
    [429, "rate_limited", true],
    [503, "unavailable", true],
  ] as const)("maps HTTP %s to %s", async (status, code, retryable) => {
    const send = vi.fn(async () => {
      throw new ProviderHttpResponseError("FMP", status);
    });
    const client = new FmpClient({ apiKey: "secret", transport: send });

    await expect(client.request("quote", { symbol: "AAPL" }, fmpRowsSchema)).rejects.toMatchObject({
      name: "FmpClientError",
      code,
      status,
      retryable,
    } satisfies Partial<FmpClientError>);
  });

  it("rejects malformed provider payloads without exposing raw data", async () => {
    const client = new FmpClient({ apiKey: "secret", transport: transport({ error: "secret payload" }) });
    const request = client.request("quote", { symbol: "AAPL" }, z.array(z.object({ price: z.number() })));

    await expect(request).rejects.toMatchObject({ code: "invalid_response", retryable: false });
    await expect(request).rejects.not.toThrow("secret payload");
  });

  it("publishes a secret-free adapter contract", () => {
    const contract = getFmpAdapterContract();
    expect(contract.providerId).toBe("fmp");
    expect(contract.endpoints).toContain("historical-price-eod/full");
    expect(JSON.stringify(contract)).not.toContain("secret-key");
    expect(JSON.stringify(contract)).not.toContain(process.env.FMP_API_KEY ?? "value-that-is-not-present");
  });
});
