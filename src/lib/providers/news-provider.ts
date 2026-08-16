import { getMockNews } from "@/lib/mock/market";
import { classifySubjects, detectEvents, type ProviderEntity } from "@/lib/news/classification";
import { clusterNews } from "@/lib/news/dedupe";
import { fetchBoundedProviderJson } from "@/lib/providers/http-json";
import { getFinnhubClient } from "@/lib/providers/finnhub-client";
import {
  resolveProviderRoute,
  type ProviderId,
} from "@/lib/providers/provider-registry";
import { developmentFixturesAllowed } from "@/lib/runtime-data-policy";
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
  /** Wie viele Meldungen als Duplikate zusammengeführt wurden. */
  mergedDuplicates?: number;
};

/**
 * Führt Duplikate zusammen und trägt die Zusatzquellen an der Meldung nach.
 *
 * Dieselbe Meldung läuft über mehrere Häuser. Ohne diesen Schritt sieht ein
 * Feed nach sechs Ereignissen aus, wo eines war.
 */
function mergeDuplicates(news: NewsItem[]): { news: NewsItem[]; mergedCount: number } {
  const { clusters, mergedCount } = clusterNews(news);

  return {
    news: clusters.map((cluster) => ({
      ...cluster.primary,
      duplicateSources: cluster.sources.filter((source) => source !== cluster.primary.source)
    })),
    mergedCount
  };
}

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
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const timestamp = value < 10_000_000_000 ? value * 1_000 : value;
    return new Date(timestamp).toISOString();
  }
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

/**
 * Impact aus Sentiment und Relevanz.
 *
 * Ohne Relevanz nicht bildbar — vorher entstand hier aus einer erfundenen
 * Relevanz ein ebenso erfundener Impact, der wie eine Messung aussah.
 */
function impactFromSentiment(sentiment: Sentiment, relevance: number | null) {
  if (relevance === null) return null;
  const direction = sentiment === "positive" ? 1 : sentiment === "negative" ? -1 : 0;
  return Math.round(direction * clamp(relevance * 0.72, 10, 72));
}

/**
 * Reichert eine Meldung um Ereignisarten und Bezüge an.
 *
 * Beides wird aus dem Text bzw. den Anbieterentitäten gewonnen und trägt
 * jeweils seinen Beleg mit.
 */
function enrich(
  base: Omit<NewsItem, "events" | "subjects" | "duplicateSources">,
  entities: ProviderEntity[]
): NewsItem {
  return {
    ...base,
    events: detectEvents(base.title, base.summary),
    subjects: classifySubjects(entities, base.symbol),
    duplicateSources: []
  };
}

function hasConfiguredNewsProvider() {
  return resolveProviderRoute({ capability: "news" }).providers.length > 0;
}

function normalizeNewsProviderId(provider: string) {
  if (provider === "news_api") return "newsapi";
  if (provider === "marketaux" || provider === "newsapi" || provider === "finnhub" || provider === "auto" || provider === "mock") return provider;
  return "auto";
}

