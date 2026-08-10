import { describe, expect, it } from "vitest";
import {
  assessHistoricalDataIntegrity,
  historicalPriceBasisLabel
} from "@/lib/analysis/history-integrity";

const timestamp = (day: number) => `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`;

describe("historische Datenintegrität", () => {
  it("erkennt eine vollständig angepasste Reihe ohne Point-in-Time zu behaupten", () => {
    const result = assessHistoricalDataIntegrity(
      [
        { timestamp: timestamp(1), close: 100, adjustedClose: 90 },
        { timestamp: timestamp(2), close: 101, adjustedClose: 91 }
      ],
      "2026-01-03T12:00:00.000Z"
    );

    expect(result.priceBasis).toBe("adjusted_close");
    expect(result.adjustedCloseCoveragePercent).toBe(100);
    expect(result.backtestStatus).toBe("usable_with_limitations");
    expect(result.pointInTime).toBe(false);
    expect(result.dataCutoff).toBe(timestamp(2));
    expect(result.receivedAt).toBe("2026-01-03T12:00:00.000Z");
  });

  it("blockiert eine gemischte Reihe", () => {
    const result = assessHistoricalDataIntegrity([
      { timestamp: timestamp(1), close: 100, adjustedClose: 90 },
      { timestamp: timestamp(2), close: 101 }
    ]);

    expect(result.priceBasis).toBe("mixed");
    expect(result.adjustedCloseCoveragePercent).toBe(50);
    expect(result.backtestStatus).toBe("blocked");
    expect(result.issues.join(" ")).toContain("methodisch inkonsistent");
  });

  it("kennzeichnet eine reine Schlusskursreihe als nicht nachweislich angepasst", () => {
    const result = assessHistoricalDataIntegrity([
      { timestamp: timestamp(1), close: 100 },
      { timestamp: timestamp(2), close: 101 }
    ]);

    expect(result.priceBasis).toBe("unadjusted_close");
    expect(result.adjustedCloseCoveragePercent).toBe(0);
    expect(result.corporateActionAdjustment).toBe("not_evidenced");
    expect(historicalPriceBasisLabel(result.priceBasis)).toContain("Nicht nachweislich");
  });

  it("blockiert eine leere oder unbrauchbare Reihe", () => {
    const result = assessHistoricalDataIntegrity([
      { timestamp: "kein Datum", close: 100 },
      { timestamp: timestamp(2), close: 0 }
    ]);

    expect(result.priceBasis).toBe("unknown");
    expect(result.backtestStatus).toBe("blocked");
    expect(result.dataCutoff).toBeNull();
  });
});
