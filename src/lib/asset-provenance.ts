import type { AssetDetail, MarketDataQuality } from "@/lib/types";
import { buildAssetReadiness } from "@/lib/asset-readiness";

export type ProvenanceStatus = "fresh" | "delayed" | "stale" | "mock" | "missing" | "blocked";

export type AssetProvenanceEntry = {
  id: string;
  label: string;
  provider: string;
  quality: MarketDataQuality;
  status: ProvenanceStatus;
  asOf: string;
  receivedAt: string;
  timezone: string;
  currency: string;
  confidence: number;
  sourceReference: string;
  note: string;
};

export type AssetProvenancePassport = {
  symbol: string;
  generatedAt: string;
  readinessLabel: string;
  readinessStatus: ReturnType<typeof buildAssetReadiness>["status"];
  decision: "analysis_allowed" | "analysis_limited" | "analysis_blocked";
  primaryProvider: string;
  qualityScore: number;
  confidence: number;
  staleSources: number;
  missingSources: number;
  mockSources: number;
  entries: AssetProvenanceEntry[];
  blockers: string[];
  userMessage: string;
};

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function validTimestamp(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function ageMinutes(timestamp: string, now: Date) {
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - parsed.getTime()) / 60000);
}

function statusFromQuality(quality: MarketDataQuality, asOf: string, now: Date): ProvenanceStatus {
  if (quality === "mock") return "mock";
  if (quality === "unavailable") return "missing";
  const age = ageMinutes(asOf, now);
  if (!Number.isFinite(age) || age > 120) return "stale";
  if (quality === "delayed" || quality === "historical" || age > 20) return "delayed";
  return "fresh";
}

function entry(input: Omit<AssetProvenanceEntry, "confidence" | "receivedAt" | "status"> & {
  confidence: number;
  receivedAt?: string;
  status?: ProvenanceStatus;
  now: Date;
}): AssetProvenanceEntry {
  const asOf = validTimestamp(input.asOf, input.now.toISOString());
  return {
    id: input.id,
    label: input.label,
    provider: input.provider,
    quality: input.quality,
    status: input.status ?? statusFromQuality(input.quality, asOf, input.now),
    asOf,
    receivedAt: validTimestamp(input.receivedAt, input.now.toISOString()),
    timezone: input.timezone,
    currency: input.currency,
    confidence: clampScore(input.confidence),
    sourceReference: input.sourceReference,
    note: input.note
  };
}

function hasTrustedFundamentals(detail: AssetDetail) {
  return (
    Number.isFinite(detail.fundamentals.marketCap) && detail.fundamentals.marketCap > 0
  ) || detail.fundamentals.peRatio !== null || detail.fundamentals.dividendYield !== null;
}

function hasRealNews(detail: AssetDetail) {
  return detail.news.some((item) => item.url !== "#" && !item.source.toLowerCase().includes("mock"));
}

function hasUsableCandles(detail: AssetDetail) {
  return Object.values(detail.candles).some((candles) => candles.filter((candle) => Number.isFinite(candle.close) && candle.close > 0).length >= 8);
}

