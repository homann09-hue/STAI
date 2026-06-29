import { getMockAsset } from "@/lib/mock/market";
import type { Fundamentals } from "@/lib/types";

export interface FundamentalsProvider {
  getFundamentals(symbol: string): Promise<Fundamentals | null>;
}

class MockFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(symbol: string) {
    return getMockAsset(symbol)?.fundamentals ?? null;
  }
}

export function getFundamentalsProvider(): FundamentalsProvider {
  const provider = process.env.STOCKPILOT_FUNDAMENTALS_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockFundamentalsProvider();
    default:
      return new MockFundamentalsProvider();
  }
}