function newsProviderLabel(provider: string) {
  if (provider === "marketaux") return "Marketaux";
  if (provider === "newsapi" || provider === "news_api") return "NewsAPI";
  if (provider === "finnhub") return "Finnhub";
  if (provider === "auto") return "News Provider Auto-Fallback";
  if (provider === "unavailable") return "Kein News-Provider";
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
  const unavailable = actualProvider === "unavailable";
  const normalizedRequestedProvider = normalizeNewsProviderId(requestedProvider);
  const providerSwitched =
    normalizedRequestedProvider !== "auto" &&
    normalizedRequestedProvider !== "mock" &&
    !unavailable &&
    normalizedRequestedProvider !== actualProvider;
  const degraded = mockCount > 0 || actualIsMock || unavailable || providerSwitched || (!configured && news.length === 0);
  const quality: MarketDataQuality = actualIsMock ? "mock" : unavailable ? "unavailable" : "near_realtime";
  const warning = unavailable
    ? "Kein konfigurierter News-Provider konnte verifizierte Meldungen liefern. Es werden keine Ersatzmeldungen angezeigt."
    : providerSwitched
      ? `Gewünschter News-Provider ${newsProviderLabel(normalizedRequestedProvider)} konnte nicht liefern. Antwort stammt aus ${newsProviderLabel(actualProvider)}.`
      : actualIsMock
        ? "Lokale Entwicklungs-Fixtures sind aktiv. Diese Meldungen sind keine echten Nachrichten."
        : null;

  return {
    provider: newsProviderLabel(actualProvider),
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
        entities?: Array<{
          symbol?: string;
          name?: string;
          type?: string;
          industry?: string;
          country?: string;
          match_score?: number;
          sentiment_score?: number;
        }>;
      }>;
    }>(url, "Marketaux");

    return (payload.data ?? [])
      .filter((item) => safeNewsText(item.title, "", 240) && safeExternalNewsUrl(item.url) !== "#")
      .map<NewsItem>((item, index) => {
        const entity = item.entities?.[0];
        const score = parseNumber(entity?.sentiment_score ?? item.sentiment_score);
        const sentiment = sentimentFromScore(score);

        // Der eigene Wert des Anbieters statt einer Zahl aus der Listenposition.
        // Am 2026-08-08 gemessen: `match_score` liegt bei 13 bis 27,
        // `relevance_score` ist im vorhandenen Tarif durchgehend null. Der Wert
        // wird deshalb nur begrenzt, nicht umskaliert -- eine Umrechnung auf
        // 0..100 waere eine Kalibrierung, die ich nicht gemessen habe.
        const relevance = (() => {
          const match = parseNumber(entity?.match_score);
          return match === undefined ? null : Math.round(clamp(match, 0, 100));
        })();

        const sourceUrl = safeExternalNewsUrl(item.url);
        const fallbackId = `marketaux-${index}-${sourceUrl}`;
        const entities: ProviderEntity[] = (item.entities ?? []).map((raw) => ({
          symbol: raw.symbol,
          name: raw.name,
          type: raw.type,
          industry: raw.industry,
          country: raw.country,
          matchScore: parseNumber(raw.match_score) ?? null
        }));

        return enrich(
          {
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
          },
          entities
        );
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
        const sourceUrl = safeExternalNewsUrl(item.url);
        const fallbackId = `newsapi-${index}-${sourceUrl}`;

        return enrich(
          {
            id: safeNewsId(fallbackId, fallbackId),
            symbol: safeNewsSymbol(symbol),
            title,
            source: item.source?.name ? `NewsAPI / ${safeNewsText(item.source.name, "Quelle offen", 90)}` : "NewsAPI",
            publishedAt: safeNewsTimestamp(item.publishedAt),
            // NewsAPI liefert keine Relevanz. Vorher stand hier `82 - index * 3`
            // -- die Reihenfolge der Antwort als Messwert ausgegeben.
            relevance: null,
            sentiment,
            impactScore: null,
            summary,
            url: sourceUrl
          },
          // NewsAPI erkennt keine Entitaeten. Der Bezug kann daher nur aus dem
          // abgefragten Symbol kommen und wird als abgeleitet gekennzeichnet.
          []
        );
      });
  }
}

class FinnhubNewsProvider implements NewsProvider {
  async getNews(symbol?: string) {
    const client = getFinnhubClient();
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const fromDate = new Date(now);
    fromDate.setUTCDate(fromDate.getUTCDate() - 14);
    const rows = symbol
      ? await client.getCompanyNews(symbol, fromDate.toISOString().slice(0, 10), to)
      : await client.getMarketNews("general");

    return rows
      .filter((item) => safeNewsText(item.headline, "", 240) && safeExternalNewsUrl(item.url) !== "#")
      .map<NewsItem>((item, index) => {
        const title = safeNewsText(item.headline, "Finnhub Meldung", 240);
        const summary = safeNewsText(item.summary, "Meldung von Finnhub. Bitte Originalquelle pruefen.", 420);
        const text = `${title} ${summary}`.toLowerCase();
        const sentiment: Sentiment =
          /beats|surges|rises|growth|record|upgrade|profit/.test(text)
            ? "positive"
            : /falls|drops|misses|lawsuit|probe|risk|downgrade|loss/.test(text)
              ? "negative"
              : "neutral";
        const sourceUrl = safeExternalNewsUrl(item.url);
        const fallbackId = `finnhub-${index}-${sourceUrl}`;
        return enrich(
          {
            id: safeNewsId(item.id ?? fallbackId, fallbackId),
            symbol: safeNewsSymbol(symbol ?? item.related),
            title,
            source: item.source ? `Finnhub / ${safeNewsText(item.source, "Quelle offen", 90)}` : "Finnhub",
            publishedAt: safeNewsTimestamp(item.datetime),
            relevance: null,
            sentiment,
            impactScore: null,
            summary,
            url: sourceUrl,
          },
          [],
        );
      });
  }
}

