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

  // Mindestlaenge fuer eine Aussage ueber Verlauf und Volumen. Vorher gab es
  // keine: die Kerzen kamen aus `candlesFromQuote` und waren immer 32 Stueck,
  // also nie zu wenige -- weil sie erzeugt statt gemessen waren.
  const MIN_CANDLES_FOR_TREND = 16;
  const hasHistory = candles.length >= MIN_CANDLES_FOR_TREND;

  const volatility = hasHistory ? calculateVolatility(candles) : 0;
  const latest = candles[candles.length - 1];
  const first = candles[0];
  const monthlyMove = hasHistory && first && latest ? ((latest.close - first.close) / Math.max(first.close, 0.01)) * 100 : 0;
  // Rang statt absoluter Schwelle.
  //
  // Vorher stand hier `relevance >= 70` -- was funktionierte, solange die
  // Relevanz erfunden war und konstruktionsbedingt zwischen 42 und 98 lag. Der
  // echte Uebereinstimmungswert von Marketaux liegt bei 13 bis 27, und die
  // Schwelle haette nie wieder ausgeloest. Eine anbieterspezifische Skala darf
  // nicht als absolute Grenze auftreten; die vier relevantesten Meldungen sind
  // dagegen bei jedem Anbieter dieselbe Aussage.
  const MOST_RELEVANT = 4;
  const ranked = [...detail.news].sort((left, right) => (right.relevance ?? -1) - (left.relevance ?? -1));
  const leading = ranked.slice(0, MOST_RELEVANT);

  const positiveNews = leading.some((item) => item.sentiment === "positive");
  const negativeNews = leading.filter((item) => item.sentiment === "negative");
  // Ereignisarten aus §27, die eine Meldung unabhaengig von ihrem Rang schwer
  // machen. Sie sind belegt -- jede traegt den ausloesenden Wortlaut mit.
  const severeEventTypes = new Set(["profit_warning", "litigation", "regulatory_decision", "capital_measure"]);
  const severeNews = negativeNews.filter((item) => item.events.some((event) => severeEventTypes.has(event.type)));
  const recentVolumes = candles.slice(-8).map((item) => item.volume);
  const olderVolumes = candles.slice(-16, -8).map((item) => item.volume);
  const recentVolumeAvg = recentVolumes.reduce((sum, value) => sum + value, 0) / Math.max(recentVolumes.length, 1);
  const olderVolumeAvg = olderVolumes.reduce((sum, value) => sum + value, 0) / Math.max(olderVolumes.length, 1);

  // Die fehlende Historie ist selbst ein Befund. Sonst saehe ein Instrument
  // ohne Daten aus wie eines ohne Risiken -- der gefaehrlichste Trugschluss,
  // den diese Engine erzeugen kann.
  if (!hasHistory) {
    findings.push(
      finding({
        id: "history-missing",
        category: "technical",
        title: "Keine belastbare Kurshistorie",
        severity: "mittel",
        detail: "Ohne ausreichende Historie sind Trend-, Volumen- und Indikatoraussagen nicht möglich.",
        evidence: `${candles.length} Kerzen im 1M-Fenster, benötigt werden mindestens ${MIN_CANDLES_FOR_TREND}.`,
        action: "Das Fehlen von Befunden nicht als Abwesenheit von Risiko lesen."
      })
    );
  }

  if (hasHistory && (volatility > 4.5 || detail.professionalScores.volatilityRisk > 70)) {
    findings.push(
      finding({
        id: "volatility-high",
        category: "volatility",
        title: "Extrem hohe Volatilität",
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
        title: "Möglich schwache Liquidität",
        severity: detail.quote.volume < 1_000_000 ? "hoch" : "mittel",
        detail: "Niedrige Liquidität kann Slippage und schnelle Kursluecken beguenstigen.",
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
        // Die Schwere haengt jetzt an der erkannten Ereignisart statt an einer
        // Relevanzzahl: eine Gewinnwarnung wiegt schwerer als eine schlecht
        // besprochene Produktvorstellung, unabhaengig vom Anbieterscore.
        severity: severeNews.length ? "hoch" : "mittel",
        detail: "Mehrere News werden modellbasiert als belastend eingestuft.",
        evidence: negativeNews
          .map((item) => {
            const events = item.events.map((event) => event.label).join(", ");
            return events ? `${item.title} [${events}]` : item.title;
          })
          .join(" | "),
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
          detail: "Ergebnisse können Volatilität und Gaps deutlich erhöhen.",
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
        action: "Social-Media-Hype, Liquidität und News-Ursache prüfen."
      })
    );
  }

  if (hasHistory && monthlyMove > 12 && recentVolumeAvg < olderVolumeAvg * 0.82) {
    findings.push(
      finding({
        id: "volume-falling",
        category: "volume",
        title: "Fallendes Volumen bei steigendem Kurs",
        severity: "mittel",
        detail: "Momentum ohne Volumenbestätigung kann an Stabilität verlieren.",
        evidence: `1M-Bewegung ${monthlyMove.toFixed(2)}%, Volumen-Schnitt rückläufig.`,
        action: "Ausbruch nicht isoliert betrachten."
      })
    );
  }

  // Ohne RSI kein RSI-Befund. Vorher konnte diese Stelle gar nicht ausloesen:
  // der damalige "RSI" war auf 30 bis 75 begrenzt, meldete also nie ein Extrem.
  // Ein Befund mit `evidence: "RSI 74"` waere ausserdem der schlimmste Fall von
  // Erfindung gewesen -- eine erfundene Zahl, die als Beleg auftritt.
  const rsiValue = detail.indicators.rsi;
  if (rsiValue !== null && (rsiValue > 70 || rsiValue < 30)) {
    findings.push(
      finding({
        id: rsiValue > 70 ? "rsi-overbought" : "rsi-oversold",
        category: "technical",
        title: rsiValue > 70 ? "Überkaufter RSI" : "Überverkaufter RSI",
        severity: rsiValue > 82 || rsiValue < 18 ? "hoch" : "mittel",
        detail: "RSI-Extreme können Trendstärke oder Rückschlagrisiko anzeigen.",
        evidence: `RSI ${rsiValue.toFixed(1)} über ${detail.indicators.sampleSize} Kerzen.`,
        action: "RSI immer mit Trend, Volumen und Support/Resistance abgleichen."
      })
    );
  }

  // Die Unterstuetzung ist jetzt das Tief des Fensters. Vorher war sie
  // `Kurs × 0,96` -- der Kurs konnte damit nie darunter liegen, der Befund war
  // eine Fassade nach §90.
  const support = detail.indicators.support[0];
  if (support !== undefined && detail.quote.price < support) {
    findings.push(
      finding({
        id: "support-broken",
        category: "technical",
        title: "Support gebrochen",
        severity: "hoch",
        detail: "Der aktuelle Kurs liegt unter dem Tief der letzten Perioden.",
        evidence: `Kurs ${detail.quote.price}, bisheriges Tief ${support.toFixed(2)}.`,
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
        action: "Marktregime, Zinsen und Liquidität getrennt prüfen."
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
