import { describe, expect, it } from "vitest";
import { assessHistoricalDataIntegrity } from "@/lib/analysis/history-integrity";
import { runBacktest } from "@/lib/analysis/backtest";

const candles = Array.from({ length: 800 }, (_, index) => ({
  timestamp: new Date(Date.UTC(2020, 0, 1 + index)).toISOString(),
  close: 100 + index * 0.1,
  isAdjusted: true,
  adjustmentType: "SPLIT_ADJUSTED" as const,
}));

describe("backtest adjusted OHLC provenance", () => {
  it("uses adjusted OHLC closes without claiming an independent corporate-action audit", () => {
    const integrity = assessHistoricalDataIntegrity(candles);
    const result = runBacktest({
      candles,
      integrity,
      initialCapital: 1_000,
      monthlyContribution: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.caveats.join(" ")).toContain("SPLIT_ADJUSTED");
    expect(result.caveats.join(" ")).toContain("nicht gegen einen unabhängigen Ereignis-Ledger");
  });
});
