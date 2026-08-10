import { describe, expect, it } from "vitest";
import {
  mergeCorporateActions,
  normalizeFmpDividends,
  normalizeFmpSplits,
  supportsCorporateActionsAssetType
} from "@/lib/corporate-actions";

const receivedAt = "2026-08-10T12:00:00.000Z";
const now = new Date(receivedAt);

describe("FMP Corporate-Action-Normalisierung", () => {
  it("beschränkt den Providervertrag auf Aktien und ETFs", () => {
    expect(supportsCorporateActionsAssetType("stock")).toBe(true);
    expect(supportsCorporateActionsAssetType("etf")).toBe(true);
    expect(supportsCorporateActionsAssetType("crypto")).toBe(false);
    expect(supportsCorporateActionsAssetType("index")).toBe(false);
  });

  it("ordnet Dividendenbetrag und Termine ohne Ersatzwerte zu", () => {
    const [action] = normalizeFmpDividends([
      {
        symbol: "AAPL",
        date: "2026-08-07",
        dividend: 0.26,
        adjDividend: 0.26,
        declarationDate: "2026-07-31",
        recordDate: "2026-08-10",
        paymentDate: "2026-08-13",
        currency: "USD"
      }
    ], "AAPL", receivedAt, now);

    expect(action.type).toBe("cash_dividend");
    expect(action.cashAmount).toBe(0.26);
    expect(action.recordDate).toBe("2026-08-10");
    expect(action.paymentDate).toBe("2026-08-13");
    expect(action.quality).toBe("provider_reported");
    expect(action.lifecycle).toBe("effective");
  });

  it("erkennt Forward- und Reverse-Splits anhand des Verhältnisses", () => {
    const actions = normalizeFmpSplits([
      { symbol: "AAPL", date: "2020-08-31", numerator: 4, denominator: 1 },
      { symbol: "AAPL", date: "2027-01-02", splitRatio: "1:10" }
    ], "AAPL", receivedAt, now);

    expect(actions.map((action) => action.type)).toEqual(["split", "reverse_split"]);
    expect(actions[1].ratioFrom).toBe(1);
    expect(actions[1].ratioTo).toBe(10);
    expect(actions[1].lifecycle).toBe("scheduled");
  });

  it("verwirft unvollständige, ungültige und symbolfremde Zeilen", () => {
    expect(normalizeFmpDividends([
      { symbol: "MSFT", date: "2026-01-01", dividend: 1 },
      { symbol: "AAPL", date: "kein-datum", dividend: 1 },
      { symbol: "AAPL", date: "2026-01-01" }
    ], "AAPL", receivedAt, now)).toEqual([]);

    expect(normalizeFmpSplits([
      { symbol: "AAPL", date: "2026-01-01", numerator: 4 },
      { symbol: "AAPL", date: "2026-02-30", numerator: 4, denominator: 1 }
    ], "AAPL", receivedAt, now)).toEqual([]);
  });

  it("dedupliziert kanonisch und sortiert neueste Ereignisse zuerst", () => {
    const dividends = normalizeFmpDividends([
      { symbol: "AAPL", date: "2026-01-01", dividend: 0.25 },
      { symbol: "AAPL", date: "2026-01-01", dividend: 0.25 }
    ], "AAPL", receivedAt, now);
    const splits = normalizeFmpSplits([
      { symbol: "AAPL", date: "2026-06-01", numerator: 2, denominator: 1 }
    ], "AAPL", receivedAt, now);

    const merged = mergeCorporateActions(dividends, splits);
    expect(merged).toHaveLength(2);
    expect(merged[0].type).toBe("split");
  });
});
