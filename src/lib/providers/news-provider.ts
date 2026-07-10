import { getMockNews } from "@/lib/mock/market";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import type { MarketDataQuality, NewsItem, Sentiment } from "@/lib/types";

export interface NewsProvider {
  getNews(symbol?: string): Promise<NewsItem[]>;
}

export type NewsProviderMetadata = {
  provider: string;
  requestedProvider: string;
  actualProvider: string;
  quality: MarketDataQuality;
  fallback: {
    degraded: boolean;
    mockCount: number;
    total: number;
    warning: string | null;
  };
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function safeNewsText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[<>\u0000-\u001F\u007F]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || fallback;
}

function safeNewsId(value: unknown, fallback: string) {
  return safeNewsText(value, fallback, 180)
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, 120) || fallback;
}

function safeNewsSymbol(value: unknown, fallback = "MARKET") {
  const normalized = safeNewsText(value, fallback, 32)
    .toUpperCase()
    .replace(/[^A-Z0-9._:-]/g, "")
    .slice(0, 24);

  return normalized || fallback;
}

function safeNewsTimestamp(value: unknown) {
  if (typeof value === "string") {
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();
  }

  return new Date().toISOString();
}

function safeExternalNewsUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return "#";

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "#";
  } catch {
    return "#";
  }
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

function hasConfiguredNewsProvider() {
  return Boolean(process.env.MARKETAUX_API_KEY || process.env.NEWS_API_KEY || process.env.NEWSAPI_API_KEY);
}

function normalizeNewsProviderId(provider: string) {
  if (provider === "news_api") return "newsapi";
  if (provider === "marketaux" || provider === "newsapi" || provider === "auto" || provider === "mock") return provider;
  return "mock";
}

function newsProviderLabel(provider: string) {
  if (provider === "marketaux") return "Marketaux";
  if (provider === "newsapi" || provider === "news_api") return "NewsAPI";
  if (provider === "auto") return "News Provider Auto-Fallback";
  return "StockPilot Mock News Feed";
}

function isMockNewsItem(item: NewsItem) {
  return item.source.toLowerCase().includes("mock") || item.url === "#";
}

function buildNewsMetadata(requestedProvider: string, actualProvider: string, news: NewsItem[]): NewsProviderMetadata {
  const mockCount = news.filter(isMockNewsItem).length;
  const allMock = news.length > 0 && mockCount === news.length;
  const configured = hasConfiguredNewsProvider();
  const actualIsMock = actualProvider === "mock" || allMock;
  const normalizedRequestedProvider = normalizeNewsProviderId(requestedProvider);
  const providerSwitched =
    normalizedRequestedProvider !== "auto" &&
    normalizedRequestedProvider !== "mock" &&
    normalizedRequestedProvider !== actualProvider;
  const degraded = mockCount > 0 || !configured || actualIsMock || providerSwitched;
  const quality: MarketDataQuality = actualIsMock || !configured ? "mock" : "near_realtime";
  const warning = providerSwitched
    ? `Gewünschter News-Provider ${newsProviderLabel(normalizedRequestedProvider)} konnte nicht liefern. Antwort stammt aus ${newsProviderLabel(actualProvider)}.`
    : "News enthalten Mock-/Fallback-Daten oder es ist kein echter News-Provider aktiv. Nicht als bestätigte Realnachrichten interpretieren.";

  return {
    provider: actualIsMock ? "StockPilot Mock News Feed" : newsProviderLabel(actualProvider),
    requestedProvider: normalizedRequestedProvider,
    actualProvider,
    quality,
    fallback: {
      degraded,
      mockCount,
      total: news.length,
      warning: degraded ? warning : null
    }
  };
}

function symbolQuery(symbol?: string) {
  if (!symbol) return "(stocks OR ETFs OR crypto OR earnings OR markets)";
  const normalized = symbol.replace("-USD", "");
  return `(${normalized} OR ${symbol}) AND (stock OR shares OR earnings OR market OR crypto)`;
}

