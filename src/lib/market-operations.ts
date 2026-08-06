import type { MarketDataQuality, MarketUniverseCoverage, MarketUniverseInstrument } from "@/lib/types";

export type MarketOperationsTone = "profit" | "cyan" | "amber" | "loss";
export type MarketActivationStatus = "done" | "next" | "blocked";

export interface MarketOperationsMetric {
  label: string;
  value: string;
  note: string;
  tone: MarketOperationsTone;
}

export interface MarketActivationStep {
  id: string;
  label: string;
  status: MarketActivationStatus;
  detail: string;
}

export interface MarketOperationsReport {
  generatedAt: string;
  provider: string;
  total: number;
  tradableNow: number;
  streamable: number;
  analysisReady: number;
  analysisLimited: number;
  analysisBlocked: number;
  licenseRequired: number;
  prepared: number;
  providerMissing: number;
  mockRows: number;
  operationalRisk: "niedrig" | "mittel" | "hoch" | "extrem";
  userMessage: string;
  metrics: MarketOperationsMetric[];
  activationSteps: MarketActivationStep[];
  assetClassBreakdown: Array<{ label: string; count: number }>;
  qualityBreakdown: Array<{ label: MarketDataQuality; count: number }>;
}

const qualityOrder: MarketDataQuality[] = ["realtime", "near_realtime", "delayed", "historical", "mock", "unavailable"];

function countBy<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function activationStatus(done: boolean, blocked: boolean): MarketActivationStatus {
  if (done) return "done";
  return blocked ? "blocked" : "next";
}

