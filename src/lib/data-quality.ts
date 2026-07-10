import { z } from "zod";
import type { AssetDetail, DataQualityReport, DataSource, MarketDataQuality, MarketStatus } from "@/lib/types";

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
  delayed: "Verzögerte Daten",
  historical: "Historische Daten",
  mock: "Mock-Daten",
  unavailable: "Nicht verfügbar"
};

function finiteDelayMinutes(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.min(1440, Math.max(1, Math.round(value)))
    : 15;
}

function timestampAgeMinutes(timestamp: string, now: Date) {
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - parsed.getTime()) / 60000);
}

export type DataQualityDisplayInput = {
  quality: MarketDataQuality;
  marketStatus?: MarketStatus;
  delayedByMinutes?: number;
  fromCache?: boolean;
  offline?: boolean;
};

export function getDataQualityDisplay(input: DataQualityDisplayInput) {
  const delayedByMinutes = finiteDelayMinutes(input.delayedByMinutes);

  if (input.offline) {
    return {
      label: "OFFLINE",
      shortLabel: "OFFLINE",
      tone: "border-loss/35 bg-loss/10 text-loss",
      warning: "Offline: Es werden nur lokal gespeicherte Daten angezeigt."
    };
  }

  if (input.quality === "mock") {
    return {
      label: "MOCK",
      shortLabel: "MOCK",
      tone: "border-loss/35 bg-loss/10 text-loss",
      warning: "Mock-Daten sind Demo-/Produktdaten und dürfen nicht als echte Marktdaten interpretiert werden."
    };
  }

  if (input.quality === "unavailable") {
    return {
      label: "ERROR",
      shortLabel: "ERROR",
      tone: "border-loss/35 bg-loss/10 text-loss",
      warning: "Datenquelle aktuell nicht verfügbar. Keine aktuellen Signale ableiten."
    };
  }

  if (input.fromCache) {
    return {
      label: "CACHED",
      shortLabel: "CACHED",
      tone: "border-amber/35 bg-amber/10 text-amber",
      warning: "Zwischengespeicherte Daten. Aktualität vor Entscheidungen prüfen."
    };
  }

  if (input.marketStatus === "closed") {
    return {
      label: "MARKET CLOSED",
      shortLabel: "CLOSED",
      tone: "border-amber/35 bg-amber/10 text-amber",
      warning: "Markt geschlossen. Kurse können nachbörslich oder veraltet sein."
    };
  }

  if (input.quality === "realtime") {
    return {
      label: "REALTIME",
      shortLabel: "REALTIME",
      tone: "border-profit/35 bg-profit/10 text-profit",
      warning: null
    };
  }

  if (input.quality === "near_realtime") {
    return {
      label: "NEAR_REALTIME",
      shortLabel: "NEAR",
      tone: "border-cyan/35 bg-cyan/10 text-cyan",
      warning: "Near-Realtime ist kein lizenzierter Millisekunden-Feed."
    };
  }

  if (input.quality === "delayed") {
    return {
      label: `DELAYED ${delayedByMinutes} MIN`,
      shortLabel: "DELAYED",
      tone: "border-amber/35 bg-amber/10 text-amber",
      warning: "Verzögerte Daten. Nicht als Live-Kurs verwenden."
    };
  }

  return {
    label: "HISTORICAL",
    shortLabel: "HISTORICAL",
    tone: "border-amber/35 bg-amber/10 text-amber",
    warning: "Historische Daten. Keine aktuellen Signale ableiten."
  };
}

export function validateAssetData(detail: Pick<AssetDetail, "asset" | "quote" | "news" | "fundamentals" | "candles">) {
  const issues: string[] = [];
  const quote = quoteSchema.safeParse(detail.quote);

  if (!quote.success) issues.push("Kursdaten sind unvollständig oder ungültig.");
  if (!detail.asset.symbol || !detail.asset.name) issues.push("Asset-Stammdaten fehlen.");
  if (!Object.values(detail.candles).every((items) => items.length >= 10)) {
    issues.push("Mindestens ein Chart-Zeitraum hat zu wenige Kerzen.");
  }
  if (!detail.news.every((item) => newsSchema.safeParse(item).success)) {
    issues.push("Mindestens eine News-Quelle ist unvollständig.");
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
  const quoteAgeMinutes = timestampAgeMinutes(detail.quote.asOf, now);
  const hasInvalidQuoteTimestamp = !Number.isFinite(quoteAgeMinutes);
  const quoteQuality = detail.quote.quality ?? "mock";
  const sourceLabel = sourceLabels[quoteQuality] ?? sourceLabels.unavailable;
  const stale = hasInvalidQuoteTimestamp || quoteAgeMinutes > 60;
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
      note: `${sourceLabel} inklusive Provider, Timestamp und Latenzstatus.`
    },
    {
      name: "StockPilot Mock News Feed",
      type: "mock",
      rank: 4,
      fetchedAt: detail.news[0]?.publishedAt ?? detail.quote.asOf,
      status: missingNews ? "missing" : "fresh",
      note: "News sind nach Relevanz sortierte Mock-Daten und keine bestätigten Realnachrichten."
    },
    {
      name: "Derived Technical Engine",
      type: "derived",
      rank: 3,
      fetchedAt: detail.quote.asOf,
      status: validation.valid ? "fresh" : "conflicting",
      note: "RSI, MACD, MAs, Bollinger, Support und Resistance werden aus verfügbaren Kursdaten abgeleitet."
    }
  ];
  const warnings = [
    ...(isMock ? ["Mock-Daten sind Demo-/Produktdaten und dürfen nicht als reale Marktdaten genutzt werden."] : []),
    ...(quoteQuality === "unavailable" ? ["Kursanbieter ist nicht erreichbar."] : []),
    ...(hasInvalidQuoteTimestamp ? ["Kurs-Zeitstempel ist ungültig. Aktualität kann nicht bestätigt werden."] : []),
    ...(stale ? ["Daten sind veraltet und sollten vor Entscheidungen aktualisiert werden."] : []),
    ...(delayed && !stale ? ["Daten sind verzögert und nicht als Live-Kurs geeignet."] : []),
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
    sourceLabel,
    isMock,
    updatedAt: detail.quote.asOf,
    stale,
    sufficientForAnalysis: quoteQuality !== "unavailable" && quoteQuality !== "mock" && !stale && score >= 58 && validation.valid,
    confidence: Math.max(10, Math.min(95, score - (contradictions.length ? 12 : 0))),
    issues: validation.issues,
    warnings,
    contradictions,
    sources
  };
}
