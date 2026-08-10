import type { AiAnalysis, AssetDetail, Candle } from "@/lib/types";

const MODEL_VERSION = "stockpilot-evidence-analysis-v1";
const MINIMUM_CANDLES = 60;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function percentChange(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return 0;
  return ((end - start) / start) * 100;
}

function validCandles(detail: AssetDetail) {
  const candidates = Object.values(detail.candles).map((series) =>
    series
      .filter(
        (candle) =>
          Number.isFinite(candle.close) &&
          Number.isFinite(candle.high) &&
          Number.isFinite(candle.low) &&
          candle.close > 0 &&
          candle.high >= candle.low
      )
      .sort(
        (left, right) =>
          new Date(left.timestamp || left.time).getTime() -
          new Date(right.timestamp || right.time).getTime()
      )
  );

  return candidates.reduce<Candle[]>(
    (longest, current) => (current.length > longest.length ? current : longest),
    []
  );
}

function dailyReturns(candles: Candle[]) {
  return candles
    .slice(1)
    .map((candle, index) => Math.log(candle.close / candles[index].close))
    .filter(Number.isFinite);
}

function annualizedVolatility(candles: Candle[]) {
  const returns = dailyReturns(candles);
  if (returns.length < 20) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, returns.length - 1);
  return Math.sqrt(Math.max(0, variance)) * Math.sqrt(252) * 100;
}

function measuredReturn(candles: Candle[], periods: number) {
  if (candles.length < 2) return 0;
  const start = candles[Math.max(0, candles.length - 1 - periods)];
  return percentChange(start.close, candles.at(-1)?.close ?? start.close);
}

function probabilities(recentReturn: number, mediumReturn: number, volatility: number) {
  const twentyDayScale = Math.max(5, (volatility / Math.sqrt(252)) * Math.sqrt(20));
  const sixtyDayScale = Math.max(8, (volatility / Math.sqrt(252)) * Math.sqrt(60));
  const signal = clamp(
    (recentReturn / twentyDayScale) * 0.55 + (mediumReturn / sixtyDayScale) * 0.45,
    -1,
    1
  );
  const sideways = Math.round(clamp(40 - Math.abs(signal) * 15 + (volatility < 15 ? 5 : 0), 20, 50));
  const directional = 100 - sideways;
  const up = Math.round(directional * (0.5 + signal * 0.25));

  return {
    up,
    down: 100 - sideways - up,
    sideways
  };
}

function riskLevel(volatility: number, reported: string): AiAnalysis["riskLevel"] {
  const measured: AiAnalysis["riskLevel"] =
    volatility >= 65 ? "extrem" : volatility >= 35 ? "hoch" : volatility >= 18 ? "mittel" : "niedrig";
  const levels: AiAnalysis["riskLevel"][] = ["niedrig", "mittel", "hoch", "extrem"];
  const reportedLevel = levels.includes(reported as AiAnalysis["riskLevel"])
    ? (reported as AiAnalysis["riskLevel"])
    : "mittel";
  return levels[Math.max(levels.indexOf(measured), levels.indexOf(reportedLevel))];
}

function externalNews(detail: AssetDetail) {
  return detail.news.filter(
    (item) =>
      item.url !== "#" &&
      !item.source.toLowerCase().includes("mock") &&
      !item.source.toLowerCase().includes("demo")
  );
}

function newsBySentiment(news: AssetDetail["news"], sentiment: "positive" | "negative") {
  return news.filter((item) => {
    const value = `${item.sentiment}`.toLowerCase();
    return sentiment === "positive" ? value.startsWith("pos") : value.startsWith("neg");
  });
}

function sourceLabels(detail: AssetDetail) {
  const sources = detail.dataQuality.sources.map(
    (source) => `${source.name}, Stand ${source.fetchedAt}`
  );
  return [...new Set(sources)].slice(0, 8);
}

/**
 * Erstellt eine rein deterministische Erklärung aus verifizierter Evidenz.
 * Das Modul ruft kein Sprachmodell auf und erfindet keine fehlenden Werte.
 */
