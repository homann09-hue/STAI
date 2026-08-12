import { describe, expect, it } from "vitest";
import { assessHistoricalDataIntegrity } from "@/lib/analysis/history-integrity";
import {
  bindHistoryInstrumentContext,
  parseFmpDailyHistoryResult,
  type HistoryResult,
} from "@/lib/providers/price-history";

const row = {
  date: "2024-01-02",
  open: 100,
  high: 105,
  low: 98,
  close: 103,
  volume: 1_000,
};

describe("historical instrument identity", () => {
  it("keeps unresolved provider bars partial", () => {
    const parsed = parseFmpDailyHistoryResult("AAPL", [row]);
    expect(parsed.bars[0]).toMatchObject({
      instrumentId: null,
      currency: "XXX",
      venue: null,
    });
    expect(parsed.quality.status).toBe("PARTIAL");
    expect(parsed.quality.sufficientForPriceAnalysis).toBe(false);
  });

  it("revalidates bars against a verified quote identity", () => {
    const parsed = parseFmpDailyHistoryResult("AAPL", [row]);
    const history: HistoryResult = {
      candles: parsed.bars,
      note: "fixture",
      provider: "Financial Modeling Prep",
      integrity: assessHistoricalDataIntegrity(parsed.bars),
      barQuality: parsed.quality,
    };
    const rebound = bindHistoryInstrumentContext(history, {
      instrumentId: "equity:XNAS:AAPL:USD",
      venue: "XNAS",
      currency: "USD",
      sessionTimeZone: "America/New_York",
    });
    expect(rebound.candles[0]).toMatchObject({
      instrumentId: "equity:XNAS:AAPL:USD",
      venue: "XNAS",
      currency: "USD",
      sessionTimeZone: "America/New_York",
    });
    expect(rebound.candles[0].qualityIssues).not.toContain("currency_unknown");
  });
});
