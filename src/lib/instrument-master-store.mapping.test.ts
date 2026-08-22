import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient, logEvent } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServiceClient }));
vi.mock("@/lib/observability", () => ({ logEvent }));

import { resolveCanonicalQuoteIdentities } from "@/lib/instrument-master-store";
import { prepareCanonicalQuoteRequest } from "@/lib/quote-request-identity";

function query(result: {
  data: Array<Record<string, unknown>> | null;
  error: { code: string; message: string } | null;
}) {
  const chain = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    abortSignal: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function requestIdentities() {
  const prepared = prepareCanonicalQuoteRequest([
    "stock:xnas:aapl:usd",
    "stock:xetr:aapl:eur",
  ]);
  if (prepared.status !== "ready") throw new Error("test setup failed");
  return prepared.identities;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Instrument Master canonical quote mapping store", () => {
  it("fails closed when the server-side reference store is unavailable", async () => {
    createSupabaseServiceClient.mockReturnValue(null);
    await expect(
      resolveCanonicalQuoteIdentities(requestIdentities(), ["fmp"]),
    ).resolves.toEqual({ status: "store_unavailable" });
  });

  it("loads instruments and provider identifiers in bounded batches", async () => {
    const instrumentQuery = query({
      data: [
        {
          id: "instrument-us",
          canonical_id: "stock:xnas:aapl:usd",
          symbol: "AAPL",
          asset_class: "stock",
          currency: "USD",
        },
        {
          id: "instrument-de",
          canonical_id: "stock:xetr:aapl:eur",
          symbol: "AAPL",
          asset_class: "stock",
          currency: "EUR",
        },
      ],
      error: null,
    });
    const identifierQuery = query({
      data: [
        {
          instrument_id: "instrument-us",
          identifier_type: "provider_symbol",
          value: "AAPL",
          provider: "FMP",
        },
        {
          instrument_id: "instrument-de",
          identifier_type: "provider_symbol",
          value: "AAPL.DE",
          provider: "FMP",
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "instruments" ? instrumentQuery : identifierQuery,
    );
    createSupabaseServiceClient.mockReturnValue({ from });

    const result = await resolveCanonicalQuoteIdentities(
      requestIdentities(),
      ["fmp"],
    );

    expect(result.status).toBe("ready");
    expect(instrumentQuery.in).toHaveBeenCalledWith("canonical_id", [
      "stock:xnas:aapl:usd",
      "stock:xetr:aapl:eur",
    ]);
    expect(identifierQuery.in).toHaveBeenCalledWith("instrument_id", [
      "instrument-us",
      "instrument-de",
    ]);
    expect(identifierQuery.eq).toHaveBeenCalledWith(
      "identifier_type",
      "provider_symbol",
    );
  });

  it("does not reinterpret database errors as missing instruments", async () => {
    const instrumentQuery = query({
      data: null,
      error: { code: "08006", message: "connection failed" },
    });
    const from = vi.fn(() => instrumentQuery);
    createSupabaseServiceClient.mockReturnValue({ from });

    await expect(
      resolveCanonicalQuoteIdentities(requestIdentities(), ["fmp"]),
    ).resolves.toEqual({ status: "store_unavailable" });
    expect(logEvent).toHaveBeenCalledWith(
      "warn",
      "instrument_master.canonical_mapping_lookup_failed",
      expect.objectContaining({ code: "08006", requested: 2 }),
    );
  });

  it("aborts a stalled Instrument-Master request after the bounded timeout", async () => {
    const instrumentQuery = query({ data: null, error: null });
    instrumentQuery.abortSignal.mockImplementation(
      (signal: AbortSignal) =>
        new Promise((resolve) => {
          signal.addEventListener(
            "abort",
            () =>
              resolve({
                data: null,
                error: { code: "20", message: "request aborted" },
              }),
            { once: true },
          );
        }),
    );
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => instrumentQuery),
    });

    const resolution = resolveCanonicalQuoteIdentities(
      requestIdentities(),
      ["fmp"],
      10,
    );
    await expect(resolution).resolves.toEqual({ status: "store_unavailable" });
    expect(instrumentQuery.abortSignal).toHaveBeenCalledWith(
      expect.any(AbortSignal),
    );
  });

  it("normalizes a thrown fetch abort without leaking an exception", async () => {
    const instrumentQuery = query({ data: null, error: null });
    instrumentQuery.abortSignal.mockRejectedValue(
      new DOMException("request aborted", "AbortError"),
    );
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => instrumentQuery),
    });

    await expect(
      resolveCanonicalQuoteIdentities(requestIdentities(), ["fmp"], 10),
    ).resolves.toEqual({ status: "store_unavailable" });
    expect(logEvent).toHaveBeenCalledWith(
      "warn",
      "instrument_master.canonical_mapping_lookup_failed",
      { message: "request aborted", requested: 2 },
    );
  });

  it("fails closed when the provider-identifier query reports an error", async () => {
    const instrumentQuery = query({
      data: [
        {
          id: "instrument-us",
          canonical_id: "stock:xnas:aapl:usd",
          symbol: "AAPL",
          asset_class: "stock",
          currency: "USD",
        },
      ],
      error: null,
    });
    const identifierQuery = query({
      data: null,
      error: { code: "08006", message: "identifier lookup failed" },
    });
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "instruments" ? instrumentQuery : identifierQuery,
      ),
    });

    await expect(
      resolveCanonicalQuoteIdentities(
        requestIdentities().slice(0, 1),
        ["fmp"],
      ),
    ).resolves.toEqual({ status: "store_unavailable" });
    expect(logEvent).toHaveBeenCalledWith(
      "warn",
      "instrument_master.provider_mapping_lookup_failed",
      expect.objectContaining({ code: "08006", requested: 1 }),
    );
  });

  it("normalizes a thrown identifier-query abort", async () => {
    const instrumentQuery = query({
      data: [
        {
          id: "instrument-us",
          canonical_id: "stock:xnas:aapl:usd",
          symbol: "AAPL",
          asset_class: "stock",
          currency: "USD",
        },
      ],
      error: null,
    });
    const identifierQuery = query({ data: null, error: null });
    identifierQuery.abortSignal.mockRejectedValue(
      new DOMException("identifier request aborted", "AbortError"),
    );
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "instruments" ? instrumentQuery : identifierQuery,
      ),
    });

    await expect(
      resolveCanonicalQuoteIdentities(
        requestIdentities().slice(0, 1),
        ["fmp"],
        10,
      ),
    ).resolves.toEqual({ status: "store_unavailable" });
    expect(logEvent).toHaveBeenCalledWith(
      "warn",
      "instrument_master.provider_mapping_lookup_failed",
      { message: "identifier request aborted", requested: 1 },
    );
  });
});
