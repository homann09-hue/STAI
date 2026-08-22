import { describe, expect, it } from "vitest";
import {
  bindQuotesToCanonicalIdentities,
  canonicalQuoteCacheKey,
  normalizeQuoteProviderId,
  prepareCanonicalQuoteRequest,
  providerSymbolForIdentity,
  resolveStoredCanonicalQuoteMappings,
} from "@/lib/quote-request-identity";

const requestedIds = [
  "stock:xnas:aapl:usd",
  "stock:xetr:aapl:eur",
] as const;

function prepared() {
  const result = prepareCanonicalQuoteRequest(requestedIds);
  if (result.status !== "ready") throw new Error("test setup failed");
  return result.identities;
}

const instrumentRows = [
  {
    id: "instrument-us",
    canonical_id: requestedIds[0],
    symbol: "AAPL",
    asset_class: "stock",
    currency: "USD",
  },
  {
    id: "instrument-de",
    canonical_id: requestedIds[1],
    symbol: "AAPL",
    asset_class: "stock",
    currency: "EUR",
  },
];

const identifierRows = [
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
  {
    instrument_id: "instrument-us",
    identifier_type: "provider_symbol",
    value: "AAPL:XNAS",
    provider: "Twelve Data",
  },
  {
    instrument_id: "instrument-de",
    identifier_type: "provider_symbol",
    value: "AAPL:XETR",
    provider: "Twelve Data",
  },
];

