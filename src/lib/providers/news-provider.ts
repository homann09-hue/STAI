import { getMockNews } from "@/lib/mock/market";
import type { NewsItem } from "@/lib/types";

export interface NewsProvider {
  getNews(symbol?: string): Promise<NewsItem[]>;
}

class MockNewsProvider implements NewsProvider {
  async getNews(symbol?: string) {
    return getMockNews(symbol);
  }
}

export function getNewsProvider(): NewsProvider {
  const provider = process.env.STOCKPILOT_NEWS_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockNewsProvider();
    default:
      return new MockNewsProvider();
  }
}
