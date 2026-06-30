import { getMockNews } from "@/lib/mock/market";
import type { NewsItem, Sentiment } from "@/lib/types";

export interface NewsProvider {
  getNews(symbol?: string): Promise<NewsItem[]>;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function sentimentFromScore(score: number | undefined): Sentiment {
  if (score === undefined) return "neutral";
  if (score >= 0.15) return "positive";
  if (score <= -0.15) return "negative";
  return "neutral";
}

function impactFromSentiment(sentiment: Sentiment, relevance: number) {
  const direction = sentiment === "positive" ? 1 : sentiment === "negative" ? -1 : 0;
  return Math.round(direction * clamp(relevance * 0.72, 10, 72));
}

function symbolQuery(symbol?: string) {
  if (!symbol) return "(stocks OR ETFs OR crypto OR earnings OR markets)";
  const normalized = symbol.replace("-USD", "");
  return `(${normalized} OR ${symbol}) AND (stock OR shares OR earnings OR market OR crypto)`;
}

async function fetchProviderJson<T>(url: URL, providerName: string, timeoutMs = 6500): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "StockPilotAI/0.1 news-layer"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`${providerName} HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

class MockNewsProvider implements NewsProvider {
  async getNews(symbol?: string) {
    return getMockNews(symbol);
  }
}

class MarketauxNewsProvider implements NewsProvider {
  async getNews(symbol?: string) {
    const token = process.env.MARKETAUX_API_KEY;
    if (!token) throw new Error("MARKETAUX_API_KEY fehlt");

    const url = new URL("https://api.marketaux.com/v1/news/all");
    url.searchParams.set("api_token", token);
    url.searchParams.set("language", "en");
    url.searchParams.set("filter_entities", "true");
    url.searchParams.set("limit", "20");
    url.searchParams.set("sort", "published_desc");
    if (symbol) url.searchParams.set("symbols", symbol.replace("-USD", ""));

    const payload = await fetchProviderJson<{
      data?: Array<{
        uuid?: string;
        title?: string;
        description?: string;
        snippet?: string;
        source?: string;
        published_at?: string;
        url?: string;
        sentiment_score?: number;
        entities?: Array<{ symbol?: string; sentiment_score?: number }>;
      }>;
    }>(url, "Marketaux");

    return (payload.data ?? [])
      .filter((item) => item.title && item.url)
      .map<NewsItem>((item, index) => {
        const entity = item.entities?.[0];
        const score = parseNumber(entity?.sentiment_score ?? item.sentiment_score);
        const sentiment = sentimentFromScore(score);
        const relevance = clamp(Math.round(74 + Math.abs(score ?? 0) * 22 - index * 2), 42, 98);

        return {
          id: item.uuid ?? `marketaux-${index}-${item.url}`,
          symbol: symbol ?? entity?.symbol ?? "MARKET",
          title: item.title ?? "Marketaux News",
          source: item.source ? `Marketaux / ${item.source}` : "Marketaux",
          publishedAt: item.published_at ? new Date(item.published_at).toISOString() : new Date().toISOString(),
          relevance,
          sentiment,
          impactScore: impactFromSentiment(sentiment, relevance),
          summary: item.description ?? item.snippet ?? "News-Meldung von Marketaux. Bitte Quelle prüfen.",
          url: item.url ?? "#"
        };
      });
  }
}

class NewsApiProvider implements NewsProvider {
  async getNews(symbol?: string) {
    const token = process.env.NEWS_API_KEY ?? process.env.NEWSAPI_API_KEY;
    if (!token) throw new Error("NEWS_API_KEY fehlt");

    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", symbolQuery(symbol));
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "20");
    url.searchParams.set("apiKey", token);

    const payload = await fetchProviderJson<{
      articles?: Array<{
        title?: string;
        description?: string;
        content?: string;
        url?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    }>(url, "NewsAPI");

    return (payload.articles ?? [])
      .filter((item) => item.title && item.url)
      .map<NewsItem>((item, index) => {
        const text = `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase();
        const sentiment: Sentiment =
          /beats|surges|rises|growth|record|upgrade|profit/.test(text)
            ? "positive"
            : /falls|drops|misses|lawsuit|probe|risk|downgrade|loss/.test(text)
              ? "negative"
              : "neutral";
        const relevance = clamp(82 - index * 3, 45, 92);

        return {
          id: `newsapi-${index}-${item.url}`,
          symbol: symbol ?? "MARKET",
          title: item.title ?? "NewsAPI Meldung",
          source: item.source?.name ? `NewsAPI / ${item.source.name}` : "NewsAPI",
          publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : new Date().toISOString(),
          relevance,
          sentiment,
          impactScore: impactFromSentiment(sentiment, relevance),
          summary: item.description ?? item.content ?? "News-Meldung von NewsAPI. Bitte Quelle prüfen.",
          url: item.url ?? "#"
        };
      });
  }
}

class FallbackNewsProvider implements NewsProvider {
  constructor(private readonly providers: NewsProvider[]) {}

  async getNews(symbol?: string) {
    for (const provider of this.providers) {
      try {
        const news = await provider.getNews(symbol);
        if (news.length) return news.sort((a, b) => b.relevance - a.relevance);
      } catch {
        // News providers are optional. The next provider or mock fallback keeps the UI honest.
      }
    }

    return getMockNews(symbol);
  }
}

export function getNewsProvider(): NewsProvider {
  const provider = (process.env.STOCKPILOT_NEWS_PROVIDER ?? "mock").trim().toLowerCase();
  const marketaux = new MarketauxNewsProvider();
  const newsApi = new NewsApiProvider();
  const mock = new MockNewsProvider();
  const hasNewsApi = Boolean(process.env.NEWS_API_KEY ?? process.env.NEWSAPI_API_KEY);

  switch (provider) {
    case "auto":
      return new FallbackNewsProvider([
        ...(process.env.MARKETAUX_API_KEY ? [marketaux] : []),
        ...(hasNewsApi ? [newsApi] : []),
        mock
      ]);
    case "marketaux":
      return new FallbackNewsProvider([marketaux, ...(hasNewsApi ? [newsApi] : []), mock]);
    case "newsapi":
    case "news_api":
      return new FallbackNewsProvider([newsApi, ...(process.env.MARKETAUX_API_KEY ? [marketaux] : []), mock]);
    case "mock":
      return mock;
    default:
      return mock;
  }
}