describe("canonical quote request identity", () => {
  it("rejects malformed, unsupported and incomplete canonical IDs", () => {
    expect(prepareCanonicalQuoteRequest(["<script>"]).status).toBe("invalid");
    expect(prepareCanonicalQuoteRequest(["bond:xnas:corp:usd"]).status).toBe(
      "invalid",
    );
    expect(prepareCanonicalQuoteRequest(["stock:xnas:aapl"]).status).toBe(
      "invalid",
    );
    expect(prepareCanonicalQuoteRequest(["stock:xnas:aapl:us"]).status).toBe(
      "invalid",
    );
  });

  it("parses and deduplicates listings without guessing provider symbols", () => {
    const result = prepareCanonicalQuoteRequest([
      ...requestedIds,
      requestedIds[0],
    ]);
    expect(result).toEqual({
      status: "ready",
      identities: [
        {
          canonicalId: requestedIds[0],
          symbol: "AAPL",
          assetType: "stock",
          exchange: "XNAS",
          currency: "USD",
        },
        {
          canonicalId: requestedIds[1],
          symbol: "AAPL",
          assetType: "stock",
          exchange: "XETR",
          currency: "EUR",
        },
      ],
    });
  });

  it("resolves two same-symbol listings to separate provider mappings", () => {
    const result = resolveStoredCanonicalQuoteMappings(
      prepared(),
      instrumentRows,
      identifierRows,
      ["fmp", "twelve_data"],
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.identities).toEqual([
      expect.objectContaining({
        canonicalId: requestedIds[0],
        internalInstrumentId: "instrument-us",
        providerMappings: [
          { providerId: "fmp", providerSymbol: "AAPL" },
          { providerId: "twelve_data", providerSymbol: "AAPL:XNAS" },
        ],
      }),
      expect.objectContaining({
        canonicalId: requestedIds[1],
        internalInstrumentId: "instrument-de",
        providerMappings: [
          { providerId: "fmp", providerSymbol: "AAPL.DE" },
          { providerId: "twelve_data", providerSymbol: "AAPL:XETR" },
        ],
      }),
    ]);
    expect(canonicalQuoteCacheKey(result.providerIds, result.identities)).toBe(
      "quotes:canonical:fmp,twelve_data:stock:xetr:aapl:eur@instrument-de[fmp=AAPL.DE|twelve_data=AAPL:XETR],stock:xnas:aapl:usd@instrument-us[fmp=AAPL|twelve_data=AAPL:XNAS]",
    );
  });

  it("fails closed for unavailable providers, missing instruments and missing mappings", () => {
    expect(
      resolveStoredCanonicalQuoteMappings(prepared(), instrumentRows, [], [
        "mock",
      ]),
    ).toEqual({ status: "provider_unavailable" });
    expect(
      resolveStoredCanonicalQuoteMappings(
        prepared(),
        instrumentRows.slice(0, 1),
        identifierRows,
        ["fmp"],
      ),
    ).toEqual({
      status: "instrument_not_found",
      canonicalIds: [requestedIds[1]],
    });
    expect(
      resolveStoredCanonicalQuoteMappings(
        prepared(),
        instrumentRows,
        identifierRows.filter((row) => row.provider !== "FMP"),
        ["fmp"],
      ),
    ).toEqual({
      status: "provider_mapping_missing",
      canonicalIds: [...requestedIds],
      providerIds: ["fmp"],
    });
  });

  it("rejects contradictory mappings and provider-symbol collisions", () => {
    expect(
      resolveStoredCanonicalQuoteMappings(
        prepared(),
        instrumentRows,
        [
          ...identifierRows,
          {
            instrument_id: "instrument-us",
            identifier_type: "provider_symbol",
            value: "AAPL-US",
            provider: "FMP",
          },
        ],
        ["fmp"],
      ),
    ).toEqual({
      status: "provider_mapping_conflict",
      canonicalId: requestedIds[0],
      providerId: "fmp",
    });
    expect(
      resolveStoredCanonicalQuoteMappings(
        prepared(),
        instrumentRows,
        identifierRows.map((row) =>
          row.provider === "FMP" && row.instrument_id === "instrument-de"
            ? { ...row, value: "AAPL" }
            : row,
        ),
        ["fmp"],
      ),
    ).toEqual({
      status: "provider_symbol_collision",
      providerId: "fmp",
      providerSymbol: "AAPL",
      canonicalIds: [...requestedIds],
    });
  });

  it("rejects stored identity drift before a provider request", () => {
    const result = resolveStoredCanonicalQuoteMappings(
      prepared(),
      instrumentRows.map((row) =>
        row.id === "instrument-de" ? { ...row, currency: "USD" } : row,
      ),
      identifierRows,
      ["fmp"],
    );
    expect(result).toEqual({
      status: "invalid_instrument",
      canonicalIds: [requestedIds[1]],
    });
  });

  it("rejects duplicate Instrument-Master rows for one canonical ID", () => {
    const result = resolveStoredCanonicalQuoteMappings(
      prepared(),
      [...instrumentRows, { ...instrumentRows[0], id: "duplicate-us" }],
      identifierRows,
      ["fmp"],
    );
    expect(result).toEqual({
      status: "invalid_instrument",
      canonicalIds: [requestedIds[0]],
    });
  });

  it("normalizes registered provider aliases but rejects non-quote providers", () => {
    expect(normalizeQuoteProviderId("Twelve Data")).toBe("twelve_data");
    expect(normalizeQuoteProviderId("Polygon.io")).toBe("massive");
    expect(normalizeQuoteProviderId("Financial Modeling Prep")).toBe("fmp");
    expect(normalizeQuoteProviderId("NewsAPI")).toBeNull();
    expect(normalizeQuoteProviderId(null)).toBeNull();
  });

  it("ignores malformed identifier evidence and keeps duplicate equal mappings idempotent", () => {
    const rows = [
      ...identifierRows,
      { ...identifierRows[0] },
      {
        instrument_id: "instrument-us",
        identifier_type: "ticker",
        value: "AAPL",
        provider: "FMP",
      },
      {
        instrument_id: "instrument-us",
        identifier_type: "provider_symbol",
        value: "<script>",
        provider: "FMP",
      },
      {
        instrument_id: "instrument-us",
        identifier_type: "provider_symbol",
        value: "AAPL",
        provider: "NewsAPI",
      },
    ];
    const result = resolveStoredCanonicalQuoteMappings(
      prepared(),
      instrumentRows,
      rows,
      ["fmp"],
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.identities[0].providerMappings).toEqual([
      { providerId: "fmp", providerSymbol: "AAPL" },
    ]);
    expect(providerSymbolForIdentity(result.identities[0], "unknown")).toBeNull();
  });

  it("binds by provider plus provider symbol and preserves the internal ID", () => {
    const result = resolveStoredCanonicalQuoteMappings(
      prepared(),
      instrumentRows,
      identifierRows,
      ["fmp"],
    );
    if (result.status !== "ready") throw new Error("test setup failed");
    const quotes = bindQuotesToCanonicalIdentities(
      [
        {
          symbol: "AAPL",
          providerId: "fmp",
          providerSymbol: "AAPL",
          provider: "FMP",
          price: 200,
          currency: "USD",
          quality: "delayed",
          marketStatus: "closed",
          timestamp: "2026-08-22T10:00:00.000Z",
        },
        {
          symbol: "AAPL.DE",
          providerId: "fmp",
          providerSymbol: "AAPL.DE",
          provider: "FMP",
          price: 185,
          currency: "EUR",
          quality: "delayed",
          marketStatus: "closed",
          timestamp: "2026-08-22T10:00:00.000Z",
        },
      ],
      result.identities,
    );
    expect(quotes).toEqual([
      expect.objectContaining({
        canonicalId: requestedIds[0],
        instrumentId: "instrument-us",
        venue: "XNAS",
        currency: "USD",
      }),
      expect.objectContaining({
        canonicalId: requestedIds[1],
        instrumentId: "instrument-de",
        venue: "XETR",
        currency: "EUR",
      }),
    ]);
  });

  it("drops wrong-provider, wrong-currency and unrequested records", () => {
    const result = resolveStoredCanonicalQuoteMappings(
      prepared(),
      instrumentRows,
      identifierRows,
      ["fmp"],
    );
    if (result.status !== "ready") throw new Error("test setup failed");
    expect(
      bindQuotesToCanonicalIdentities(
        [
          {
            symbol: "AAPL",
            providerId: "finnhub",
            providerSymbol: "AAPL",
            provider: "Finnhub",
            price: 200,
            currency: "USD",
          },
          {
            canonicalId: "stock:xetr:aapl:eur",
            symbol: "AAPL",
            providerId: "fmp",
            providerSymbol: "AAPL",
            provider: "FMP",
            price: 200,
            currency: "USD",
          },
          {
            symbol: "AAPL",
            providerId: "fmp",
            providerSymbol: "AAPL",
            provider: "FMP",
            price: 200,
            currency: "EUR",
          },
          {
            symbol: "MSFT",
            providerId: "fmp",
            providerSymbol: "MSFT",
            provider: "FMP",
            price: 300,
            currency: "USD",
          },
        ],
        result.identities,
      ),
    ).toEqual([]);
  });
});
