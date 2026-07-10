import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoundedProviderJson, readBoundedResponseText } from "@/lib/providers/http-json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("bounded provider JSON", () => {
  it("accepts JSON only from an HTTPS allowlisted provider", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ price: 42 }), {
        status: 200,
        headers: { "content-type": "application/json", "content-length": "12" }
      })
    );
    vi.stubGlobal("fetch", fetchImpl);

    const result = await fetchBoundedProviderJson<{ price: number }>(new URL("https://finnhub.io/api/quote"), "Finnhub", {
      timeoutMs: 1_000,
      maxBytes: 64_000
    });

    expect(result.data).toEqual({ price: 42 });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("blocks private, unknown and non-HTTPS provider destinations", async () => {
    await expect(fetchBoundedProviderJson(new URL("http://finnhub.io/api"), "Provider")).rejects.toThrow("HTTPS");
    await expect(fetchBoundedProviderJson(new URL("https://127.0.0.1/api"), "Provider")).rejects.toThrow("nicht freigegeben");
    await expect(fetchBoundedProviderJson(new URL("https://example.invalid/api"), "Provider")).rejects.toThrow("nicht freigegeben");
  });

  it("rejects oversized and non-JSON responses before parsing", async () => {
    await expect(
      readBoundedResponseText(
        new Response("{}", { headers: { "content-type": "application/json", "content-length": "100000" } }),
        "Provider",
        64_000
      )
    ).rejects.toThrow("zu groß");

    await expect(
      readBoundedResponseText(new Response("not json", { headers: { "content-type": "text/html" } }), "Provider", 64_000)
    ).rejects.toThrow("keine JSON");
  });
});
