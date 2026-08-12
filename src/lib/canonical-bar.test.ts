import { describe, expect, it } from "vitest";
import { buildNormalizedBar, CanonicalBarValidationError, normalizeBarSeries, type CanonicalBarInput } from "@/lib/canonical-bar";

const base: CanonicalBarInput = {
  instrumentId: "equity:XNAS:AAPL:USD", providerId: "fmp", providerSymbol: "AAPL", venue: "XNAS",
  symbol: "AAPL", range: "1Y", interval: "1d", openTime: "2026-08-10T00:00:00.000Z",
  closeTime: "2026-08-11T00:00:00.000Z", open: 220, high: 224, low: 219, close: 223,
  adjustedClose: 222.5, adjustedCloseType: "PROVIDER_ADJUSTED_UNSPECIFIED", volume: 12_000,
  tradeCount: 900, vwap: 222, currency: "USD", isAdjusted: false, adjustmentType: "RAW",
  provider: "Financial Modeling Prep", providerTimestamp: "2026-08-11T00:00:00.000Z",
  receivedTimestamp: "2026-08-11T01:00:00.000Z", sessionTimeZone: "America/New_York", quality: "historical",
};

describe("canonical bar", () => {
  it("preserves identity, provenance and explicit raw adjustment semantics", () => {
    const bar = buildNormalizedBar(base, { now: new Date("2026-08-12T00:00:00Z") });
    expect(bar.instrumentId).toBe("equity:XNAS:AAPL:USD");
    expect(bar.interval).toBe("1d");
    expect(bar.adjustmentType).toBe("RAW");
    expect(bar.isAdjusted).toBe(false);
    expect(bar.adjustedCloseType).toBe("PROVIDER_ADJUSTED_UNSPECIFIED");
    expect(bar.qualityStatus).toBe("DELAYED");
  });

  it.each([
    [{ ...base, open: undefined }, "OHLC"],
    [{ ...base, low: 225 }, "OHLC"],
    [{ ...base, volume: -1 }, "Volumen"],
    [{ ...base, closeTime: "2026-08-10T01:00:00Z" }, "Intervall"],
    [{ ...base, isAdjusted: true, adjustmentType: "RAW" }, "Adjustment"],
    [{ ...base, isAdjusted: undefined }, "Adjustment"],
    [{ ...base, vwap: 250 }, "VWAP"],
    [{ ...base, providerTimestamp: "not-a-date" }, "Provider"],
  ])("rejects invalid market bars instead of repairing them", (input, message) => {
    expect(() => buildNormalizedBar(input, { now: new Date("2026-08-12T00:00:00Z") })).toThrowError(new RegExp(message));
  });

  it.each(["SPLIT_ADJUSTED", "DIVIDEND_ADJUSTED", "SPLIT_DIVIDEND_ADJUSTED"] as const)(
    "distinguishes %s OHLC data", (adjustmentType) => {
      const bar = buildNormalizedBar({ ...base, isAdjusted: true, adjustmentType }, { now: new Date("2026-08-12T00:00:00Z") });
      expect(bar.isAdjusted).toBe(true);
      expect(bar.adjustmentType).toBe(adjustmentType);
    },
  );

  it("does not guess currency or completeness", () => {
    const bar = buildNormalizedBar({ ...base, instrumentId: undefined, currency: undefined, venue: undefined }, { now: new Date("2026-08-12T00:00:00Z") });
    expect(bar.currency).toBe("XXX");
    expect(bar.qualityIssues).toEqual(expect.arrayContaining(["instrument_id_missing", "currency_unknown", "venue_missing"]));
  });

  it("deduplicates equal bars and marks conflicting duplicates divergent", () => {
    const series = normalizeBarSeries([base, base, { ...base, close: 221 }], { now: new Date("2026-08-12T00:00:00Z") });
    expect(series.bars).toHaveLength(1);
    expect(series.quality.duplicates).toBe(2);
    expect(series.quality.status).toBe("DIVERGENT");
    expect(series.quality.sufficientForPriceAnalysis).toBe(false);
  });

  it("exposes a typed validation error", () => {
    expect(() => buildNormalizedBar({ ...base, symbol: "<script>" })).toThrow(CanonicalBarValidationError);
  });
});
