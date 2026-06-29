import { z } from "zod";
import type { AssetDetail, DataQualityReport, DataSource, MarketDataQuality } from "@/lib/types";

const quoteSchema = z.object({
  price: z.number().positive(),
  changePercent: z.number(),
  volume: z.number().nonnegative(),
  asOf: z.string().datetime({ offset: true })
});

const newsSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  publishedAt: z.string().datetime({ offset: true }),
  relevance: z.number().min(0).max(100),
  impactScore: z.number().min(-100).max(100)
});

const sourceLabels: Record<MarketDataQuality, string> = {
  realtime: "Realtime-Daten",
  near_realtime: "Near-Realtime-Daten",
  delayed: "Verzoegerte Daten",
  historical: "Historische Daten",
  mock: "Mock-Daten",
  unavailable: "Nicht verfuegbar"
};

export function validateAssetData(detail: Pick<AssetDetail, "asset" | "quote" | "news" | "fundamentals" | "candles">) {
  const issues: string[] = [];
  const quote = quoteSchema.safeParse(detail.quote);

  if (!quote.success) issues.push("Kursdaten sind unvollstaendig oder ungültig.");
  if (!detail.asset.symbol || !detail.asset.name) issues.push("Asset-Stammdaten fehlen.");
  if (!Object.values(detail.candles).every((items) => items.length >= 10)) {
    issues.push("Mindestens ein Chart-Zeitraum hat zu wenige Kerzen.");
  }
  if (!detail.news.every((item) => newsSchema.safeParse(item).success)) {
    issues.push("Mindestens eine News-Quelle ist unvollstaendig.");
  }
  if (detail.asset.type !== "crypto" && detail.fundamentals.peRatio === null) {
    issues.push("KGV fehlt für ein nicht-krypto Asset.");
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export function assessDataQuality(
  detail: Pick<AssetDetail, "asset" | "quote" | "news" | "fundamentals" | "candles">,
  now = new Date()
): DataQualityReport {
  const validation = validateAssetData(detail);
  const quoteAgeMinutes = Math.max(0, (now.getTime() - new Date(detail.quote.asOf).getTime()) / 60000);
  const quoteQuality = detail.quote.quality ?? "mock";
  const stale = quoteAgeMinutes > 60;
  const delayed = quoteAgeMinutes > 20 || quoteQuality === "delayed";
  const missingNews = detail.news.length === 0;
  const cryptoFundamentalGap = detail.asset.type === "crypto" && detail.fundamentals.peRatio === null;
  const isMock = quoteQuality === "mock";
  const providerSourceStatus =
    quoteQuality === "unavailable" ? "missing" : stale ? "stale" : delayed ? "delayed" : "fresh";
  const contradictions = detail.news.some((item) => item.sentiment === "negative" && detail.quote.changePercent > 3)
    ? ["Kurs steigt stark, obwohl relevante News negativ bewertet werden."]
    : [];
  const sources: DataSource[] = [
    {
      name: detail.quote.provider ?? "Unbekannter Kursanbieter",
      type: isMock ? "mock" : "provider",
      rank: 5,
      fetchedAt: detail.quote.asOf,
      status: providerSourceStatus,
      note: `${sourceLabels[quoteQuality]} inklusive Provider, Timestamp und Latenzstatus.`
    },
    {
      name: "StockPilot Mock News Feed",
      type: "mock",
      rank: 4,
      fetchedAt: detail.news[0]?.publishedAt ?? detail.quote.asOf,
      status: missingNews ? "missing" : "fresh",
      note: "News sind nach Relevanz sortierte Demo-Daten."
    },
    {
      name: "Derived Technical Engine",
      type: "derived",
      rank: 3,
      fetchedAt: detail.quote.asOf,
      status: validation.valid ? "fresh" : "conflicting",
      note: "RSI, MACD, MAs, Bollinger, Support und Resistance werden aus verfuegbaren Kursdaten abgeleitet."
    }
  ];
  const warnings = [
    ...(isMock ? ["Mock-Daten sind Produktdaten und duerfen nicht als reale Marktdaten genutzt werden."] : []),
    ...(quoteQuality === "unavailable" ? ["Kursanbieter ist nicht erreichbar."] : []),
    ...(stale ? ["Daten sind veraltet und sollten vor Entscheidungen aktualisiert werden."] : []),
    ...(delayed && !stale ? ["Daten sind verzogert und nicht als Live-Kurs geeignet."] : []),
    ...(missingNews ? ["Keine verwertbaren News für dieses Symbol gefunden."] : []),
    ...(cryptoFundamentalGap ? ["Krypto-Fundamentaldaten sind strukturell nicht mit Aktien-Kennzahlen vergleichbar."] : [])
  ];
  const penalty =
    validation.issues.length * 12 +
    warnings.length * 7 +
    contradictions.length * 12 +
    (detail.news.length < 2 ? 8 : 0);
  const score = Math.max(0, Math.min(100, 92 - penalty));

  return {
    score,
    freshness: stale ? "stale" : delayed ? "delayed" : "fresh",
    sourceLabel: sourceLabels[quoteQuality],
    isMock,
    updatedAt: detail.quote.asOf,
    stale,
    sufficientForAnalysis: quoteQuality !== "unavailable" && score >= 58 && validation.valid,
    confidence: Math.max(10, Math.min(95, score - (contradictions.length ? 12 : 0))),
    issues: validation.issues,
    warnings,
    contradictions,
    sources
  };
}
