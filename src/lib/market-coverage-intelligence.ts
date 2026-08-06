import type { MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";

export type MarketCoverageTone = "profit" | "cyan" | "amber" | "loss";
export type MarketCoverageStage = "production_ready" | "live_candidate" | "limited" | "blocked";

export interface MarketCoverageLane {
  id: string;
  label: string;
  ready: number;
  limited: number;
  blocked: number;
  total: number;
  score: number;
  status: MarketCoverageStage;
  tone: MarketCoverageTone;
  detail: string;
}

export interface MarketCoveragePriority {
  id: string;
  label: string;
  impact: "hoch" | "mittel" | "niedrig";
  status: "sofort" | "naechster_schritt" | "beobachten";
  action: string;
}

export interface MarketProviderCapability {
  provider: string;
  status: MarketUniverseCoverage["status"];
  assetClasses: string;
  unlocks: string;
  blocker: string | null;
}

export interface MarketCoverageIntelligenceReport {
  generatedAt: string;
  universeCount: number;
  coverageScore: number;
  truthScore: number;
  professionalDepthScore: number;
  status: MarketCoverageStage;
  tone: MarketCoverageTone;
  conclusion: string;
  lanes: MarketCoverageLane[];
  priorities: MarketCoveragePriority[];
  providerCapabilities: MarketProviderCapability[];
  riskFlags: string[];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratioScore(ready: number, total: number) {
  if (!total) return 0;
  return clampScore((ready / total) * 100);
}

function stageFromScore(score: number, blocked: number, total: number): MarketCoverageStage {
  if (!total || blocked === total || score < 25) return "blocked";
  if (score < 55) return "limited";
  if (score < 82) return "live_candidate";
  return "production_ready";
}

function toneFromStage(stage: MarketCoverageStage): MarketCoverageTone {
  if (stage === "production_ready") return "profit";
  if (stage === "live_candidate") return "cyan";
  if (stage === "limited") return "amber";
  return "loss";
}

function lane(input: {
  id: string;
  label: string;
  ready: number;
  limited: number;
  blocked: number;
  total: number;
  detail: string;
}): MarketCoverageLane {
  const score = ratioScore(input.ready + input.limited * 0.45, input.total);
  const status = stageFromScore(score, input.blocked, input.total);

  return {
    ...input,
    score,
    status,
    tone: toneFromStage(status)
  };
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function marketTruthFlags(instruments: MarketUniverseInstrument[]) {
  const mockCount = instruments.filter((item) => item.quoteQuality === "mock" || item.quality === "mock").length;
  const unavailableCount = instruments.filter((item) => item.quoteQuality === "unavailable").length;
  const licenseCount = instruments.filter((item) => item.coverage === "license_required").length;
  const providerMissingCount = instruments.filter((item) => item.coverage === "provider_missing").length;
  const ambiguousCount = instruments.filter((item) => item.resolutionStatus === "ambiguous" || item.resolutionStatus === "invalid").length;
  const flags: string[] = [];

  if (mockCount) flags.push(`${mockCount} Mock-Instrumente im aktuellen Trefferfenster. Keine Live-Signale daraus ableiten.`);
  if (unavailableCount) flags.push(`${unavailableCount} Instrumente ohne nutzbare Kursdaten.`);
  if (licenseCount) flags.push(`${licenseCount} Instrumente benötigen Daten- oder Börsenlizenzen.`);
  if (providerMissingCount) flags.push(`${providerMissingCount} Instrumente haben keinen aktiven Provider.`);
  if (ambiguousCount) flags.push(`${ambiguousCount} Symbole benötigen Identitätsprüfung.`);

  return flags;
}

function buildPriorities(lanes: MarketCoverageLane[], instruments: MarketUniverseInstrument[]): MarketCoveragePriority[] {
  const priorities: MarketCoveragePriority[] = [];
  const hasMock = instruments.some((item) => item.quoteQuality === "mock" || item.quality === "mock");
  const quoteLane = lanes.find((item) => item.id === "quotes");
  const analysisLane = lanes.find((item) => item.id === "analysis");
  const licenseLane = lanes.find((item) => item.id === "licensing");
  const breadthLane = lanes.find((item) => item.id === "breadth");

  if (hasMock) {
    priorities.push({
      id: "mock-quarantine",
      label: "Mock-Daten isolieren",
      impact: "hoch",
      status: "sofort",
      action: "Mock-Treffer sichtbar sperren und niemals als Signal, Forecast oder Live-Kurs verwenden."
    });
  }

  if (!quoteLane || quoteLane.score < 70) {
    priorities.push({
      id: "quote-coverage",
      label: "Quote-Abdeckung erhöhen",
      impact: "hoch",
      status: "sofort",
      action: "Provider-Verzeichnisse, Keys und Quote-Routen priorisieren, bevor neue Analyseversprechen angezeigt werden."
    });
  }

  if (!analysisLane || analysisLane.score < 65) {
    priorities.push({
      id: "analysis-gates",
      label: "Analyse-Gates härten",
      impact: "hoch",
      status: "naechster_schritt",
      action: "Bei fehlenden Fundamentals, Historie, News oder Identität nur eingeschränkte Research-Ansichten freigeben."
    });
  }

  if (licenseLane && licenseLane.blocked > 0) {
    priorities.push({
      id: "license-plan",
      label: "Lizenzplan operationalisieren",
      impact: "mittel",
      status: "naechster_schritt",
      action: "Für US, EU, Indizes, Derivate und Rohstoffe Providerrechte getrennt dokumentieren und aktivieren."
    });
  }

  if (!breadthLane || breadthLane.score < 60) {
    priorities.push({
      id: "asset-breadth",
      label: "Assetklassen ausbauen",
      impact: "mittel",
      status: "beobachten",
      action: "Suche und Detailseiten für ETFs, Forex, Rohstoffe, Futures, Optionen und Anleihen schrittweise aus Providerdaten füllen."
    });
  }

  return priorities.slice(0, 5);
}

function providerCapabilities(coverage: MarketUniverseCoverage[]): MarketProviderCapability[] {
  return coverage.map((item) => ({
    provider: item.label,
    status: item.status,
    assetClasses: item.assetClasses.join(", "),
    unlocks: item.providerCandidates.join(", "),
    blocker:
      item.status === "connected"
        ? null
        : item.status === "license_required"
          ? "Lizenz, Tarif oder Redisplay-Recht erforderlich."
          : "Adapter vorbereitet, aber noch nicht produktiv aktiviert."
  }));
}

export function buildMarketCoverageIntelligenceReport(
  instruments: MarketUniverseInstrument[],
  coverage: MarketUniverseCoverage[],
  now = new Date()
): MarketCoverageIntelligenceReport {
  const safeInstruments = Array.isArray(instruments) ? instruments : [];
  const total = safeInstruments.length;
  const quoteReady = safeInstruments.filter((item) =>
    item.coverage === "available" &&
    item.quoteQuality !== "mock" &&
    item.quoteQuality !== "unavailable"
  ).length;
  const quoteLimited = safeInstruments.filter((item) =>
    item.coverage === "available" &&
    (item.quoteQuality === "delayed" || item.quoteQuality === "historical")
  ).length;
  const identityReady = safeInstruments.filter((item) => item.resolutionStatus === "resolved").length;
  const identityLimited = safeInstruments.filter((item) => item.resolutionStatus === "provider_only").length;
  const analysisReady = safeInstruments.filter((item) => item.analysisReadiness === "ready").length;
  const analysisLimited = safeInstruments.filter((item) => item.analysisReadiness === "limited").length;
  const licenseReady = safeInstruments.filter((item) => item.coverage === "available" || item.coverage === "prepared").length;
  const noMockCount = safeInstruments.filter((item) => item.quoteQuality !== "mock" && item.quality !== "mock").length;
  const assetClassCount = uniqueCount(safeInstruments.map((item) => item.assetClass));
  const assetBreadthReady = Math.min(assetClassCount, 8);

  const lanes = [
    lane({
      id: "quotes",
      label: "Kursdaten",
      ready: quoteReady,
      limited: quoteLimited,
      blocked: Math.max(0, total - quoteReady - quoteLimited),
      total,
      detail: "Realtime, Near-Realtime, Delayed und nicht verfügbare Kursdaten werden getrennt bewertet."
    }),
    lane({
      id: "identity",
      label: "Instrument-Identität",
      ready: identityReady,
      limited: identityLimited,
      blocked: Math.max(0, total - identityReady - identityLimited),
      total,
      detail: "Ticker, Börse, Währung und interne Kennung müssen eindeutig sein."
    }),
    lane({
      id: "analysis",
      label: "Analysefähigkeit",
      ready: analysisReady,
      limited: analysisLimited,
      blocked: Math.max(0, total - analysisReady - analysisLimited),
      total,
      detail: "Forecasts und Scores werden nur bei ausreichender Datenlage vollständig freigegeben."
    }),
    lane({
      id: "licensing",
      label: "Lizenz- und Providerrechte",
      ready: licenseReady,
      limited: safeInstruments.filter((item) => item.coverage === "prepared").length,
      blocked: safeInstruments.filter((item) => item.coverage === "license_required" || item.coverage === "provider_missing").length,
      total,
      detail: "Nicht lizenzierte Märkte bleiben sichtbar blockiert, statt als live zu erscheinen."
    }),
    lane({
      id: "truth",
      label: "Echtheitskontrolle",
      ready: noMockCount,
      limited: 0,
      blocked: Math.max(0, total - noMockCount),
      total,
      detail: "Mock-Daten werden als Produkt-Risiko gezählt und dürfen keine echten Signale erzeugen."
    }),
    lane({
      id: "breadth",
      label: "Assetklassenbreite",
      ready: assetBreadthReady,
      limited: Math.max(0, assetClassCount - assetBreadthReady),
      blocked: Math.max(0, 8 - assetBreadthReady),
      total: 8,
      detail: "Ziel sind breite Multi-Asset-Flows statt weniger Beispiel-Ticker."
    })
  ];

  const coverageScore = clampScore(
    lanes.reduce((sum, item) => sum + item.score, 0) / Math.max(1, lanes.length)
  );
  const truthScore = lanes.find((item) => item.id === "truth")?.score ?? 0;
  const professionalDepthScore = clampScore(
    (lanes.find((item) => item.id === "quotes")?.score ?? 0) * 0.22 +
    (lanes.find((item) => item.id === "identity")?.score ?? 0) * 0.18 +
    (lanes.find((item) => item.id === "analysis")?.score ?? 0) * 0.24 +
    (lanes.find((item) => item.id === "licensing")?.score ?? 0) * 0.16 +
    (lanes.find((item) => item.id === "truth")?.score ?? 0) * 0.12 +
    (lanes.find((item) => item.id === "breadth")?.score ?? 0) * 0.08
  );
  const hardBlocked =
    total === 0 ||
    quoteReady + quoteLimited === 0 ||
    analysisReady + analysisLimited === 0 ||
    lanes.find((item) => item.id === "licensing")?.blocked === total;
  const status = hardBlocked
    ? "blocked"
    : stageFromScore(professionalDepthScore, lanes.filter((item) => item.status === "blocked").length, lanes.length);
  const riskFlags = marketTruthFlags(safeInstruments);

  return {
    generatedAt: now.toISOString(),
    universeCount: total,
    coverageScore,
    truthScore,
    professionalDepthScore,
    status,
    tone: toneFromStage(status),
    conclusion:
      status === "production_ready"
        ? "Das aktuelle Trefferfenster ist breit, nachvollziehbar und ohne verdeckte Mock-Live-Verwechslung nutzbar."
        : status === "live_candidate"
          ? "Das Universum ist für Research nutzbar, braucht aber weitere Provider-, Lizenz- oder Analyseabdeckung für Profi-Tiefe."
          : status === "limited"
            ? "Die App kann das Universum transparent darstellen, darf aber nur eingeschränkte Analysen ausgeben."
            : "Für belastbare Einschätzungen liegen derzeit nicht genügend verifizierte Daten vor.",
    lanes,
    priorities: buildPriorities(lanes, safeInstruments),
    providerCapabilities: providerCapabilities(coverage),
    riskFlags
  };
}
