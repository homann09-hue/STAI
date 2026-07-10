import "server-only";
import type { NormalizedIntelligenceEvent } from "@/lib/intelligence/types";
import { getIntelligenceAnalyzer } from "@/lib/intelligence/analysis";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { compareReproduction } from "@/lib/institutional/lineage";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStoredEvent(value: unknown): value is NormalizedIntelligenceEvent {
  if (!isRecord(value)) return false;
  return typeof value.provider === "string" &&
    typeof value.externalId === "string" &&
    typeof value.normalizedTitle === "string" &&
    typeof value.normalizedText === "string" &&
    typeof value.contentHash === "string" &&
    Array.isArray(value.entities);
}

function originalOutput(row: Record<string, unknown>) {
  return {
    summary: row.summary,
    facts: row.extracted_facts,
    uncertainties: row.uncertainties,
    bullishFactors: row.bullish_factors,
    bearishFactors: row.bearish_factors,
    neutralFactors: row.neutral_factors,
    sentimentScore: row.sentiment_score,
    impactScore: row.impact_score,
    direction: row.direction,
    confidenceScore: row.confidence_score,
    reasoningSummary: row.reasoning_summary
  };
}

export async function reproduceIntelligenceAnalysis(analysisId: string) {
  const client = createSupabaseServiceClient();
  if (!client) throw new Error("Supabase Service-Zugang ist für Reproduction Runs nicht konfiguriert.");

  const selected = await client
    .from("intelligence_analyses")
    .select("id,event_id,input_snapshot,input_hash,summary,extracted_facts,uncertainties,bullish_factors,bearish_factors,neutral_factors,sentiment_score,impact_score,direction,confidence_score,reasoning_summary,model_provider,model_name,model_version,prompt_version")
    .eq("id", analysisId)
    .maybeSingle();
  if (selected.error) throw selected.error;
  if (!selected.data) throw new Error("Analyse wurde nicht gefunden.");

  const row = selected.data as unknown as Record<string, unknown>;
  if (!isStoredEvent(row.input_snapshot)) {
    throw new Error("Analyse besitzt keinen reproduzierbaren Input-Snapshot und muss als legacy_unverified behandelt werden.");
  }

  const execution = await getIntelligenceAnalyzer().analyze(row.input_snapshot);
  const comparison = compareReproduction({
    originalInputHash: String(row.input_hash),
    reproducedInputHash: execution.inputHash,
    originalOutput: originalOutput(row),
    reproducedOutput: execution.analysis
  });
  const inserted = await client.from("analysis_reproduction_runs").insert({
    original_analysis_id: analysisId,
    original_input_hash: row.input_hash,
    reproduced_input_hash: execution.inputHash,
    original_output_hash: comparison.originalOutputHash,
    reproduced_output_hash: comparison.reproducedOutputHash,
    executed_model_provider: execution.modelProvider,
    executed_model_name: execution.modelName,
    executed_model_version: execution.modelVersion,
    executed_prompt_version: execution.promptVersion,
    result: comparison.result,
    difference: comparison,
    parameters: { runner: "stockpilot-reproduction/1.0.0", fallbackUsed: execution.fallbackUsed }
  }).select("id,created_at").single();
  if (inserted.error) throw inserted.error;

  const audit = await client.rpc("append_institutional_audit_event", {
    p_actor_user_id: null,
    p_actor_role: "service_account",
    p_tenant_id: null,
    p_action: "analysis.reproduced",
    p_target_type: "intelligence_analysis",
    p_target_id: analysisId,
    p_outcome: comparison.result,
    p_correlation_id: crypto.randomUUID(),
    p_previous_state: { inputHash: row.input_hash, modelVersion: row.model_version, promptVersion: row.prompt_version },
    p_new_state: { inputHash: execution.inputHash, modelVersion: execution.modelVersion, promptVersion: execution.promptVersion },
    p_reason: "Controlled reproduction run",
    p_session_context: { runner: "stockpilot-reproduction/1.0.0" }
  });
  if (audit.error) throw audit.error;

  return {
    runId: inserted.data.id,
    analysisId,
    createdAt: inserted.data.created_at,
    comparison,
    originalModel: `${row.model_provider}/${row.model_name}@${row.model_version}`,
    reproducedModel: `${execution.modelProvider}/${execution.modelName}@${execution.modelVersion}`,
    originalPromptVersion: row.prompt_version,
    reproducedPromptVersion: execution.promptVersion
  };
}
