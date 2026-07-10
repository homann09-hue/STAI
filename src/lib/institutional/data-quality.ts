import type { NormalizedIntelligenceEvent } from "@/lib/intelligence/types";

export const dataQualityDimensions = [
  "completeness",
  "correctness",
  "timeliness",
  "consistency",
  "uniqueness",
  "plausibility",
  "provenance",
  "reproducibility"
] as const;

export type DataQualityDimension = (typeof dataQualityDimensions)[number];
export type DataQualitySeverity = "info" | "warning" | "high" | "critical";
export type DataQualityDisposition = "accepted" | "accepted_with_warning" | "quarantined";
export type DataLicenseStatus = "licensed" | "restricted_internal" | "public_domain" | "unknown" | "prohibited";

export type InstitutionalLineage = {
  recordId: string;
  recordType: string;
  source: string;
  provider: string;
  sourceReference: string;
  fetchedAt: string;
  publishedAt: string;
  effectiveAt: string;
  latencyMs: number;
  licenseStatus: DataLicenseStatus;
  processingVersion: string;
  normalizationVersion: string;
  mappingConfidence: number;
  correctionStatus: "original" | "corrected" | "superseded";
};

export type InstitutionalDataRecord<T> = {
  lineage: InstitutionalLineage;
  payload: T;
};

export type DataQualityIssue = {
  code: string;
  dimension: DataQualityDimension;
  severity: DataQualitySeverity;
  message: string;
};

export type InstitutionalDataQualityReport = {
  recordId: string;
  checkedAt: string;
  disposition: DataQualityDisposition;
  qualityStatus: "valid" | "degraded" | "invalid";
  validationStatus: "validated" | "validated_with_warnings" | "failed";
  scores: Record<DataQualityDimension, number>;
  issues: DataQualityIssue[];
};

const severityPenalty: Record<DataQualitySeverity, number> = {
  info: 2,
  warning: 12,
  high: 35,
  critical: 70
};

