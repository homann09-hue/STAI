import { createHash } from "node:crypto";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)])
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Canonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export type AnalysisProvenance = {
  analysisId: string;
  rawEventId: string;
  normalizedEventId: string;
  sourceId: string;
  inputHash: string;
  inputSnapshotHash: string;
  modelProvider: string;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  scoringVersion: string;
  processingVersion: string;
  normalizationVersion: string;
  systemConfigurationHash: string;
  createdAt: string;
};

export function buildAnalysisProvenance(input: Omit<AnalysisProvenance, "inputSnapshotHash" | "systemConfigurationHash"> & {
  inputSnapshot: unknown;
  systemConfiguration: unknown;
}): AnalysisProvenance {
  return {
    analysisId: input.analysisId,
    rawEventId: input.rawEventId,
    normalizedEventId: input.normalizedEventId,
    sourceId: input.sourceId,
    inputHash: input.inputHash,
    inputSnapshotHash: sha256Canonical(input.inputSnapshot),
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    scoringVersion: input.scoringVersion,
    processingVersion: input.processingVersion,
    normalizationVersion: input.normalizationVersion,
    systemConfigurationHash: sha256Canonical(input.systemConfiguration),
    createdAt: input.createdAt
  };
}

export type ReproductionComparison = {
  result: "exact" | "drift";
  originalInputHash: string;
  reproducedInputHash: string;
  originalOutputHash: string;
  reproducedOutputHash: string;
  inputMatches: boolean;
  outputMatches: boolean;
  changedTopLevelFields: string[];
};

export function compareReproduction(input: {
  originalInputHash: string;
  reproducedInputHash: string;
  originalOutput: unknown;
  reproducedOutput: unknown;
}): ReproductionComparison {
  const originalOutputHash = sha256Canonical(input.originalOutput);
  const reproducedOutputHash = sha256Canonical(input.reproducedOutput);
  const original = input.originalOutput && typeof input.originalOutput === "object"
    ? (input.originalOutput as Record<string, unknown>)
    : {};
  const reproduced = input.reproducedOutput && typeof input.reproducedOutput === "object"
    ? (input.reproducedOutput as Record<string, unknown>)
    : {};
  const changedTopLevelFields = [...new Set([...Object.keys(original), ...Object.keys(reproduced)])]
    .filter((key) => sha256Canonical(original[key]) !== sha256Canonical(reproduced[key]))
    .sort();
  const inputMatches = input.originalInputHash === input.reproducedInputHash;
  const outputMatches = originalOutputHash === reproducedOutputHash;

  return {
    result: inputMatches && outputMatches ? "exact" : "drift",
    originalInputHash: input.originalInputHash,
    reproducedInputHash: input.reproducedInputHash,
    originalOutputHash,
    reproducedOutputHash,
    inputMatches,
    outputMatches,
    changedTopLevelFields
  };
}

const prohibitedFinancialClaims = [
  /sicher(?:er|e)?\s+gewinn/i,
  /garantiert(?:e|er|es)?\s+(?:rendite|gewinn|kurs)/i,
  /risikolos/i,
  /diese\s+aktie\s+wird\s+steigen/i,
  /sichere\s+wette/i,
  /hundertprozentig(?:e|er|es)?\s+prognose/i,
  /guaranteed\s+(?:return|profit)/i,
  /risk[- ]free/i
];

export function findProhibitedFinancialClaims(text: string) {
  return prohibitedFinancialClaims
    .map((pattern) => pattern.exec(text)?.[0] ?? null)
    .filter((value): value is string => Boolean(value));
}