async function fetchProviderJson<T>(url: URL, providerName: string, timeoutMs = 6500): Promise<T> {
  const { data } = await fetchBoundedProviderJson<T>(url, providerName, {
    timeoutMs,
    userAgent: "StockPilotAI/0.1 news-layer"
  });

  return data;
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
      .filter((item) => safeNewsText(item.title, "", 240) && safeExternalNewsUrl(item.url) !== "#")
      .map<NewsItem>((item, index) => {
        const entity = item.entities?.[0];
        const score = parseNumber(entity?.sentiment_score ?? item.sentiment_score);
        const sentiment = sentimentFromScore(score);
        const relevance = clamp(Math.round(74 + Math.abs(score ?? 0) * 22 - index * 2), 42, 98);
        const sourceUrl = safeExternalNewsUrl(item.url);
        const fallbackId = `marketaux-${index}-${sourceUrl}`;

        return {
          id: safeNewsId(item.uuid ?? fallbackId, fallbackId),
          symbol: safeNewsSymbol(symbol ?? entity?.symbol),
          title: safeNewsText(item.title, "Marketaux News", 240),
          source: item.source ? `Marketaux / ${safeNewsText(item.source, "Quelle offen", 90)}` : "Marketaux",
          publishedAt: safeNewsTimestamp(item.published_at),
          relevance,
          sentiment,
          impactScore: impactFromSentiment(sentiment, relevance),
          summary: safeNewsText(item.description ?? item.snippet, "News-Meldung von Marketaux. Bitte Quelle prüfen.", 420),
          url: sourceUrl
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
      .filter((item) => safeNewsText(item.title, "", 240) && safeExternalNewsUrl(item.url) !== "#")
      .map<NewsItem>((item, index) => {
        const title = safeNewsText(item.title, "NewsAPI Meldung", 240);
        const summary = safeNewsText(item.description ?? item.content, "News-Meldung von NewsAPI. Bitte Quelle prüfen.", 420);
        const text = `${title} ${summary}`.toLowerCase();
        const sentiment: Sentiment =
          /beats|surges|rises|growth|record|upgrade|profit/.test(text)
            ? "positive"
            : /falls|drops|misses|lawsuit|probe|risk|downgrade|loss/.test(text)
              ? "negative"
              : "neutral";
        const relevance = clamp(82 - index * 3, 45, 92);
        const sourceUrl = safeExternalNewsUrl(item.url);
        const fallbackId = `newsapi-${index}-${sourceUrl}`;

        return {
          id: safeNewsId(fallbackId, fallbackId),
          symbol: safeNewsSymbol(symbol),
          title,
          source: item.source?.name ? `NewsAPI / ${safeNewsText(item.source.name, "Quelle offen", 90)}` : "NewsAPI",
          publishedAt: safeNewsTimestamp(item.publishedAt),
          relevance,
          sentiment,
          impactScore: impactFromSentiment(sentiment, relevance),
          summary,
          url: sourceUrl
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

function getNewsProviderAttempts(provider: string) {
  const marketaux = new MarketauxNewsProvider();
  const newsApi = new NewsApiProvider();
  const mock = new MockNewsProvider();
  const hasNewsApi = Boolean(process.env.NEWS_API_KEY ?? process.env.NEWSAPI_API_KEY);
  const attempts: Array<{ id: string; provider: NewsProvider }> = [];

  if (provider === "auto") {
    if (process.env.MARKETAUX_API_KEY) attempts.push({ id: "marketaux", provider: marketaux });
    if (hasNewsApi) attempts.push({ id: "newsapi", provider: newsApi });
    attempts.push({ id: "mock", provider: mock });
    return attempts;
  }

  if (provider === "marketaux") {
    attempts.push({ id: "marketaux", provider: marketaux });
    if (hasNewsApi) attempts.push({ id: "newsapi", provider: newsApi });
    attempts.push({ id: "mock", provider: mock });
    return attempts;
  }

  if (provider === "newsapi" || provider === "news_api") {
    attempts.push({ id: "newsapi", provider: newsApi });
    if (process.env.MARKETAUX_API_KEY) attempts.push({ id: "marketaux", provider: marketaux });
    attempts.push({ id: "mock", provider: mock });
    return attempts;
  }

  return [{ id: "mock", provider: mock }];
}

export async function getNewsWithMetadata(symbol?: string) {
  const provider = (process.env.STOCKPILOT_NEWS_PROVIDER ?? "mock").trim().toLowerCase();
  const attempts = getNewsProviderAttempts(provider);
  let emptyProviderResult: { actualProvider: string; news: NewsItem[] } | null = null;

  for (const attempt of attempts) {
    if (attempt.id === "mock" && emptyProviderResult) break;

    try {
      const news = await attempt.provider.getNews(symbol);
      if (news.length) {
        return {
          news,
          metadata: buildNewsMetadata(provider, attempt.id, news)
        };
      }

      if (attempt.id !== "mock" && !emptyProviderResult) {
        emptyProviderResult = {
          actualProvider: attempt.id,
          news
        };
      }
    } catch {
      // Try next configured provider or explicit mock fallback.
    }
  }

  if (emptyProviderResult) {
    return {
      news: emptyProviderResult.news,
      metadata: buildNewsMetadata(provider, emptyProviderResult.actualProvider, emptyProviderResult.news)
    };
  }

  const news = getMockNews(symbol);

  return {
    news,
    metadata: buildNewsMetadata(provider, "mock", news)
  };
}
