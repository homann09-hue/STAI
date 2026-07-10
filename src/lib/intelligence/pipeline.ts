import { calculateImpactScore, detectDuplicate, getIntelligenceAnalyzer, normalizeSourceEvent, resolveEventEntities } from "@/lib/intelligence/analysis";
import type { IntelligenceAnalyzer } from "@/lib/intelligence/analysis";
import type { CompanyReference, IntelligenceSourceAdapter } from "@/lib/intelligence/types";
import type { IntelligenceRepository } from "@/lib/intelligence/repository";
import { assessIntelligenceEventData } from "@/lib/institutional/data-quality";
import { logEvent } from "@/lib/observability";

export type IntelligencePipelineResult = {
  provider: string;
  received: number;
  stored: number;
  quarantined: number;
  analyzed: number;
  duplicates: number;
  alertsCreated: number;
  failed: number;
  durationMs: number;
  nextCursor: unknown;
};

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : "Unbekannter Verarbeitungsfehler";
}

export async function runIntelligencePipeline(
  adapter: IntelligenceSourceAdapter,
  request: Parameters<IntelligenceSourceAdapter["fetchBatch"]>[0],
  options: {
    repository?: IntelligenceRepository;
    analyzer?: IntelligenceAnalyzer;
    companyCatalog?: CompanyReference[];
  } = {}
): Promise<IntelligencePipelineResult> {
  const startedAt = Date.now();
  const repository = options.repository ?? (await import("@/lib/intelligence/repository")).getIntelligenceRepository();
  const analyzer = options.analyzer ?? getIntelligenceAnalyzer();
  const source = await repository.ensureSource(adapter);
  const result: IntelligencePipelineResult = {
    provider: adapter.descriptor.provider,
    received: 0,
    stored: 0,
    quarantined: 0,
    analyzed: 0,
    duplicates: 0,
    alertsCreated: 0,
    failed: 0,
    durationMs: 0,
    nextCursor: source.cursor
  };

  let batch;
  try {
    batch = await adapter.fetchBatch({ ...request, cursor: source.cursor });
    result.received = batch.events.length;
    result.nextCursor = batch.nextCursor;
  } catch (error) {
    await repository.markSourceError(source.id, safeErrorMessage(error));
    logEvent("error", "intelligence.adapter_failed", { provider: adapter.descriptor.provider, error });
    throw error;
  }

  for (const rawEvent of batch.events) {
    let jobId: string | null = null;
    try {
      const normalized = resolveEventEntities(normalizeSourceEvent(rawEvent), options.companyCatalog);
      const quality = assessIntelligenceEventData(normalized);
      if (quality.disposition === "quarantined") {
        await repository.quarantineEvent(source.id, normalized, quality);
        result.quarantined += 1;
        continue;
      }
      const raw = await repository.saveRawEvent(source.id, normalized);
      if (!raw.created) continue;
      result.stored += 1;

      const eventId = await repository.saveNormalizedEvent(raw.id, normalized);
      jobId = await repository.createProcessingJob(eventId);
      const candidates = await repository.findDuplicateCandidates(eventId, normalized);
      const duplicate = detectDuplicate(normalized, candidates);
      if (duplicate.isDuplicate) {
        await repository.recordDuplicate(eventId, duplicate);
        await repository.completeProcessingJob(jobId, "completed");
        result.duplicates += 1;
        continue;
      }

      const execution = await analyzer.analyze(normalized);
      const independentSourceCount = 1;
      const score = calculateImpactScore(normalized, execution.analysis, { independentSourceCount });
      await repository.saveAnalysis(eventId, execution, score, independentSourceCount, normalized);
      await repository.updateCompanyState(normalized, score);

      if (
        score.impactScore >= 70 &&
        normalized.entityConfidence >= 0.9 &&
        execution.analysis.credibility.score >= 75 &&
        execution.analysis.novelty.score >= 70 &&
        !execution.analysis.novelty.alreadyKnown
      ) {
        result.alertsCreated += await repository.createWatchlistAlerts(eventId, normalized, execution.analysis, score);
      }

      await repository.completeProcessingJob(jobId, "completed");
      result.analyzed += 1;
    } catch (error) {
      result.failed += 1;
      if (jobId) await repository.completeProcessingJob(jobId, "failed", safeErrorMessage(error)).catch(() => undefined);
      logEvent("error", "intelligence.event_failed", {
        provider: adapter.descriptor.provider,
        externalId: rawEvent.externalId,
        error
      });
    }
  }

  await repository.markSourceSuccess(source, batch.nextCursor);
  result.durationMs = Date.now() - startedAt;
  logEvent("info", "intelligence.pipeline_completed", {
    provider: result.provider,
    received: result.received,
    stored: result.stored,
    quarantined: result.quarantined,
    analyzed: result.analyzed,
    duplicates: result.duplicates,
    alertsCreated: result.alertsCreated,
    failed: result.failed,
    durationMs: result.durationMs
  });
  return result;
}
