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
    limit: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
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
});
