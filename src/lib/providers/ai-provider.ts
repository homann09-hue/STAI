import { getMockAsset } from "@/lib/mock/market";
import type { AiAnalysis } from "@/lib/types";

export interface AiAnalysisProvider {
  getAnalysis(symbol: string): Promise<AiAnalysis | null>;
}

class MockAiAnalysisProvider implements AiAnalysisProvider {
  async getAnalysis(symbol: string) {
    return getMockAsset(symbol)?.aiAnalysis ?? null;
  }
}

export function getAiAnalysisProvider(): AiAnalysisProvider {
  const provider = process.env.STOCKPILOT_AI_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockAiAnalysisProvider();
    default:
      return new MockAiAnalysisProvider();
  }
}