export function buildEvidenceBoundAnalysis(detail: AssetDetail): AiAnalysis | null {
  const candles = validCandles(detail);
  if (
    !detail.dataQuality.sufficientForAnalysis ||
    detail.dataQuality.stale ||
    detail.quote.quality === "mock" ||
    detail.quote.quality === "unavailable" ||
    candles.length < MINIMUM_CANDLES
  ) {
    return null;
  }

  const volatility = annualizedVolatility(candles);
  if (volatility === null) return null;

  const recentReturn = measuredReturn(candles, 20);
  const mediumReturn = measuredReturn(candles, 60);
  const estimate = probabilities(recentReturn, mediumReturn, volatility);
  const news = externalNews(detail);
  const positiveNews = newsBySentiment(news, "positive");
  const negativeNews = newsBySentiment(news, "negative");
  const risk = riskLevel(volatility, detail.riskReport.level);
  const uncertainty: AiAnalysis["uncertainty"] =
    detail.dataQuality.confidence >= 70 && candles.length >= 200
      ? "niedrig"
      : detail.dataQuality.confidence >= 50
        ? "mittel"
        : "hoch";
  const latest = candles.at(-1);
  const dataGaps = [...detail.dataQuality.issues, ...detail.dataQuality.warnings];
  const upsideDrivers = [
    recentReturn > 0
      ? `Der gemessene 20-Perioden-Trend liegt bei ${recentReturn.toFixed(1)} %.`
      : "Kein positiver kurzfristiger Preistrend als Treiber bestätigt.",
    mediumReturn > 0
      ? `Der gemessene 60-Perioden-Trend liegt bei ${mediumReturn.toFixed(1)} %.`
      : "Kein positiver mittelfristiger Preistrend als Treiber bestätigt.",
    ...positiveNews.slice(0, 2).map((item) => `Positiv klassifizierte Meldung: ${item.title}`)
  ];
  const downsideDrivers = [
    recentReturn < 0
      ? `Der gemessene 20-Perioden-Trend liegt bei ${recentReturn.toFixed(1)} %.`
      : "Kein negativer kurzfristiger Preistrend als Treiber bestätigt.",
    `Die annualisierte historische Volatilität beträgt modelliert ${volatility.toFixed(1)} %.`,
    ...negativeNews.slice(0, 2).map((item) => `Negativ klassifizierte Meldung: ${item.title}`)
  ];
  const direction = recentReturn > 1 ? "positiv" : recentReturn < -1 ? "negativ" : "seitwärts";

  return {
    summary: `Die deterministische Evidenzanalyse bewertet den kurzfristigen Trend als ${direction}. Sie basiert auf ${candles.length} verifizierten Kurskerzen und ${news.length} externen Meldung(en).`,
    upsideDrivers,
    downsideDrivers,
    counterArguments: [
      "Historische Preisbewegungen garantieren keine zukünftige Entwicklung.",
      "Ein Trendwechsel oder ein nicht erfasstes Ereignis kann die Einordnung kurzfristig entkräften.",
      "Fundamentale Bewertung und technische Dynamik können voneinander abweichen."
    ],
    dataGaps: dataGaps.length
      ? [...new Set(dataGaps)].slice(0, 8)
      : ["Keine wesentlichen Datenlücken im verwendeten technischen Analyseumfang erkannt."],
    bullCase: `Ein Bull Case setzt voraus, dass der 20-Perioden-Trend über dem aktuellen Datenstand von ${recentReturn.toFixed(1)} % stabil bleibt und neue Evidenz die Aufwärtsbewegung bestätigt.`,
    bearCase: `Ein Bear Case wird wahrscheinlicher, wenn der kurzfristige Trend dreht und die gemessene Volatilität von ${volatility.toFixed(1)} % zu größeren Abwärtsbewegungen führt.`,
    neutralCase: "Das Neutral-Szenario unterstellt eine Konsolidierung ohne belastbaren Ausbruch und ohne neue kurstreibende Evidenz.",
    shortTerm: `Kurzfristig ergibt das Modell ${estimate.up} % Aufwärts-, ${estimate.down} % Abwärts- und ${estimate.sideways} % Seitwärtswahrscheinlichkeit.`,
    mediumTerm: `Mittelfristig dient die gemessene 60-Perioden-Entwicklung von ${mediumReturn.toFixed(1)} % als Trendindikator, nicht als Kursziel.`,
    longTerm: "Langfristig wird ohne verifizierte Fundamentaldaten, Bewertung und Point-in-Time-Unternehmenshistorie keine belastbare Aussage erzeugt.",
    riskLevel: risk,
    uncertainty,
    probabilities: estimate,
    sources: sourceLabels(detail),
    weakDataWarning:
      dataGaps.length > 0
        ? "Die Analyse ist auf den verifizierten technischen Umfang begrenzt. Aufgeführte Datenlücken reduzieren die Aussagekraft."
        : null,
    modelNote: `${MODEL_VERSION}. Deterministisches Evidenzmodell, Daten-Cutoff ${latest?.timestamp ?? detail.quote.asOf}. Wahrscheinlichkeiten sind modellbasierte Schätzungen, keine Garantie und keine Anlageberatung.`
  };
}
