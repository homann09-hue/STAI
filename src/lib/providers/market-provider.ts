import { getMockAsset, getMockDashboard } from "@/lib/mock/market";
import type { AssetDetail, DashboardData } from "@/lib/types";

export interface MarketDataProvider {
  getDashboard(): Promise<DashboardData>;
  getAsset(symbol: string): Promise<AssetDetail | null>;
}

class MockMarketDataProvider implements MarketDataProvider {
  async getDashboard() {
    return getMockDashboard();
  }

  async getAsset(symbol: string) {
    return getMockAsset(symbol);
  }
}

export function getMarketDataProvider(): MarketDataProvider {
  const provider = process.env.STOCKPILOT_MARKET_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockMarketDataProvider();
    default:
      return new MockMarketDataProvider();
  }
}
