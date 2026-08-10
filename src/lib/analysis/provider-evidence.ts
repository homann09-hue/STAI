import type { HistoricalDataIntegrity } from "@/lib/analysis/history-integrity";
import type {
  AssetDetail,
  Candle,
  DataQualityReport,
  MarketDataQuality
} from "@/lib/types";

type ProviderHistory = {
  candles: Candle[];
  note: string;
  provider: string | null;
  integrity: HistoricalDataIntegrity | null;
};

type ProviderEvidenceInput = {
  quote: {
    provider: string;
    quality: MarketDataQuality;
  };
  history: ProviderHistory;
  news: AssetDetail["news"];
  base: DataQualityReport;
};

function isUsableCandle(candle: Candle) {
  return (
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    candle.close > 0 &&
    candle.high >= candle.low
  );
}

function isExternalNews(item: AssetDetail["news"][number]) {
  const source = item.source.toLowerCase();
  return item.url !== "#" && !source.includes("mock") && !source.includes("demo");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function evidenceSource(
  template: DataQualityReport["sources"][number] | undefined,
  input: {
    name: string;
    type: string;
    fetchedAt: string;
    note: string;
  }
): DataQualityReport["sources"][number] | null {
  if (!template) return null;

  return {
    ...template,
    ...input,
    type: input.type as DataQualityReport["sources"][number]["type"]
  };
}

/**
 * Bewertet ausschließlich tatsächlich gelieferte Provider-Evidenz.
 *
 * Fundamentaldaten werden hier bewusst nicht angenommen. Eine ausreichende
 * Historie kann eine begrenzte technische Analyse freigeben, aber niemals eine
 * vollständige Unternehmensbewertung vortäuschen.
 */
export function assessProviderEvidence({
  quote,
  history,
  news,
  base
}: ProviderEvidenceInput): DataQualityReport {
  const usableCandles = history.candles.filter(isUsableCandle);
  const externalNews = news.filter(isExternalNews);
  const historyUsable =
    usableCandles.length >= 60 && history.integrity?.backtestStatus !== "blocked";
  const quoteUsable = quote.quality !== "mock" && quote.quality !== "unavailable";
  const sufficientForAnalysis = quoteUsable && !base.stale && historyUsable;
  const quoteTemplate =
    base.sources.find((source) => source.name === quote.provider) ??
    base.sources.find((source) => source.type === "provider") ??
    base.sources[0];
  const latestCandle = usableCandles.at(-1)?.timestamp ?? base.updatedAt;
  const latestNews = externalNews[0]?.publishedAt ?? base.updatedAt;
  const sources = [
    ...base.sources.filter((source) => source.type === "provider"),
    historyUsable && history.provider
      ? evidenceSource(quoteTemplate, {
          name: history.provider,
          type: "provider",
          fetchedAt: latestCandle,
          note: `${usableCandles.length} verwertbare OHLCV-Kerzen. ${history.note}`
        })
      : null,
    externalNews.length > 0
      ? evidenceSource(quoteTemplate, {
          name: unique(externalNews.map((item) => item.source)).join(", "),
          type: "provider",
          fetchedAt: latestNews,
          note: `${externalNews.length} externe Meldung(en) mit Quelle und Link.`
        })
      : null,
    ...base.sources
      .filter((source) => source.type !== "provider")
      .map((source) => ({
        ...source,
        status: sufficientForAnalysis ? ("fresh" as const) : ("missing" as const),
        note: sufficientForAnalysis
          ? "Verifizierte Kurs- und Historienevidenz erlaubt eine begrenzte technische Analyse; nicht belegte Bereiche bleiben separat ausgewiesen."
          : "Die verifizierte Evidenz reicht nicht für eine belastbare probabilistische Analyse."
      }))
  ].filter((source): source is DataQualityReport["sources"][number] => source !== null);

  const issues = [
    "Keine verifizierten Fundamentaldaten im aktiven Analysepfad.",
    !historyUsable
      ? `Historische Kursbasis nicht ausreichend: ${usableCandles.length} von mindestens 60 verwertbaren Kerzen.`
      : ""
  ];
  const warnings = [
    ...base.warnings,
    externalNews.length === 0
      ? "Keine verifizierten externen News für die aktuelle Analyse vorhanden."
      : "",
    quote.quality === "delayed" || quote.quality === "historical"
      ? "Die Kursbasis ist nicht realtime; zeitkritische Signale sind eingeschränkt."
      : "",
    history.integrity?.corporateActionAdjustment === "not_evidenced"
      ? "Historische Schlusskurse sind nicht nachweislich um Corporate Actions bereinigt."
      : "",
    ...(history.integrity?.issues ?? [])
  ];

  const rawScore =
    (quoteUsable ? 35 : 0) +
    (!base.stale ? 10 : 0) +
    (historyUsable ? 35 : Math.min(20, Math.round(usableCandles.length / 3))) +
    (history.integrity && history.integrity.backtestStatus !== "blocked" ? 10 : 0) +
    (externalNews.length > 0 ? 10 : 0);
  const qualityCap = quote.quality === "delayed" || quote.quality === "historical" ? 75 : 85;
  const score = Math.min(qualityCap, rawScore);
  const providers = unique([
    quote.provider,
    historyUsable ? history.provider ?? "" : "",
    ...externalNews.map((item) => item.source)
  ]);

  return {
    ...base,
    score,
    sourceLabel: providers.join(" + ") || base.sourceLabel,
    sufficientForAnalysis,
    confidence: sufficientForAnalysis ? Math.min(score, 72) : Math.min(score, 35),
    issues: unique(issues),
    warnings: unique(warnings),
    contradictions: unique(base.contradictions),
    sources
  };
}
