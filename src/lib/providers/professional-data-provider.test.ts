import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockAsset, getMockDashboard } from "@/lib/mock/market";
import type { AssetDetail } from "@/lib/types";
import { getProfessionalDataProvider } from "./professional-data-provider";

const marketProviderMocks = vi.hoisted(() => ({
  getAsset: vi.fn(),
  getDashboard: vi.fn()
}));

vi.mock("@/lib/providers/market-provider", () => ({
  getMarketDataProvider: () => ({
    providerName: "Test Provider",
    getAsset: marketProviderMocks.getAsset,
    getDashboard: marketProviderMocks.getDashboard
  })
}));

const originalProfessionalSymbols = process.env.STOCKPILOT_PROFESSIONAL_SYMBOLS;

function providerOnlyDetail(symbol: string): AssetDetail {
  const base = getMockAsset("NVDA");
  if (!base) throw new Error("Missing NVDA fixture");
  const asOf = "2026-08-06T12:00:00.000Z";

  return {
    ...base,
    asset: {
      ...base.asset,
      symbol,
      name: "Meta Platforms Inc.",
      sector: "Communication Services"
    },
    quote: {
      ...base.quote,
      price: 501.25,
      change: 4.5,
      changePercent: 0.91,
      asOf,
      provider: "Test Provider Quote",
      quality: "near_realtime",
      marketStatus: "open"
    },
    fundamentals: {
      peRatio: null,
      revenueGrowth: 0,
      earningsGrowth: 0,
      debtToEquity: 0,
      cashflow: 0,
      dividendYield: null,
      marketCap: 0
    },
    news: [],
    dataQuality: {
      ...base.dataQuality,
      isMock: false,
      sufficientForAnalysis: false,
      confidence: 24,
      score: 38,
      sourceLabel: "Near-Realtime-Daten",
      updatedAt: asOf,
      issues: ["Fundamentaldaten fehlen."]
    }
  };
}

describe("professional data provider", () => {
  afterEach(() => {
    marketProviderMocks.getAsset.mockReset();
    marketProviderMocks.getDashboard.mockReset();
    if (originalProfessionalSymbols === undefined) delete process.env.STOCKPILOT_PROFESSIONAL_SYMBOLS;
    else process.env.STOCKPILOT_PROFESSIONAL_SYMBOLS = originalProfessionalSymbols;
  });

  it("builds reports from provider symbols without inventing fundamentals for provider-only assets", async () => {
    process.env.STOCKPILOT_PROFESSIONAL_SYMBOLS = "META";
    marketProviderMocks.getDashboard.mockResolvedValue(getMockDashboard());
    marketProviderMocks.getAsset.mockImplementation(async (symbol: string) => getMockAsset(symbol) ?? (symbol === "META" ? providerOnlyDetail("META") : null));

    const report = await getProfessionalDataProvider().getMarketReport();
    const symbols = report.equityScreener.map((row) => row.asset.symbol);
    const meta = report.equityScreener.find((row) => row.asset.symbol === "META");
    const activeInstrumentPoint = report.globalOverview.find((point) => point.label === "Aktive Instrumente im Report");

    expect(symbols).toContain("META");
    expect(activeInstrumentPoint?.value).toBeGreaterThan(6);
    expect(meta?.quote.quality).toBe("near_realtime");
    expect(meta?.equityFundamentals?.revenue).toMatchObject({
      value: null,
      quality: "unavailable",
      availability: "provider_missing"
    });
    expect(meta?.equityFundamentals?.priceTargetMedian.value).toBeNull();
  });
});
