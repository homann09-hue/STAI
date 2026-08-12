import { describe, expect, it } from "vitest";
import { assessHistoricalDataIntegrity } from "@/lib/analysis/history-integrity";

const observation = (day: number, adjustmentType: "RAW" | "SPLIT_ADJUSTED" | "DIVIDEND_ADJUSTED" | "SPLIT_DIVIDEND_ADJUSTED") => ({
  timestamp: `2024-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
  close: 100 + day,
  isAdjusted: adjustmentType !== "RAW",
  adjustmentType,
});

describe("historical OHLC adjustment integrity", () => {
  it.each([
    ["SPLIT_ADJUSTED", "split_adjusted_ohlc"],
    ["DIVIDEND_ADJUSTED", "dividend_adjusted_ohlc"],
    ["SPLIT_DIVIDEND_ADJUSTED", "split_dividend_adjusted_ohlc"],
  ] as const)("classifies %s independently", (adjustmentType, expected) => {
    const integrity = assessHistoricalDataIntegrity([
      observation(1, adjustmentType),
      observation(2, adjustmentType),
    ]);
    expect(integrity.priceBasis).toBe("adjusted_ohlc");
    expect(integrity.corporateActionAdjustment).toBe(expected);
    expect(integrity.backtestStatus).toBe("usable_with_limitations");
  });

  it("blocks a raw/adjusted mixture", () => {
    const integrity = assessHistoricalDataIntegrity([
      observation(1, "RAW"),
      observation(2, "SPLIT_ADJUSTED"),
    ]);
    expect(integrity.priceBasis).toBe("mixed");
    expect(integrity.backtestStatus).toBe("blocked");
  });

  it("blocks an adjusted marker with RAW semantics", () => {
    const integrity = assessHistoricalDataIntegrity([
      { ...observation(1, "RAW"), isAdjusted: true },
    ]);
    expect(integrity.backtestStatus).toBe("blocked");
    expect(integrity.corporateActionAdjustment).toBe("inconsistent");
  });
});
