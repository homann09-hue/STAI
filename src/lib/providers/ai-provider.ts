import { getMockAsset } from "@/lib/mock/market";
import type { AiAnalysis, MarketDataQuality } from "@/lib/types";

export type AiAnalysisProviderMetadata = {
  providerId: string;
  providerName: string;
  quality: MarketDataQuality;
  generatedFrom: "mock" | "provider" | "cache";
  isModelEstimate: true;
  warning: string | null;
};

export type AiAnalysisProviderResult = {
  analysis: AiAnalysis | null;
  metadata: AiAnalysisProviderMetadata;
};

export interface AiAnalysisProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly quality: MarketDataQuality;
  getAnalysis(symbol: string): Promise<AiAnalysis | null>;
  getAnalysisWithMetadata(symbol: string): Promise<AiAnalysisProviderResult>;
}

const MAX_AI_TEXT_CHARS = 700;
const MAX_AI_LIST_ITEMS = 8;
const validRiskLevels = new Set<AiAnalysis["riskLevel"]>(["niedrig", "mittel", "hoch", "extrem"]);
const validUncertaintyLevels = new Set<AiAnalysis["uncertainty"]>(["niedrig", "mittel", "hoch"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeAiText(value: unknown, fallback: string, maxLength = MAX_AI_TEXT_CHARS) {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[<>\u0000-\u001F\u007F]/gu, "")
    .replace(/\b(kaufen|verkaufen|garantiert|sicherer gewinn|risikofrei)\b/giu, "modellbasiert prüfen")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || fallback;
}

function safeAiList(value: unknown, fallback: string) {
  if (!Array.isArray(value)) return [fallback];

  const entries = value
    .map((item) => safeAiText(item, "", 260))
    .filter(Boolean)
    .slice(0, MAX_AI_LIST_ITEMS);

  return entries.length ? entries : [fallback];
}

function safeRiskLevel(value: unknown): AiAnalysis["riskLevel"] {
  return validRiskLevels.has(value as AiAnalysis["riskLevel"]) ? (value as AiAnalysis["riskLevel"]) : "hoch";
}

function safeUncertainty(value: unknown): AiAnalysis["uncertainty"] {
  return validUncertaintyLevels.has(value as AiAnalysis["uncertainty"]) ? (value as AiAnalysis["uncertainty"]) : "hoch";
}

function probabilityValue(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
}

function normalizeProbabilities(value: unknown): AiAnalysis["probabilities"] {
  const record = isRecord(value) ? value : {};
  const rawUp = probabilityValue(record.up);
  const rawDown = probabilityValue(record.down);
  const rawSideways = probabilityValue(record.sideways);
  const scale = rawUp <= 1 && rawDown <= 1 && rawSideways <= 1 ? 100 : 1;
  const upValue = Math.min(100, rawUp * scale);
  const downValue = Math.min(100, rawDown * scale);
  const sidewaysValue = Math.min(100, rawSideways * scale);
  const total = upValue + downValue + sidewaysValue;

  if (total <= 0) {
    return { up: 33, down: 33, sideways: 34 };
  }

  const up = Math.round((upValue / total) * 100);
  const down = Math.round((downValue / total) * 100);
  return {
    up,
    down,
    sideways: Math.max(0, 100 - up - down)
  };
}

function normalizeAiAnalysis(analysis: AiAnalysis | null): AiAnalysis | null {
  if (!analysis) return null;

  return {
    summary: safeAiText(
      analysis.summary,
      "Modellbasierte Lageeinschätzung nicht verfügbar. Datenqualität und Quellen prüfen."
    ),
    upsideDrivers: safeAiList(analysis.upsideDrivers, "Keine belastbaren positiven Treiber verfügbar."),
    downsideDrivers: safeAiList(analysis.downsideDrivers, "Keine belastbaren negativen Treiber verfügbar."),
    counterArguments: safeAiList(analysis.counterArguments, "Gegenargumente wegen Datenlage nur eingeschränkt bewertbar."),
    dataGaps: safeAiList(analysis.dataGaps, "Datenlücken und Aktualität prüfen."),
    bullCase: safeAiText(analysis.bullCase, "Bull Case nicht belastbar verfügbar."),
    bearCase: safeAiText(analysis.bearCase, "Bear Case nicht belastbar verfügbar."),
    neutralCase: safeAiText(analysis.neutralCase, "Neutral Case nicht belastbar verfügbar."),
    shortTerm: safeAiText(analysis.shortTerm, "Kurzfristige Einschätzung nicht belastbar verfügbar."),
    mediumTerm: safeAiText(analysis.mediumTerm, "Mittelfristige Einschätzung nicht belastbar verfügbar."),
    longTerm: safeAiText(analysis.longTerm, "Langfristige Einschätzung nicht belastbar verfügbar."),
    riskLevel: safeRiskLevel(analysis.riskLevel),
    uncertainty: safeUncertainty(analysis.uncertainty),
    probabilities: normalizeProbabilities(analysis.probabilities),
    sources: safeAiList(analysis.sources, "Quellenstatus offen."),
    weakDataWarning: analysis.weakDataWarning
      ? safeAiText(analysis.weakDataWarning, "Datenlage ist eingeschränkt belastbar.", 360)
      : null,
    modelNote:
      safeAiText(analysis.modelNote, "", 360) ||
      "Keine Anlageberatung. KI-Analysen sind modellbasierte Einschätzungen und können falsch sein."
  };
}

class MockAiAnalysisProvider implements AiAnalysisProvider {
  readonly providerId = "mock";
  readonly providerName = "Mock AI Analysis";
  readonly quality = "mock";

  async getAnalysis(symbol: string) {
    return normalizeAiAnalysis(getMockAsset(symbol)?.aiAnalysis ?? null);
  }

  async getAnalysisWithMetadata(symbol: string) {
    return {
      analysis: await this.getAnalysis(symbol),
      metadata: {
        providerId: this.providerId,
        providerName: this.providerName,
        quality: this.quality,
        generatedFrom: "mock",
        isModelEstimate: true,
        warning:
          "Demo-Analyse aus Mock-Daten. Nicht als Live-Signal, Anlageberatung oder echte Anbieteranalyse verwenden."
      }
    } satisfies AiAnalysisProviderResult;
  }
}

export function getAiAnalysisProvider(): AiAnalysisProvider {
  const provider = process.env.STOCKPILOT_AI_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockAiAnalysisProvider();
    default:
      return new MockAiAnalysisProvider();
  }
}

export async function getAiAnalysisWithMetadata(symbol: string) {
  return getAiAnalysisProvider().getAnalysisWithMetadata(symbol);
}
