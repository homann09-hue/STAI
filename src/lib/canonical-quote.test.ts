import { describe, expect, it } from "vitest";
import {
  buildNormalizedQuote,
  normalizeCanonicalQuoteRecord,
} from "@/lib/canonical-quote";

const now = new Date("2026-08-12T10:00:00.000Z");

function completeQuote(
  overrides: Partial<Parameters<typeof buildNormalizedQuote>[0]> = {},
) {
  return buildNormalizedQuote(
    {
      canonicalId: "stock:nasdaq:aapl:usd",
      instrumentId: "stock:nasdaq:aapl:usd",
      symbol: "AAPL",
      assetType: "stock",
      providerId: "test_provider",
      providerSymbol: "AAPL",
      venue: "XNAS",
      currency: "USD",
      bid: 199.99,
      bidSize: 20,
      ask: 200.01,
      askSize: 15,
      last: 200,
      lastSize: 5,
      open: 198,
      high: 202,
      low: 197,
      previousClose: 199,
      volume: 1_000,
      vwap: 199.5,
      marketStatus: "open",
      eventTimestamp: "2026-08-12T09:59:59.000Z",
      providerTimestamp: "2026-08-12T09:59:59.000Z",
      receivedTimestamp: "2026-08-12T10:00:00.000Z",
      provider: "Test Provider",
      quality: "realtime",
      reportedDelaySeconds: 0,
      ...overrides,
    },
    { now },
  );
}

describe("kanonisches Quote-Modell", () => {
  it("bildet Provider-, Venue-, Zeit- und Feed-Provenienz vollstaendig ab", () => {
    const quote = completeQuote();

    expect(quote).toMatchObject({
      canonicalId: "stock:nasdaq:aapl:usd",
      instrumentId: "stock:nasdaq:aapl:usd",
      providerId: "test_provider",
      providerSymbol: "AAPL",
      venue: "XNAS",
      last: 200,
      price: 200,
      marketSession: "REGULAR",
      eventTimestamp: "2026-08-12T09:59:59.000Z",
      providerTimestamp: "2026-08-12T09:59:59.000Z",
      receivedTimestamp: "2026-08-12T10:00:00.000Z",
      feedType: "REALTIME",
      qualityStatus: "OK",
      qualityScore: 100,
      isRealtime: true,
    });
  });

  it("bezeichnet einen Realtime-Feed ohne belegte Null-Verzoegerung nicht als realtime", () => {
    const quote = completeQuote({ reportedDelaySeconds: null });

    expect(quote.isRealtime).toBe(false);
    expect(quote.qualityStatus).toBe("PARTIAL");
    expect(quote.qualityIssues).toContain("realtime_delay_unverified");
  });

  it("markiert verzoegerte Daten unabhaengig vom Marktnamen als DELAYED", () => {
    const quote = completeQuote({
      quality: "delayed",
      reportedDelaySeconds: 900,
    });

    expect(quote.feedType).toBe("DELAYED");
    expect(quote.qualityStatus).toBe("DELAYED");
    expect(quote.isRealtime).toBe(false);
  });

  it("entfernt ein gekreuztes Bid/Ask und sperrt die Quote als INVALID", () => {
    const quote = completeQuote({ bid: 201, ask: 200 });

    expect(quote.bid).toBeNull();
    expect(quote.ask).toBeNull();
    expect(quote.qualityStatus).toBe("INVALID");
    expect(quote.qualityScore).toBe(0);
    expect(quote.qualityIssues).toContain("crossed_market");
  });

  it("bewahrt einen bereits erkannten INVALID-Status beim API-Roundtrip", () => {
    const invalid = completeQuote({ bid: 201, ask: 200 });
    const normalized = normalizeCanonicalQuoteRecord(invalid, { now });

    expect(normalized?.qualityStatus).toBe("INVALID");
    expect(normalized?.qualityScore).toBe(0);
    expect(normalized?.qualityIssues).toContain("crossed_market");
    expect(normalized?.isRealtime).toBe(false);
  });

  it("unterscheidet alte Near-Realtime-Daten von einem langsamen aktuellen Abruf", () => {
    const quote = completeQuote({
      quality: "near_realtime",
      eventTimestamp: "2026-08-12T09:55:00.000Z",
      providerTimestamp: "2026-08-12T09:55:00.000Z",
    });

    expect(quote.qualityStatus).toBe("STALE");
    expect(quote.isRealtime).toBe(false);
    expect(quote.qualityScore).toBeLessThanOrEqual(35);
  });

  it("kennzeichnet einen geschlossenen Markt getrennt von Feedqualitaet", () => {
    const quote = completeQuote({
      marketStatus: "closed",
      quality: "delayed",
      reportedDelaySeconds: 900,
    });

    expect(quote.marketSession).toBe("CLOSED");
    expect(quote.feedType).toBe("DELAYED");
    expect(quote.qualityStatus).toBe("MARKET_CLOSED");
  });

  it("verwirft unbrauchbare API-Kurse statt sie als null Euro zu publizieren", () => {
    expect(
      normalizeCanonicalQuoteRecord({
        symbol: "AAPL",
        providerId: "test",
        provider: "Test",
        price: 0,
      }),
    ).toBeNull();
  });
});
