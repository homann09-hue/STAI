import type {
  AssetScoreEvidence,
  Candle,
  DataQualityReport,
  Fundamentals,
  FundamentalsEvidence,
  MarketDataQuality,
  NewsItem,
  ProfessionalScores,
  Quote,
  ScoreEvidencePoint,
  Scores,
  TechnicalIndicators
} from "@/lib/types";

const SCORE_MODEL_VERSION = "stockpilot-evidence-scores-v1";
const SCORE_KEYS = ["trend", "news", "fundamental", "technical", "risk", "total"] as const;

type ScoreCarrier = {
  scores: Scores;
  scoreEvidence?: AssetScoreEvidence;
  dataQuality?: DataQualityReport | null;
  quote: {
    quality: MarketDataQuality;
    provider: string;
    asOf?: string;
    timestamp?: string;
  };
};

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function unavailable(asOf: string, rationale: string): ScoreEvidencePoint {
  return { value: null, availability: "unavailable", confidence: 0, sources: [], asOf, rationale };
}

function point(input: Omit<ScoreEvidencePoint, "value" | "confidence"> & { value: number; confidence: number }) {
  return {
    ...input,
    value: clamp(input.value),
    confidence: clamp(input.confidence),
    sources: unique(input.sources)
  } satisfies ScoreEvidencePoint;
}

function usableCandles(candles: Candle[]) {
  return candles
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
    );
}

function percentChange(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return 0;
  return ((end - start) / start) * 100;
}

function trailingReturn(candles: Candle[], periods: number) {
  const latest = candles.at(-1)?.close;
  const first = candles[Math.max(0, candles.length - 1 - periods)]?.close;
  return latest === undefined || first === undefined ? 0 : percentChange(first, latest);
}

function volatilityAndDrawdown(candles: Candle[]) {
  const returns = candles
    .slice(1)
    .map((candle, index) => Math.log(candle.close / candles[index].close))
    .filter(Number.isFinite);
  if (returns.length < 20) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, returns.length - 1);
  const volatility = Math.sqrt(Math.max(0, variance)) * Math.sqrt(252) * 100;
  let peak = candles[0].close;
  let maxDrawdown = 0;
  for (const candle of candles) {
    peak = Math.max(peak, candle.close);
    maxDrawdown = Math.max(maxDrawdown, ((peak - candle.close) / peak) * 100);
  }
  return { volatility, maxDrawdown };
}

function externalNews(news: NewsItem[]) {
  return news.filter(
    (item) =>
      item.url !== "#" &&
      !item.source.toLowerCase().includes("mock") &&
      !item.source.toLowerCase().includes("demo")
  );
}

function weightedValue(points: Array<{ point: ScoreEvidencePoint; weight: number }>) {
  const available = points.filter(
    (entry): entry is { point: ScoreEvidencePoint & { value: number }; weight: number } =>
      entry.point.value !== null
  );
  const weight = available.reduce((sum, entry) => sum + entry.weight, 0);
  return weight
    ? available.reduce((sum, entry) => sum + entry.point.value * entry.weight, 0) / weight
    : null;
}

export function buildQuoteOnlyScoreEvidence(quote: Quote): AssetScoreEvidence {
  const dimensions = Object.fromEntries(
    SCORE_KEYS.map((key) => [
      key,
      unavailable(
        quote.asOf,
        "Ein einzelner Kursstand reicht nicht für einen belastbaren Score. Historie und weitere verifizierte Evidenz fehlen."
      )
    ])
  ) as Record<keyof Scores, ScoreEvidencePoint>;
  return { version: SCORE_MODEL_VERSION, generatedAt: quote.asOf, dimensions };
}