export function buildMarketOperationsReport(
  instruments: MarketUniverseInstrument[],
  coverage: MarketUniverseCoverage[],
  provider: string,
  now = new Date()
): MarketOperationsReport {
  const safeInstruments = Array.isArray(instruments) ? instruments : [];
  const total = safeInstruments.length;
  const tradableNow = safeInstruments.filter((item) =>
    item.coverage === "available" && item.quoteQuality !== "mock" && item.quoteQuality !== "unavailable"
  ).length;
  const streamable = safeInstruments.filter((item) => item.subscribable && item.quoteQuality !== "mock").length;
  const analysisReady = safeInstruments.filter((item) => item.analysisReadiness === "ready").length;
  const analysisLimited = safeInstruments.filter((item) => item.analysisReadiness === "limited").length;
  const analysisBlocked = safeInstruments.filter((item) => item.analysisReadiness === "blocked").length;
  const licenseRequired = safeInstruments.filter((item) => item.coverage === "license_required").length;
  const prepared = safeInstruments.filter((item) => item.coverage === "prepared").length;
  const providerMissing = safeInstruments.filter((item) => item.coverage === "provider_missing").length;
  const mockRows = safeInstruments.filter((item) => item.quoteQuality === "mock" || item.quality === "mock").length;
  const connectedCoverage = coverage.filter((item) => item.status === "connected").length;
  const licenseCoverage = coverage.filter((item) => item.status === "license_required").length;
  const blockedRatio = total ? analysisBlocked / total : 1;
  const operationalRisk =
    total === 0 || mockRows > 0 || providerMissing > total * 0.35
      ? "extrem"
      : blockedRatio > 0.55 || licenseRequired > total * 0.45
        ? "hoch"
        : analysisLimited > analysisReady
          ? "mittel"
          : "niedrig";
  const classCounts = countBy(safeInstruments.map((item) => item.assetClass));
  const qualityCounts = countBy(safeInstruments.map((item) => item.quoteQuality));
  const assetClassBreakdown = [...classCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 10);
  const qualityBreakdown = qualityOrder.map((label) => ({ label, count: qualityCounts.get(label) ?? 0 }));

  return {
    generatedAt: now.toISOString(),
    provider,
    total,
    tradableNow,
    streamable,
    analysisReady,
    analysisLimited,
    analysisBlocked,
    licenseRequired,
    prepared,
    providerMissing,
    mockRows,
    operationalRisk,
    userMessage:
      total === 0
        ? "Es wurden keine Instrumente geladen. STAI zeigt dann bewusst keine synthetischen Marktdaten."
        : mockRows > 0
          ? "Mindestens ein Treffer ist Mock/Demo. Diese Werte duerfen nicht als echte Marktdaten interpretiert werden."
          : streamable > 0
            ? "Ein Teil des Universums ist aktuell streambar oder near-realtime vorbereitet. Nicht lizenzierte Bereiche bleiben klar gesperrt."
            : "Das Universum ist strukturiert, aber echte Live-Abdeckung erfordert passende Provider-Keys, Tarife und Boersenlizenzen.",
    metrics: [
      {
        label: "Provider-Abdeckung",
        value: `${tradableNow}/${total}`,
        note: `${percent(tradableNow, total)} der sichtbaren Instrumente haben nutzbare Kursabdeckung, ohne Mock als live zu behandeln.`,
        tone: tradableNow ? "profit" : "amber"
      },
      {
        label: "Analysefreigabe",
        value: `${analysisReady}/${total}`,
        note: `${analysisLimited} eingeschränkt, ${analysisBlocked} blockiert. Datenlücken reduzieren automatisch die Aussagekraft.`,
        tone: analysisReady ? "cyan" : "amber"
      },
      {
        label: "Lizenz-/Provider-Lücken",
        value: `${licenseRequired + providerMissing}`,
        note: `${licenseRequired} lizenzpflichtig, ${providerMissing} ohne aktiven Provider, ${prepared} vorbereitet.`,
        tone: licenseRequired + providerMissing ? "amber" : "profit"
      },
      {
        label: "Operations-Risiko",
        value: operationalRisk,
        note: `Coverage-Status: ${connectedCoverage} verbunden, ${licenseCoverage} lizenzpflichtig. Stand ${now.toLocaleString("de-DE")}.`,
        tone: operationalRisk === "niedrig" ? "profit" : operationalRisk === "mittel" ? "cyan" : operationalRisk === "hoch" ? "amber" : "loss"
      }
    ],
    activationSteps: [
      {
        id: "provider-directory",
        label: "Provider-Verzeichnis",
        status: activationStatus(total > 0, false),
        detail: total > 0
          ? "Instrumente werden normalisiert und mit Instrument-Master-Feldern angereichert."
          : "Provider-Suche oder vorbereitetes Startuniversum liefert aktuell keine Treffer."
      },
      {
        id: "quote-rights",
        label: "Quote-Rechte",
        status: activationStatus(tradableNow > 0, licenseRequired > 0 || providerMissing > 0),
        detail: tradableNow > 0
          ? "Nutzbare Kursabdeckung vorhanden; Realtime-Status wird je Instrument separat angezeigt."
          : "Keine echte Kursabdeckung im aktuellen Trefferfenster. Keys, Tarife oder Boersenrechte pruefen."
      },
      {
        id: "analysis-gates",
        label: "Analyse-Gates",
        status: activationStatus(analysisReady > 0, analysisBlocked >= total && total > 0),
        detail: analysisReady > 0
          ? "Mindestens ein Instrument ist direkt analysebereit; schwache Daten werden eingeschraenkt oder blockiert."
          : "Keine Analysefreigabe im aktuellen Trefferfenster. Fundamentaldaten, Historie oder News fehlen."
      },
      {
        id: "live-stream",
        label: "Streaming",
        status: activationStatus(streamable > 0, tradableNow === 0),
        detail: streamable > 0
          ? "Mindestens ein Instrument ist streambar/near-realtime markiert."
          : "Streaming wird nicht behauptet. REST/Polling oder Provider-Lizenz ist erforderlich."
      }
    ],
    assetClassBreakdown,
    qualityBreakdown
  };
}
