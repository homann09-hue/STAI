import { calculateVolatility } from "@/lib/scoring";
import type { AssetDetail, DataQualityReport, RiskEngineReport, RiskFinding, RiskLevel } from "@/lib/types";

function severityWeight(level: RiskLevel) {
  return level === "extrem" ? 34 : level === "hoch" ? 24 : level === "mittel" ? 14 : 6;
}

function reportLevel(score: number): RiskLevel {
  if (score >= 82) return "extrem";
  if (score >= 62) return "hoch";
  if (score >= 34) return "mittel";
  return "niedrig";
}

function finding(input: RiskFinding) {
  return input;
}

export function buildRiskReport(
  detail: Pick<
    AssetDetail,
    | "asset"
    | "quote"
    | "candles"
    | "indicators"
    | "news"
    | "earningsDate"
    | "professionalScores"
    | "analysisLayers"
    | "macroFactors"
  >,
  dataQuality: DataQualityReport,
  now = new Date()
): RiskEngineReport {
  const findings: RiskFinding[] = [];
  const candles = detail.candles["1M"];
  const volatility = calculateVolatility(candles);
  const latest = candles[candles.length - 1];
  const first = candles[0];
  const monthlyMove = first ? ((latest.close - first.close) / Math.max(first.close, 0.01)) * 100 : 0;
  const positiveNews = detail.news.some((item) => item.sentiment === "positive" && item.relevance >= 70);
  const negativeNews = detail.news.filter((item) => item.sentiment === "negative" && item.relevance >= 70);
  const recentVolumes = candles.slice(-8).map((item) => item.volume);
  const olderVolumes = candles.slice(-16, -8).map((item) => item.volume);
  const recentVolumeAvg = recentVolumes.reduce((sum, value) => sum + value, 0) / Math.max(recentVolumes.length, 1);
  const olderVolumeAvg = olderVolumes.reduce((sum, value) => sum + value, 0) / Math.max(olderVolumes.length, 1);

  if (volatility > 4.5 || detail.professionalScores.volatilityRisk > 70) {
    findings.push(
      finding({
        id: "volatility-high",
        category: "volatility",
        title: "Extrem hohe Volatilitaet",
        severity: volatility > 7 ? "extrem" : "hoch",
        detail: "Die durchschnittliche Kerzenbewegung ist auffaellig hoch.",
        evidence: `${volatility.toFixed(2)}% durchschnittliche Bewegung im 1M-Fenster.`,
        action: "Positionsgroesse und Stop-Risiko sehr konservativ prüfen."
      })
    );
  }

  if (detail.quote.volume < 5_000_000 && detail.asset.type !== "crypto") {
    findings.push(
      finding({
        id: "liquidity-low",
        category: "liquidity",
        title: "Möglich schwache Liquiditaet",
        severity: detail.quote.volume < 1_000_000 ? "hoch" : "mittel",
        detail: "Niedrige Liquiditaet kann Slippage und schnelle Kursluecken beguenstigen.",
        evidence: `Volumen ${detail.quote.volume.toLocaleString("de-DE")}.`,
        action: "Ordergroesse, Spread und Handelsplatz prüfen."
      })
    );
  }

  if (negativeNews.length) {
    findings.push(
      finding({
        id: "negative-news",
        category: "news",
        title: "Negative relevante News",
        severity: negativeNews.some((item) => item.relevance > 85) ? "hoch" : "mittel",
        detail: "Mehrere News werden modellbasiert als belastend eingestuft.",
        evidence: negativeNews.map((item) => item.title).join(" | "),
        action: "Quellen lesen und These gegenprüfen."
      })
    );
  }

  if (detail.earningsDate) {
    const daysUntilEarnings = Math.ceil(
      (new Date(`${detail.earningsDate}T12:00:00Z`).getTime() - now.getTime()) / 86400000
    );

    if (daysUntilEarnings >= 0 && daysUntilEarnings <= 14) {
      findings.push(
        finding({
          id: "earnings-upcoming",
          category: "earnings",
          title: "Bevorstehende Earnings",
          severity: daysUntilEarnings <= 3 ? "hoch" : "mittel",
          detail: "Ergebnisse können Volatilitaet und Gaps deutlich erhöhen.",
          evidence: `${daysUntilEarnings} Tage bis zum Termin.`,
          action: "Event-Risiko bewusst einplanen."
        })
      );
    }
  }

  if (detail.quote.changePercent > 7 && !positiveNews) {
    findings.push(
      finding({
        id: "pump-dump-suspected",
        category: "pump-dump",
        title: "Pump-and-Dump-Verdacht prüfen",
        severity: "hoch",
        detail: "Starker Kursanstieg ohne passende positive News kann fragil sein.",
        evidence: `${detail.quote.changePercent.toFixed(2)}% Tagesbewegung ohne hochrelevante positive News.`,
        action: "Social-Media-Hype, Liquiditaet und News-Ursache prüfen."
      })
    );
  }

  if (monthlyMove > 12 && recentVolumeAvg < olderVolumeAvg * 0.82) {
    findings.push(
      finding({
        id: "volume-falling",
        category: "volume",
        title: "Fallendes Volumen bei steigendem Kurs",
        severity: "mittel",
        detail: "Momentum ohne Volumenbestaetigung kann an Stabilitaet verlieren.",
        evidence: `1M-Bewegung ${monthlyMove.toFixed(2)}%, Volumen-Schnitt ruecklaeufig.`,
        action: "Ausbruch nicht isoliert betrachten."
      })
    );
  }

  if (detail.indicators.rsi > 70 || detail.indicators.rsi < 30) {
    findings.push(
      finding({
        id: detail.indicators.rsi > 70 ? "rsi-overbought" : "rsi-oversold",
        category: "technical",
        title: detail.indicators.rsi > 70 ? "Überkaufter RSI" : "Überverkaufter RSI",
        severity: detail.indicators.rsi > 82 || detail.indicators.rsi < 18 ? "hoch" : "mittel",
        detail: "RSI-Extreme können Trendstärke oder Rückschlagrisiko anzeigen.",
        evidence: `RSI ${detail.indicators.rsi}.`,
        action: "RSI immer mit Trend, Volumen und Support/Resistance abgleichen."
      })
    );
  }

  if (detail.quote.price < detail.indicators.support[0]) {
    findings.push(
      finding({
        id: "support-broken",
        category: "technical",
        title: "Support gebrochen",
        severity: "hoch",
        detail: "Der aktuelle Kurs liegt unter dem naechsten Modell-Support.",
        evidence: `Kurs ${detail.quote.price}, Support ${detail.indicators.support[0]}.`,
        action: "Breakdown-Szenario und Fehlsignal prüfen."
      })
    );
  }

  if (detail.macroFactors.some((factor) => factor.impact === "negative")) {
    findings.push(
      finding({
        id: "macro-risk",
        category: "market",
        title: "Makro-Faktor belastet",
        severity: "mittel",
        detail: "Mindestens ein Makro-Faktor wird als mögliches Risiko markiert.",
        evidence: detail.macroFactors.filter((factor) => factor.impact === "negative").map((factor) => factor.label).join(", "),
        action: "Marktregime, Zinsen und Liquiditaet getrennt prüfen."
      })
    );
  }

  if (detail.analysisLayers.some((layer) => layer.label === "Sektortrend" && layer.status === "negative")) {
    findings.push(
      finding({
        id: "sector-weakness",
        category: "sector",
        title: "Sektor-Schwäche",
        severity: "mittel",
        detail: "Der Sektortrend widerspricht der Einzelwertthese.",
        evidence: detail.analysisLayers.find((layer) => layer.label === "Sektortrend")?.detail ?? "Sektortrend negativ.",
        action: "Relative Stärke gegen Sektor und Index vergleichen."
      })
    );
  }

  if (!dataQuality.sufficientForAnalysis) {
    findings.push(
      finding({
        id: "data-quality-low",
        category: "data-quality",
        title: "Datenlage zu schwach",
        severity: dataQuality.score < 40 ? "extrem" : "hoch",
        detail: "Die Analyse sollte nicht als belastbar betrachtet werden.",
        evidence: [...dataQuality.issues, ...dataQuality.warnings].join(" | ") || `Qualität ${dataQuality.score}/100.`,
        action: "Daten aktualisieren und zusätzliche Quellen hinzuziehen."
      })
    );
  }

  const score = Math.min(100, Math.round(findings.reduce((sum, item) => sum + severityWeight(item.severity), 0)));
  const level = reportLevel(score);

  return {
    level,
    score,
    blockedAnalysis: !dataQuality.sufficientForAnalysis || findings.some((item) => item.severity === "extrem"),
    summary:
      findings.length === 0
        ? "Keine kritischen Warnungen im Modell erkannt. Das ersetzt keine eigene Prüfung."
        : `${findings.length} Warnhinweis(e) erkannt. Risiko-Level ${level}.`,
    findings
  };
}