export function buildAssetProvenancePassport(detail: AssetDetail, now = new Date()): AssetProvenancePassport {
  const readiness = buildAssetReadiness(detail);
  const generatedAt = now.toISOString();
  const quoteAsOf = validTimestamp(detail.quote.asOf, generatedAt);
  const fundamentalsTrusted = hasTrustedFundamentals(detail);
  const realNews = hasRealNews(detail);
  const usableCandles = hasUsableCandles(detail);
  const primaryProvider = detail.quote.provider || "Unbekannter Anbieter";
  const entries: AssetProvenanceEntry[] = [
    entry({
      id: "quote",
      label: "Kursdaten",
      provider: primaryProvider,
      quality: detail.quote.quality,
      asOf: quoteAsOf,
      now,
      timezone: "Provider/Exchange",
      currency: detail.asset.currency,
      confidence: detail.dataQuality.confidence,
      sourceReference: `${detail.asset.symbol}:quote:${quoteAsOf}`,
      note: "Normalisierter Quote inklusive Provider, Datenqualität und Zeitstempel. Kein API-Key im Client."
    }),
    entry({
      id: "history",
      label: "Chart-Historie",
      provider: usableCandles ? primaryProvider : "nicht ausreichend geliefert",
      quality: usableCandles ? detail.quote.quality : "unavailable",
      status: usableCandles ? undefined : "missing",
      asOf: quoteAsOf,
      now,
      timezone: "Provider/Exchange",
      currency: detail.asset.currency,
      confidence: usableCandles ? Math.min(85, detail.dataQuality.confidence) : 15,
      sourceReference: `${detail.asset.symbol}:ohlcv:${quoteAsOf}`,
      note: usableCandles
        ? "Kerzenbasis ist ausreichend für Chart- und Indikatorberechnung."
        : "Nicht genügend belastbare Kerzen für eine vollständige Chartanalyse."
    }),
    entry({
      id: "fundamentals",
      label: "Fundamentaldaten",
      provider: fundamentalsTrusted ? primaryProvider : "Provider Contract Prepared",
      quality: fundamentalsTrusted ? detail.quote.quality : "unavailable",
      status: fundamentalsTrusted ? undefined : "missing",
      asOf: quoteAsOf,
      now,
      timezone: "Unternehmens-/Provider-Zeitpunkt",
      currency: detail.asset.currency,
      confidence: fundamentalsTrusted ? Math.min(80, detail.dataQuality.confidence) : 10,
      sourceReference: `${detail.asset.symbol}:fundamentals:${quoteAsOf}`,
      note: fundamentalsTrusted
        ? "Fundamentalwerte liegen in der Detaildatenbasis vor; Quellenstatus bleibt separat zu prüfen."
        : "Keine verifizierten Fundamentaldaten vom aktiven Anbieter. Es werden keine Ersatzwerte erfunden."
    }),
    entry({
      id: "news",
      label: "News & Events",
      provider: realNews ? detail.news[0]?.source ?? "News Provider" : "StockPilot Mock/Prepared News Layer",
      quality: realNews ? detail.quote.quality : "mock",
      status: realNews ? undefined : "mock",
      asOf: validTimestamp(detail.news[0]?.publishedAt, quoteAsOf),
      now,
      timezone: "Publisher",
      currency: detail.asset.currency,
      confidence: realNews ? Math.min(78, detail.dataQuality.confidence) : 20,
      sourceReference: `${detail.asset.symbol}:news:${detail.news[0]?.id ?? "none"}`,
      note: realNews
        ? "Mindestens eine Newsquelle ist als externe Quelle vorhanden."
        : "News sind Demo-/vorbereitete Daten und dürfen nicht als reale Meldungen behandelt werden."
    }),
    entry({
      id: "derived-analysis",
      label: "Technik, Scores und Risiken",
      provider: "StockPilot Deterministic Analysis Engine",
      quality: detail.dataQuality.sufficientForAnalysis ? detail.quote.quality : "unavailable",
      status: detail.riskReport.blockedAnalysis ? "blocked" : detail.dataQuality.sufficientForAnalysis ? undefined : "delayed",
      asOf: quoteAsOf,
      now,
      timezone: "System",
      currency: detail.asset.currency,
      confidence: detail.dataQuality.confidence,
      sourceReference: `${detail.asset.symbol}:analysis:${quoteAsOf}`,
      note: "Berechnete Indikatoren und Scores basieren auf den verfügbaren Daten. Kein Sprachmodell ersetzt die Berechnungen."
    })
  ];
  const blockers = [
    ...readiness.missingAreas.map((area) => `Fehlt: ${area}.`),
    ...detail.dataQuality.issues,
    ...detail.dataQuality.warnings,
    ...detail.dataQuality.contradictions
  ].filter(Boolean);
  const staleSources = entries.filter((item) => item.status === "stale").length;
  const missingSources = entries.filter((item) => item.status === "missing" || item.status === "blocked").length;
  const mockSources = entries.filter((item) => item.status === "mock" || item.quality === "mock").length;
  const decision =
    readiness.status === "blocked" || missingSources >= 3
      ? "analysis_blocked"
      : readiness.status === "limited" || staleSources > 0 || mockSources > 0
        ? "analysis_limited"
        : "analysis_allowed";

  return {
    symbol: detail.asset.symbol,
    generatedAt,
    readinessLabel: readiness.label,
    readinessStatus: readiness.status,
    decision,
    primaryProvider,
    qualityScore: readiness.qualityScore,
    confidence: readiness.confidence,
    staleSources,
    missingSources,
    mockSources,
    entries,
    blockers: [...new Set(blockers)].slice(0, 8),
    userMessage:
      decision === "analysis_blocked"
        ? "Für eine belastbare Einschätzung liegen derzeit nicht genügend verifizierte Daten vor."
        : decision === "analysis_limited"
          ? "Analyse ist möglich, aber mit reduzierter Konfidenz. Datenlücken und Quellenstatus müssen beachtet werden."
          : "Datenbasis ist für eine Research-Einordnung nutzbar. Es bleibt keine Anlageberatung."
  };
}
