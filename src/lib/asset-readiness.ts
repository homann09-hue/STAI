import { formatCompact, formatCurrency, formatPercent } from "@/lib/scoring";
import type { AssetDetail, MarketDataQuality } from "@/lib/types";

export type AssetReadinessStatus = "ready" | "limited" | "blocked";

export interface AssetReadiness {
  status: AssetReadinessStatus;
  label: string;
  detail: string;
  confidence: number;
  qualityScore: number;
  trustedFundamentals: boolean;
  trustedNews: boolean;
  trustedHistory: boolean;
  coverage: Array<{
    label: string;
    available: boolean;
    quality: MarketDataQuality;
    note: string;
  }>;
  missingAreas: string[];
}

export interface AssetFundamentalMetric {
  label: string;
  value: string;
  available: boolean;
  note: string;
}

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function hasUsefulCandles(detail: AssetDetail) {
  return Object.values(detail.candles).some((candles) => candles.filter((candle) => Number.isFinite(candle.close) && candle.close > 0).length >= 8);
}

function hasRealNews(detail: AssetDetail) {
  return detail.news.some((item) => item.url !== "#" && !item.source.toLowerCase().includes("mock"));
}

function hasTrustedFundamentals(detail: AssetDetail) {
  return (
    (Number.isFinite(detail.fundamentals.marketCap) && detail.fundamentals.marketCap > 0) ||
    detail.fundamentals.peRatio !== null ||
    detail.fundamentals.dividendYield !== null ||
    detail.fundamentals.cashflow !== 0 ||
    detail.fundamentals.revenueGrowth !== 0 ||
    detail.fundamentals.earningsGrowth !== 0
  );
}

function unavailableFundamental(label: string): AssetFundamentalMetric {
  return {
    label,
    value: "nicht geliefert",
    available: false,
    note: "Kein verifizierter Fundamentalwert vom aktiven Anbieter. STAI zeigt hier bewusst keinen Ersatzwert."
  };
}

function maybeNumber(label: string, value: number | null | undefined, formatter: (value: number) => string, available: boolean): AssetFundamentalMetric {
  if (!available || value === null || value === undefined || !Number.isFinite(value)) return unavailableFundamental(label);

  return {
    label,
    value: formatter(value),
    available: true,
    note: "Verfügbarer Fundamentalwert aus der aktuellen Detaildatenbasis. Datenqualität und Quelle separat prüfen."
  };
}

export function buildAssetReadiness(detail: AssetDetail): AssetReadiness {
  const trustedFundamentals = hasTrustedFundamentals(detail);
  const trustedNews = hasRealNews(detail);
  const trustedHistory = hasUsefulCandles(detail) && detail.dataQuality.score >= 35;
  const missingAreas = [
    !trustedFundamentals ? "verifizierte Fundamentaldaten" : null,
    !trustedNews ? "echte News/Events" : null,
    !trustedHistory ? "belastbare historische Kerzen" : null,
    detail.riskReport.blockedAnalysis ? "freigegebene Risikoanalyse" : null
  ].filter((item): item is string => Boolean(item));
  const dataBlocked = detail.dataQuality.confidence < 30 || (!trustedFundamentals && missingAreas.length >= 3);
  const blocked = dataBlocked;
  const limited = !blocked && (detail.riskReport.blockedAnalysis || !detail.dataQuality.sufficientForAnalysis || missingAreas.length > 0);

  return {
    status: blocked ? "blocked" : limited ? "limited" : "ready",
    label: blocked ? "Analyse blockiert" : limited ? "Analyse eingeschränkt" : "Analyse nutzbar",
    detail: blocked
      ? "Für eine belastbare Einschätzung liegen derzeit nicht genügend verifizierte Daten vor."
      : limited
        ? "Einige Datenbereiche fehlen oder sind nur eingeschränkt belastbar. Scores bleiben mit reduzierter Konfidenz sichtbar."
        : "Kurs, Historie, Risiko und Analysefelder sind für eine Research-Einordnung ausreichend belegt.",
    confidence: clampScore(detail.dataQuality.confidence),
    qualityScore: clampScore(detail.dataQuality.score),
    trustedFundamentals,
    trustedNews,
    trustedHistory,
    missingAreas,
    coverage: [
      {
        label: "Kursdaten",
        available: detail.quote.quality !== "unavailable",
        quality: detail.quote.quality,
        note: `${detail.quote.provider}, Stand ${detail.quote.asOf}`
      },
      {
        label: "Fundamentals",
        available: trustedFundamentals,
        quality: trustedFundamentals ? detail.quote.quality : "unavailable",
        note: trustedFundamentals ? "Kennzahlen verfügbar." : "Nicht ausreichend verifiziert."
      },
      {
        label: "News/Events",
        available: trustedNews,
        quality: trustedNews ? detail.quote.quality : "unavailable",
        note: trustedNews ? "Mindestens eine echte Newsquelle vorhanden." : "Keine echte Newsquelle in der Detaildatenbasis."
      },
      {
        label: "Historie/Chart",
        available: trustedHistory,
        quality: trustedHistory ? detail.quote.quality : "unavailable",
        note: trustedHistory ? "Kerzenbasis ausreichend für Chartanalyse." : "Historie nicht ausreichend belastbar."
      },
      {
        label: "Prognose",
        available: !blocked,
        quality: blocked ? "unavailable" : detail.quote.quality,
        note: blocked ? "Nur Datenlücken anzeigen, keine scheinpräzise Prognose." : "Modellierte Wahrscheinlichkeiten mit Warnhinweis."
      }
    ]
  };
}

export function buildFundamentalMetrics(detail: AssetDetail): AssetFundamentalMetric[] {
  const available = hasTrustedFundamentals(detail);
  const currency = detail.asset.currency;

  return [
    maybeNumber("KGV", detail.fundamentals.peRatio, (value) => value.toFixed(2), available),
    maybeNumber("Umsatzwachstum", detail.fundamentals.revenueGrowth, formatPercent, available),
    maybeNumber("Gewinnwachstum", detail.fundamentals.earningsGrowth, formatPercent, available),
    maybeNumber("Verschuldung", detail.fundamentals.debtToEquity, (value) => `${value.toFixed(2)} D/E`, available),
    maybeNumber("Cashflow", detail.fundamentals.cashflow, formatCompact, available),
    maybeNumber("Dividende", detail.fundamentals.dividendYield, (value) => `${value.toFixed(2)}%`, available),
    maybeNumber("Marktkapitalisierung", detail.fundamentals.marketCap, formatCompact, available),
    maybeNumber("Aktueller Kurs", detail.quote.price, (value) => formatCurrency(value, currency), detail.quote.quality !== "unavailable")
  ];
}