function isIsoTimestamp(value: string) {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

function issue(
  code: string,
  dimension: DataQualityDimension,
  severity: DataQualitySeverity,
  message: string
): DataQualityIssue {
  return { code, dimension, severity, message };
}

function recordBaseIssues(lineage: InstitutionalLineage, now: Date) {
  const issues: DataQualityIssue[] = [];
  const futureToleranceMs = 5 * 60 * 1_000;

  if (!lineage.recordId.trim() || !lineage.recordType.trim()) {
    issues.push(issue("DQ-COMP-001", "completeness", "critical", "Datensatz-ID und Datensatztyp sind verpflichtend."));
  }
  if (!lineage.source.trim() || !lineage.provider.trim() || !lineage.sourceReference.trim()) {
    issues.push(issue("DQ-PROV-001", "provenance", "critical", "Quelle, Provider und Quellenreferenz sind verpflichtend."));
  }
  if (!lineage.processingVersion.trim() || !lineage.normalizationVersion.trim()) {
    issues.push(issue("DQ-REPR-001", "reproducibility", "high", "Verarbeitungs- und Normalisierungsversion fehlen."));
  }
  if (!Number.isFinite(lineage.latencyMs) || lineage.latencyMs < 0) {
    issues.push(issue("DQ-TIME-001", "timeliness", "high", "Datenlatenz muss eine nichtnegative Zahl sein."));
  }
  if (!Number.isFinite(lineage.mappingConfidence) || lineage.mappingConfidence < 0 || lineage.mappingConfidence > 1) {
    issues.push(issue("DQ-CORR-001", "correctness", "critical", "Zuordnungskonfidenz muss zwischen 0 und 1 liegen."));
  } else if (lineage.mappingConfidence < 0.5) {
    issues.push(issue("DQ-CORR-002", "correctness", "high", "Zuordnungskonfidenz liegt unter der institutionellen Mindestschwelle."));
  } else if (lineage.mappingConfidence < 0.85) {
    issues.push(issue("DQ-CORR-003", "correctness", "warning", "Zuordnungskonfidenz erfordert erhöhte Vorsicht."));
  }

  const timestamps = [
    ["fetchedAt", lineage.fetchedAt],
    ["publishedAt", lineage.publishedAt],
    ["effectiveAt", lineage.effectiveAt]
  ] as const;
  for (const [name, value] of timestamps) {
    if (!isIsoTimestamp(value)) {
      issues.push(issue("DQ-TIME-002", "timeliness", "critical", `${name} ist kein gültiger Zeitstempel.`));
    } else if (new Date(value).getTime() > now.getTime() + futureToleranceMs) {
      issues.push(issue("DQ-TIME-003", "timeliness", "high", `${name} liegt unerklärlich in der Zukunft.`));
    }
  }

  if (isIsoTimestamp(lineage.publishedAt) && isIsoTimestamp(lineage.fetchedAt)) {
    if (new Date(lineage.publishedAt).getTime() > new Date(lineage.fetchedAt).getTime() + futureToleranceMs) {
      issues.push(issue("DQ-CONS-001", "consistency", "high", "Veröffentlichungszeit liegt nach dem Abrufzeitpunkt."));
    }
  }

  if (lineage.licenseStatus === "unknown") {
    issues.push(issue("DQ-PROV-002", "provenance", "warning", "Lizenzstatus ist ungeklärt; externe Anzeige erfordert Freigabe."));
  }
  if (lineage.licenseStatus === "prohibited") {
    issues.push(issue("DQ-PROV-003", "provenance", "critical", "Datensatz darf laut Lizenzstatus nicht verarbeitet oder angezeigt werden."));
  }

  return issues;
}

export function assessInstitutionalData<T>(
  record: InstitutionalDataRecord<T>,
  additionalIssues: DataQualityIssue[] = [],
  now = new Date()
): InstitutionalDataQualityReport {
  const issues = [...recordBaseIssues(record.lineage, now), ...additionalIssues];
  const scores = Object.fromEntries(dataQualityDimensions.map((dimension) => [dimension, 100])) as Record<
    DataQualityDimension,
    number
  >;

  for (const finding of issues) {
    scores[finding.dimension] = Math.max(0, scores[finding.dimension] - severityPenalty[finding.severity]);
  }

  const quarantined = issues.some((finding) => finding.severity === "critical" || finding.severity === "high");
  const warned = issues.length > 0;

  return {
    recordId: record.lineage.recordId,
    checkedAt: now.toISOString(),
    disposition: quarantined ? "quarantined" : warned ? "accepted_with_warning" : "accepted",
    qualityStatus: quarantined ? "invalid" : warned ? "degraded" : "valid",
    validationStatus: quarantined ? "failed" : warned ? "validated_with_warnings" : "validated",
    scores,
    issues
  };
}

function metadataLicenseStatus(event: NormalizedIntelligenceEvent): DataLicenseStatus {
  const value = event.metadata.licenseStatus;
  return value === "licensed" ||
    value === "restricted_internal" ||
    value === "public_domain" ||
    value === "prohibited"
    ? value
    : "unknown";
}

export function assessIntelligenceEventData(
  event: NormalizedIntelligenceEvent,
  now = new Date()
): InstitutionalDataQualityReport {
  const receivedAt = new Date(event.receivedAt).getTime();
  const publishedAt = new Date(event.publishedAt).getTime();
  const eventIssues: DataQualityIssue[] = [];

  if (!event.externalId.trim() || !event.title.trim() || !event.normalizedTitle.trim()) {
    eventIssues.push(issue("DQ-COMP-INT-001", "completeness", "critical", "Ereignis-ID und Titel sind verpflichtend."));
  }
  if (!event.sourceUrl.startsWith("https://")) {
    eventIssues.push(issue("DQ-PROV-INT-001", "provenance", "high", "Intelligence-Quelle muss eine HTTPS-Referenz besitzen."));
  }
  if (!/^[a-f0-9]{64}$/.test(event.contentHash)) {
    eventIssues.push(issue("DQ-UNIQ-INT-001", "uniqueness", "critical", "Content-Hash fehlt oder ist ungültig."));
  }
  if (!event.normalizedText.trim()) {
    eventIssues.push(issue("DQ-COMP-INT-002", "completeness", "high", "Normalisierter Quelltext fehlt."));
  }
  if (event.confirmationStatus !== "confirmed") {
    eventIssues.push(issue("DQ-CORR-INT-001", "correctness", "warning", "Information ist nicht vollständig bestätigt."));
  }

  return assessInstitutionalData(
    {
      lineage: {
        recordId: `${event.provider}:${event.externalId}`,
        recordType: `intelligence:${event.canonicalEventType}`,
        source: event.publisher,
        provider: event.provider,
        sourceReference: event.sourceUrl,
        fetchedAt: event.receivedAt,
        publishedAt: event.publishedAt,
        effectiveAt: event.eventTime,
        latencyMs: Number.isFinite(receivedAt - publishedAt) ? Math.max(0, receivedAt - publishedAt) : Number.NaN,
        licenseStatus: metadataLicenseStatus(event),
        processingVersion: "intelligence-pipeline/2.0.0",
        normalizationVersion: "intelligence-normalization/2.0.0",
        mappingConfidence: event.entityConfidence,
        correctionStatus: "original"
      },
      payload: event
    },
    eventIssues,
    now
  );
}

export function quoteQualityIssues(payload: {
  price: number;
  volume?: number;
  currency: string;
  symbol: string;
}): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    issues.push(issue("DQ-PLAU-QUOTE-001", "plausibility", "critical", "Kurs muss größer als null sein."));
  }
  if (payload.volume !== undefined && (!Number.isFinite(payload.volume) || payload.volume < 0)) {
    issues.push(issue("DQ-PLAU-QUOTE-002", "plausibility", "critical", "Volumen darf nicht negativ sein."));
  }
  if (!/^[A-Z0-9]{2,12}$/.test(payload.currency)) {
    issues.push(issue("DQ-COMP-QUOTE-001", "completeness", "high", "Währung muss explizit und normalisiert vorliegen."));
  }
  if (!/^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(payload.symbol)) {
    issues.push(issue("DQ-CONS-QUOTE-001", "consistency", "high", "Symbolformat ist ungültig."));
  }
  return issues;
}