export function buildEvidenceBoundScores(input: {
  quote: Quote;
  candles: Candle[];
  indicators: TechnicalIndicators;
  fundamentals: Fundamentals;
  fundamentalsEvidence?: FundamentalsEvidence;
  news: NewsItem[];
  historyProvider: string | null;
}): AssetScoreEvidence {
  const candles = usableCandles(input.candles);
  const asOf = candles.at(-1)?.timestamp || candles.at(-1)?.time || input.quote.asOf;
  const historySources = input.historyProvider ? [input.historyProvider] : [];
  const insufficientHistory = candles.length < 60;
  const trend = insufficientHistory
    ? unavailable(asOf, `Trend-Score zurückgehalten: ${candles.length} von mindestens 60 Kurskerzen verfügbar.`)
    : point({
        value:
          50 +
          Math.max(-20, Math.min(20, trailingReturn(candles, 20))) * 1.25 +
          Math.max(-40, Math.min(40, trailingReturn(candles, 60))) * 0.625,
        availability: candles.length >= 200 ? "available" : "partial",
        confidence: Math.min(88, 42 + candles.length / 5),
        sources: historySources,
        asOf,
        sampleSize: candles.length,
        rationale: `Aus gemessener 20- und 60-Perioden-Rendite auf ${candles.length} Provider-Kerzen; kein Kauf- oder Verkaufssignal.`
      });

  const technicalSignals: number[] = [];
  const latestPrice = candles.at(-1)?.close;
  const ma = input.indicators.movingAverages;
  if (latestPrice !== undefined && ma.ma20 !== null) technicalSignals.push(latestPrice >= ma.ma20 ? 8 : -8);
  if (ma.ma20 !== null && ma.ma50 !== null) technicalSignals.push(ma.ma20 >= ma.ma50 ? 10 : -10);
  if (latestPrice !== undefined && ma.ma200 !== null) technicalSignals.push(latestPrice >= ma.ma200 ? 12 : -12);
  if (input.indicators.macd !== null) technicalSignals.push(input.indicators.macd.histogram >= 0 ? 8 : -8);
  if (input.indicators.adx !== null && input.indicators.adx.adx >= 20) {
    technicalSignals.push(input.indicators.adx.plusDi >= input.indicators.adx.minusDi ? 8 : -8);
  }
  const technical = insufficientHistory || technicalSignals.length < 2
    ? unavailable(asOf, "Technical-Score zurückgehalten: zu wenige verifizierte Indikatoren oder Kurskerzen.")
    : point({
        value: 50 + technicalSignals.reduce((sum, value) => sum + value, 0),
        availability: candles.length >= 200 && technicalSignals.length >= 4 ? "available" : "partial",
        confidence: Math.min(88, 38 + candles.length / 5 + technicalSignals.length * 4),
        sources: historySources,
        asOf,
        sampleSize: candles.length,
        rationale: `${technicalSignals.length} belegte Signale aus gleitenden Durchschnitten, MACD und ADX; fehlende Indikatoren werden nicht neutral gewertet.`
      });

  const news = externalNews(input.news);
  const newsWeighted = news.reduce(
    (sum, item) => {
      const sentiment = item.sentiment === "positive" ? 70 : item.sentiment === "negative" ? 30 : 50;
      const weight = item.relevance === null ? 1 : Math.max(0.1, item.relevance / 100);
      return { total: sum.total + sentiment * weight, weight: sum.weight + weight };
    },
    { total: 0, weight: 0 }
  );
  const newsPoint = news.length
    ? point({
        value: newsWeighted.total / newsWeighted.weight,
        availability: news.length >= 3 ? "available" : "partial",
        confidence: Math.min(82, 38 + news.length * 10),
        sources: news.map((item) => item.source),
        asOf: news[0]?.publishedAt ?? asOf,
        sampleSize: news.length,
        rationale: `${news.length} externe Meldung(en), nach gelieferter Relevanz gewichtet; Meldungen ohne Relevanz erhalten einfaches Gewicht.`
      })
    : unavailable(asOf, "News-Score zurückgehalten: keine externe Meldung mit Quelle und Link verfügbar.");

  const verifiedFields = new Set(input.fundamentalsEvidence?.verifiedFields ?? []);
  const fundamentalSignals: number[] = [];
  if (verifiedFields.has("revenueGrowth")) fundamentalSignals.push(Math.max(-12, Math.min(12, input.fundamentals.revenueGrowth * 0.4)));
  if (verifiedFields.has("earningsGrowth")) fundamentalSignals.push(Math.max(-12, Math.min(12, input.fundamentals.earningsGrowth * 0.35)));
  if (verifiedFields.has("debtToEquity")) {
    const debt = input.fundamentals.debtToEquity;
    fundamentalSignals.push(debt < 0 ? -8 : debt <= 0.5 ? 8 : debt > 2 ? -8 : 0);
  }
  if (verifiedFields.has("cashflow")) fundamentalSignals.push(input.fundamentals.cashflow > 0 ? 8 : input.fundamentals.cashflow < 0 ? -8 : 0);
  const fundamental = fundamentalSignals.length < 2
    ? unavailable(asOf, "Fundamental-Score zurückgehalten: weniger als zwei richtungsrelevante Providerfelder sind verifiziert.")
    : point({
        value: 50 + fundamentalSignals.reduce((sum, value) => sum + value, 0),
        availability: "partial",
        confidence: Math.min(72, 32 + fundamentalSignals.length * 9),
        sources: input.fundamentalsEvidence ? [input.fundamentalsEvidence.provider] : [],
        asOf: input.fundamentalsEvidence?.fetchedAt ?? asOf,
        sampleSize: fundamentalSignals.length,
        rationale: `${fundamentalSignals.length} verifizierte Wachstums-, Verschuldungs- oder Cashflow-Felder. Ohne Branchenbenchmark und Point-in-Time-Historie bleibt der Score partiell.`
      });

  const riskMetrics = insufficientHistory ? null : volatilityAndDrawdown(candles);
  const risk = riskMetrics
    ? point({
        value: riskMetrics.volatility * 1.1 + riskMetrics.maxDrawdown * 0.8,
        availability: candles.length >= 200 ? "available" : "partial",
        confidence: Math.min(86, 40 + candles.length / 5),
        sources: historySources,
        asOf,
        sampleSize: candles.length,
        rationale: `Historisches Risiko aus annualisierter Volatilität (${riskMetrics.volatility.toFixed(1)} %) und maximalem Drawdown (${riskMetrics.maxDrawdown.toFixed(1)} %). Höher bedeutet höheres gemessenes Risiko.`
      })
    : unavailable(asOf, "Risiko-Score zurückgehalten: keine ausreichende Kurshistorie für Volatilität und Drawdown.");

  const riskContribution = risk.value === null ? risk : { ...risk, value: 100 - risk.value };
  const inputs = [
    { point: trend, weight: 0.22 },
    { point: newsPoint, weight: 0.18 },
    { point: fundamental, weight: 0.24 },
    { point: technical, weight: 0.22 },
    { point: riskContribution, weight: 0.14 }
  ];
  const weighted = weightedValue(inputs);
  const requiredMarketEvidence = trend.value !== null && technical.value !== null && risk.value !== null;
  const hasContextEvidence = newsPoint.value !== null || fundamental.value !== null;
  const confidenceInputs = inputs.map((entry) => ({
    point: { ...entry.point, value: entry.point.value === null ? null : entry.point.confidence },
    weight: entry.weight
  }));
  const total = requiredMarketEvidence && hasContextEvidence && weighted !== null
    ? point({
        value: weighted,
        availability: inputs.every((entry) => entry.point.availability === "available") ? "available" : "partial",
        confidence: weightedValue(confidenceInputs) ?? 0,
        sources: unique(inputs.flatMap((entry) => entry.point.sources)),
        asOf,
        rationale: "Gewichteter Gesamtscore ausschließlich aus verfügbaren Evidenzdimensionen; fehlende Dimensionen werden nicht als neutrale Werte eingesetzt."
      })
    : unavailable(asOf, "Gesamt-Score zurückgehalten: Markt-, Risiko- und mindestens eine Kontextdimension sind noch nicht gemeinsam belegt.");

  return {
    version: SCORE_MODEL_VERSION,
    generatedAt: asOf,
    dimensions: { trend, news: newsPoint, fundamental, technical, risk, total }
  };
}