class FallbackNewsProvider implements NewsProvider {
  constructor(private readonly providers: NewsProvider[]) {}

  async getNews(symbol?: string) {
    for (const provider of this.providers) {
      try {
        const news = await provider.getNews(symbol);
        // Meldungen ohne Relevanzangabe nach hinten -- aber nicht heraus. Eine
        // fehlende Angabe ist keine niedrige Relevanz.
        if (news.length) return news.sort((a, b) => (b.relevance ?? -1) - (a.relevance ?? -1));
      } catch {
        // News providers are optional. Der naechste echte Provider darf
        // uebernehmen; Produktions-Fixtures sind kein Ausfall-Fallback.
      }
    }

    return [];
  }
}

export function getNewsProvider(): NewsProvider {
  const provider = normalizeNewsProviderId((process.env.STOCKPILOT_NEWS_PROVIDER ?? "auto").trim().toLowerCase());
  return new FallbackNewsProvider(getNewsProviderAttempts(provider).map((attempt) => attempt.provider));
}

function getNewsProviderAttempts(provider: string) {
  const marketaux = new MarketauxNewsProvider();
  const newsApi = new NewsApiProvider();
  const finnhub = new FinnhubNewsProvider();
  const attempts: Array<{ id: string; provider: NewsProvider }> = [];

  if (provider === "mock" && developmentFixturesAllowed()) {
    return [{ id: "mock", provider: new MockNewsProvider() }];
  }

  const route = resolveProviderRoute({
    capability: "news",
    preferredProvider: provider === "auto" ? null : provider,
  });
  const adapters: Partial<Record<ProviderId, NewsProvider>> = {
    finnhub,
    marketaux,
    newsapi: newsApi,
  };

  for (const id of route.providers) {
    const adapter = adapters[id];
    if (adapter) attempts.push({ id, provider: adapter });
  }

  return attempts;
}

export async function getNewsWithMetadata(symbol?: string) {
  const provider = normalizeNewsProviderId((process.env.STOCKPILOT_NEWS_PROVIDER ?? "auto").trim().toLowerCase());
  const attempts = getNewsProviderAttempts(provider);
  let emptyProviderResult: { actualProvider: string; news: NewsItem[] } | null = null;

  for (const attempt of attempts) {
    try {
      const raw = await attempt.provider.getNews(symbol);
      if (raw.length) {
        const { news, mergedCount } = mergeDuplicates(raw);
        return {
          news,
          metadata: { ...buildNewsMetadata(provider, attempt.id, news), mergedDuplicates: mergedCount }
        };
      }
      const news = raw;

      if (attempt.id !== "mock" && !emptyProviderResult) {
        emptyProviderResult = {
          actualProvider: attempt.id,
          news
        };
      }
    } catch {
      // Try the next configured, real provider. Fixtures are never an outage
      // fallback and can only be selected explicitly outside production.
    }
  }

  if (emptyProviderResult) {
    return {
      news: emptyProviderResult.news,
      metadata: buildNewsMetadata(provider, emptyProviderResult.actualProvider, emptyProviderResult.news)
    };
  }

  return {
    news: [],
    metadata: buildNewsMetadata(provider, "unavailable", [])
  };
}
