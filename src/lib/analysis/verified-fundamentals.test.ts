import { describe, expect, it } from "vitest";
import { selectVerifiedFundamentals } from "@/lib/analysis/verified-fundamentals";
import type { Fundamentals } from "@/lib/types";

const fundamentals: Fundamentals = {
  peRatio: 24.5,
  revenueGrowth: 8.2,
  earningsGrowth: 11.4,
  debtToEquity: 1.1,
  cashflow: 42_000_000,
  dividendYield: 0.7,
  marketCap: 2_500_000_000,
};

const quote = {
  value: 3_000_000_000,
  provider: "Quote Provider",
  quality: "delayed" as const,
  fetchedAt: "2026-08-10T10:00:00.000Z",
};

describe("selectVerifiedFundamentals", () => {
  it("übernimmt ausschließlich exakt als Providerdaten markierte Felder", () => {
    const result = selectVerifiedFundamentals(
      {
        fundamentals,
        metadata: {
          provider: "Fundamentals Provider",
          quality: "delayed",
          fetchedAt: "2026-08-10T09:59:00.000Z",
          fields: {
            peRatio: "provider",
            revenueGrowth: "mock",
            earningsGrowth: "unavailable",
            cashflow: "provider",
            marketCap: "mock",
          },
          caveat: "Teilabdeckung",
          fallback: { warning: "Fallback aktiv" },
        },
      },
      quote,
    );

    expect(result.fundamentals.peRatio).toBe(24.5);
    expect(result.fundamentals.cashflow).toBe(42_000_000);
    expect(result.fundamentals.revenueGrowth).toBe(0);
    expect(result.fundamentals.earningsGrowth).toBe(0);
    expect(result.fundamentals.marketCap).toBe(3_000_000_000);
    expect(result.evidence.verifiedFields).toEqual([
      "peRatio",
      "cashflow",
      "marketCap",
    ]);
    expect(result.evidence.excludedMockFields).toEqual(["revenueGrowth"]);
    expect(result.evidence.warning).toContain("entfernt");
  });

  it("gibt ohne belegte Anbieterfelder keine Fallbackzahlen aus", () => {
    const result = selectVerifiedFundamentals(
      {
        fundamentals,
        metadata: {
          provider: "StockPilot Mock Fundamentals",
          quality: "mock",
          fetchedAt: "2026-08-10T09:59:00.000Z",
          fields: Object.fromEntries(
            Object.keys(fundamentals).map((field) => [field, "mock"]),
          ),
          caveat: null,
          fallback: { warning: "Mock" },
        },
      },
      { ...quote, value: undefined },
    );

    expect(result.fundamentals).toEqual({
      peRatio: null,
      revenueGrowth: 0,
      earningsGrowth: 0,
      debtToEquity: 0,
      cashflow: 0,
      dividendYield: null,
      marketCap: 0,
    });
    expect(result.evidence.verifiedCount).toBe(0);
    expect(result.evidence.quality).toBe("unavailable");
  });
});