export function scoresFromEvidence(evidence: AssetScoreEvidence): Scores {
  return Object.fromEntries(SCORE_KEYS.map((key) => [key, evidence.dimensions[key].value ?? 0])) as unknown as Scores;
}

export function professionalScoresFromEvidence(evidence: AssetScoreEvidence): ProfessionalScores {
  const dimensions = evidence.dimensions;
  const riskTotal = dimensions.risk.value ?? 0;
  return {
    technical: dimensions.technical.value ?? 0,
    fundamental: dimensions.fundamental.value ?? 0,
    news: dimensions.news.value ?? 0,
    sentiment: dimensions.news.value ?? 0,
    momentum: dimensions.trend.value ?? 0,
    volatilityRisk: riskTotal,
    liquidityRisk: 0,
    eventRisk: 0,
    opportunityTotal: dimensions.total.value ?? 0,
    riskTotal,
    probabilityUp: 0,
    probabilityDown: 0,
    probabilitySideways: 0,
    explanation: SCORE_KEYS.map((key) => `${key}: ${dimensions[key].rationale}`)
  };
}

export function scorePoint(summary: ScoreCarrier, key: keyof Scores): ScoreEvidencePoint {
  const evidence = summary.scoreEvidence?.dimensions[key];
  if (evidence) return evidence;
  const asOf = summary.quote.asOf ?? summary.quote.timestamp ?? "unbekannt";
  if (summary.dataQuality?.isMock || summary.quote.quality === "mock") {
    return unavailable(asOf, "Mock-Daten dürfen keinen nutzbaren Analyse-Score erzeugen.");
  }
  return unavailable(asOf, "Keine Score-Provenienz verfügbar; Wert wird nicht angezeigt.");
}

export function scoreValue(summary: ScoreCarrier, key: keyof Scores) {
  return scorePoint(summary, key).value;
}
