// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HistoricalRiskPanel } from "@/components/historical-risk-panel";
import type { HistoricalRiskMetrics } from "@/lib/types";

afterEach(cleanup);

const base: HistoricalRiskMetrics = {
  status: "available",
  provider: "Verified History",
  quality: "historical",
  asOf: "2026-08-10T20:00:00.000Z",
  sampleSize: 120,
  tradingDays: 252,
  riskFreeRatePercent: 0,
  minimumReturns: 60,
  metrics: {
    totalReturnPercent: 12.5,
    annualizedReturnPercent: 26.1,
    annualizedVolatilityPercent: 18.2,
    downsideVolatilityPercent: 11.4,
    maxDrawdownPercent: -8.5,
    sharpeRatio: 1.2,
    sortinoRatio: 1.8,
    calmarRatio: 3.07,
    valueAtRisk95Percent: 1.9,
    conditionalValueAtRisk95Percent: 2.6
  },
  warnings: ["Historische Schätzung, keine Verlustobergrenze."]
};

describe("HistoricalRiskPanel", () => {
  it("zeigt berechnete Kennzahlen mit Quelle und Stichprobe", () => {
    render(<HistoricalRiskPanel metrics={base} />);

    expect(screen.getByText("Berechnet")).toBeTruthy();
    expect(screen.getByText("Verified History", { exact: false })).toBeTruthy();
    expect(screen.getByText("120 Renditen", { exact: false })).toBeTruthy();
    expect(screen.getByText("Sharpe Ratio")).toBeTruthy();
  });

  it("zeigt bei unzureichender Historie konsequent n/a", () => {
    const metrics: HistoricalRiskMetrics = {
      ...base,
      status: "insufficient_data",
      quality: "unavailable",
      sampleSize: 12,
      metrics: Object.fromEntries(Object.keys(base.metrics).map((key) => [key, null])) as HistoricalRiskMetrics["metrics"]
    };
    const { container } = render(<HistoricalRiskPanel metrics={metrics} />);

    expect(screen.getByText("Zu wenig Historie")).toBeTruthy();
    expect((container.textContent?.match(/n\/a/g) ?? []).length).toBe(10);
  });
});
