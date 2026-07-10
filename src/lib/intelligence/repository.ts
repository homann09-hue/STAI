import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntelligenceAnalyzer } from "@/lib/intelligence/analysis";
import type {
  AdapterCursor,
  DuplicateCandidate,
  DuplicateDecision,
  ImpactScoreResult,
  IntelligenceAnalysis,
  IntelligenceFeedFilters,
  IntelligenceFeedItem,
  IntelligenceFeedResult,
  IntelligenceSourceAdapter,
  NormalizedIntelligenceEvent,
  RawSourceEvent
} from "@/lib/intelligence/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = SupabaseClient;

export class IntelligenceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceConfigurationError";
  }
}

export type IntelligenceSourceState = {
  id: string;
  configuration: Record<string, unknown>;
  cursor: AdapterCursor;
};

export type PersistedRawEvent = {
  id: string;
  created: boolean;
};

export interface IntelligenceRepository {
  ensureSource(adapter: IntelligenceSourceAdapter): Promise<IntelligenceSourceState>;
  markSourceSuccess(source: IntelligenceSourceState, cursor: AdapterCursor): Promise<void>;
  markSourceError(sourceId: string, message: string): Promise<void>;
  saveRawEvent(sourceId: string, event: NormalizedIntelligenceEvent): Promise<PersistedRawEvent>;
  saveNormalizedEvent(rawEventId: string, event: NormalizedIntelligenceEvent): Promise<string>;
  createProcessingJob(eventId: string): Promise<string>;
  completeProcessingJob(jobId: string, status: "completed" | "failed", error?: string): Promise<void>;
  findDuplicateCandidates(eventId: string, event: NormalizedIntelligenceEvent): Promise<DuplicateCandidate[]>;
  recordDuplicate(eventId: string, decision: DuplicateDecision): Promise<void>;
  saveAnalysis(
    eventId: string,
    execution: Awaited<ReturnType<IntelligenceAnalyzer["analyze"]>>,
    score: ImpactScoreResult,
    independentSourceCount: number,
    sourceUrl: string
  ): Promise<void>;
  updateCompanyState(event: NormalizedIntelligenceEvent, score: ImpactScoreResult): Promise<void>;
  createWatchlistAlerts(eventId: string, event: NormalizedIntelligenceEvent, analysis: IntelligenceAnalysis, score: ImpactScoreResult): Promise<number>;
  listFeed(filters?: IntelligenceFeedFilters): Promise<IntelligenceFeedItem[]>;
  getFeedItem(id: string): Promise<IntelligenceFeedItem | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function factArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const statement = stringValue(item.statement);
    const sourceEvidence = stringValue(item.sourceEvidence ?? item.source_evidence);
    if (!statement || !sourceEvidence) return [];
    return [{ statement, sourceEvidence, confidence: Math.max(0, Math.min(1, numberValue(item.confidence))) }];
  });
}

function scoreComponents(value: unknown): IntelligenceFeedItem["scoreComponents"] {
  const record = isRecord(value) ? value : {};
  return {
    eventSeverity: numberValue(record.eventSeverity ?? record.event_severity),
    relevance: numberValue(record.relevance),
    credibility: numberValue(record.credibility),
    novelty: numberValue(record.novelty),
    entityConfidence: numberValue(record.entityConfidence ?? record.entity_confidence),
    confirmationFactor: numberValue(record.confirmationFactor ?? record.confirmation_factor),
    magnitude: numberValue(record.magnitude),
    marketReaction: record.marketReaction === null || record.market_reaction === null ? null : numberValue(record.marketReaction ?? record.market_reaction),
    volumeReaction: record.volumeReaction === null || record.volume_reaction === null ? null : numberValue(record.volumeReaction ?? record.volume_reaction),
    modelConfidence: numberValue(record.modelConfidence ?? record.model_confidence),
    independentSources: numberValue(record.independentSources ?? record.independent_sources, 1)
  };
}

function mapFeedItem(value: unknown): IntelligenceFeedItem {
  const row = isRecord(value) ? value : {};
  return {
    id: stringValue(row.id),
    title: stringValue(row.title, "Ereignis ohne Titel"),
    summary: stringValue(row.summary, "Analyse nicht verfügbar."),
    normalizedTitle: stringValue(row.normalized_title),
    primarySymbol: stringValue(row.primary_symbol) || null,
    companyId: stringValue(row.company_id) || null,
    eventType: stringValue(row.canonical_event_type, "other") as IntelligenceFeedItem["eventType"],
    eventTime: stringValue(row.event_time, new Date(0).toISOString()),
    confirmationStatus: stringValue(row.confirmation_status, "unconfirmed") as IntelligenceFeedItem["confirmationStatus"],
    provider: stringValue(row.provider, "unknown"),
    publisher: stringValue(row.publisher, "Quelle unbekannt"),
    sourceUrl: stringValue(row.source_url),
    latencyClass: stringValue(row.latency_class, "periodic") as IntelligenceFeedItem["latencyClass"],
    sourceCredibilityScore: numberValue(row.source_credibility_score),
    direction: stringValue(row.direction, "unclear") as IntelligenceFeedItem["direction"],
    sentimentScore: numberValue(row.sentiment_score),
    relevanceScore: numberValue(row.relevance_score),
    noveltyScore: numberValue(row.novelty_score),
    credibilityScore: numberValue(row.credibility_score),
    impactScore: numberValue(row.impact_score),
    positiveImpactScore: numberValue(row.positive_impact_score),
    negativeImpactScore: numberValue(row.negative_impact_score),
    confidenceScore: numberValue(row.confidence_score),
    reasoningSummary: stringValue(row.reasoning_summary),
    facts: factArray(row.extracted_facts),
    uncertainties: stringArray(row.uncertainties),
    bullishFactors: stringArray(row.bullish_factors),
    bearishFactors: stringArray(row.bearish_factors),
    neutralFactors: stringArray(row.neutral_factors),
    timeHorizons: stringArray(row.affected_time_horizon) as IntelligenceFeedItem["timeHorizons"],
    citations: stringArray(row.citations),
    modelProvider: stringValue(row.model_provider),
    modelName: stringValue(row.model_name),
    requiresHumanReview: row.requires_human_review === true,
    scoreComponents: scoreComponents(row.score_components),
    independentSourceCount: numberValue(row.independent_source_count, 1)
  };
}

function duplicateCandidate(value: unknown): DuplicateCandidate {
  const row = isRecord(value) ? value : {};
  return {
    id: stringValue(row.id),
    provider: stringValue(row.provider),
    externalId: stringValue(row.external_id),
    sourceUrl: stringValue(row.source_url),
    contentHash: stringValue(row.content_hash),
    normalizedTitle: stringValue(row.normalized_title),
    primarySymbol: stringValue(row.primary_symbol) || null,
    canonicalEventType: stringValue(row.canonical_event_type, "other") as DuplicateCandidate["canonicalEventType"],
    eventTime: stringValue(row.event_time, new Date(0).toISOString())
  };
}

function intelligenceReadTimeoutMs() {
  const configured = Number(process.env.STOCKPILOT_INTELLIGENCE_READ_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.min(Math.max(configured, 500), 5_000) : 2_500;
}

async function withIntelligenceReadTimeout<T>(operation: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new IntelligenceConfigurationError("Intelligence-Datenbank antwortet nicht rechtzeitig.")), intelligenceReadTimeoutMs());
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export class SupabaseIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly client: ServiceClient) {}

  async ensureSource(adapter: IntelligenceSourceAdapter) {
    const descriptor = adapter.descriptor;
    const configuration = { latency_class: descriptor.latencyClass, cursor: null };
    const existing = await this.client
      .from("intelligence_sources")
      .select("id,configuration")
      .eq("provider", descriptor.provider)
      .eq("source_type", descriptor.sourceType)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (existing.data) {
      const update = await this.client
        .from("intelligence_sources")
        .update({
          name: descriptor.name,
          base_url: descriptor.baseUrl,
          enabled: true,
          priority: descriptor.priority,
          trust_score: descriptor.trustScore
        })
        .eq("id", existing.data.id);
      if (update.error) throw update.error;
      const storedConfiguration = isRecord(existing.data.configuration) ? existing.data.configuration : configuration;
      return {
        id: stringValue(existing.data.id),
        configuration: storedConfiguration,
        cursor: (storedConfiguration.cursor as AdapterCursor | undefined) ?? null
      };
    }

    const inserted = await this.client.from("intelligence_sources").insert({
      provider: descriptor.provider,
      source_type: descriptor.sourceType,
      name: descriptor.name,
      base_url: descriptor.baseUrl,
      enabled: true,
      priority: descriptor.priority,
      trust_score: descriptor.trustScore,
      configuration
    }).select("id,configuration").single();
    if (inserted.error) throw inserted.error;
    const storedConfiguration = isRecord(inserted.data.configuration) ? inserted.data.configuration : configuration;
    return {
      id: stringValue(inserted.data.id),
      configuration: storedConfiguration,
      cursor: (storedConfiguration.cursor as AdapterCursor | undefined) ?? null
    };
  }

  async markSourceSuccess(source: IntelligenceSourceState, cursor: AdapterCursor) {
    const { error } = await this.client
      .from("intelligence_sources")
      .update({
        last_success_at: new Date().toISOString(),
        configuration: { ...source.configuration, cursor }
      })
      .eq("id", source.id);
    if (error) throw error;
  }

  async markSourceError(sourceId: string, message: string) {
    const { error } = await this.client
      .from("intelligence_sources")
      .update({ last_error_at: new Date().toISOString(), last_error_message: message.slice(0, 500) })
      .eq("id", sourceId);
    if (error && error.code !== "PGRST204") throw error;
    if (error?.code === "PGRST204") {
      const fallback = await this.client.from("intelligence_sources").update({ last_error_at: new Date().toISOString() }).eq("id", sourceId);
      if (fallback.error) throw fallback.error;
    }
  }

  async saveRawEvent(sourceId: string, event: NormalizedIntelligenceEvent) {
    const { data, error } = await this.client
      .from("raw_intelligence_events")
      .upsert(
        {
          source_id: sourceId,
          external_id: event.externalId,
          source_url: event.sourceUrl,
          published_at: event.publishedAt,
          received_at: event.receivedAt,
          title: event.title,
          raw_text: event.rawText,
          raw_payload: event.rawPayload,
          content_hash: event.contentHash,
          language: event.language,
          processing_status: "received"
        },
        { onConflict: "source_id,external_id", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return { id: stringValue(data.id), created: true };

    const existing = await this.client
      .from("raw_intelligence_events")
      .select("id")
      .eq("source_id", sourceId)
      .eq("external_id", event.externalId)
      .single();
    if (existing.error) throw existing.error;
    return { id: stringValue(existing.data.id), created: false };
  }

  async saveNormalizedEvent(rawEventId: string, event: NormalizedIntelligenceEvent) {
    const { data, error } = await this.client
      .from("normalized_intelligence_events")
      .insert({
        raw_event_id: rawEventId,
        canonical_event_type: event.canonicalEventType,
        normalized_title: event.normalizedTitle,
        normalized_text: event.normalizedText,
        primary_symbol: event.primarySymbol,
        company_id: event.companyId,
        event_time: event.eventTime,
        confirmation_status: event.confirmationStatus,
        source_credibility_score: event.sourceCredibilityScore,
        entity_confidence: event.entityConfidence
      })
      .select("id")
      .single();
    if (error) throw error;
    const eventId = stringValue(data.id);

    if (event.entities.length) {
      const entities = await this.client.from("intelligence_event_entities").insert(
        event.entities.map((entity) => ({
          event_id: eventId,
          entity_type: entity.entityType,
          entity_id: entity.entityId,
          symbol: entity.symbol,
          company_name: entity.companyName,
          confidence: entity.confidence,
          relationship_type: entity.relationshipType
        }))
      );
      if (entities.error) throw entities.error;
    }

    const rawUpdate = await this.client.from("raw_intelligence_events").update({ processing_status: "normalized" }).eq("id", rawEventId);
    if (rawUpdate.error) throw rawUpdate.error;
    return eventId;
  }

  async createProcessingJob(eventId: string) {
    const { data, error } = await this.client
      .from("intelligence_processing_jobs")
      .insert({ event_id: eventId, job_type: "analyze", status: "processing", priority: 50, attempts: 1, started_at: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    return stringValue(data.id);
  }

  async completeProcessingJob(jobId: string, status: "completed" | "failed", errorMessage?: string) {
    const { error } = await this.client
      .from("intelligence_processing_jobs")
      .update({ status, completed_at: new Date().toISOString(), error: errorMessage?.slice(0, 1_000) ?? null })
      .eq("id", jobId);
    if (error) throw error;
  }

  async findDuplicateCandidates(eventId: string, event: NormalizedIntelligenceEvent) {
    const eventTime = new Date(event.eventTime).getTime();
    const from = new Date(eventTime - 24 * 60 * 60 * 1_000).toISOString();
    const to = new Date(eventTime + 24 * 60 * 60 * 1_000).toISOString();
    let query = this.client
      .from("intelligence_feed")
      .select("id,provider,external_id,source_url,content_hash,normalized_title,primary_symbol,canonical_event_type,event_time")
      .neq("id", eventId)
      .gte("event_time", from)
      .lte("event_time", to)
      .limit(50);
    if (event.primarySymbol) query = query.eq("primary_symbol", event.primarySymbol);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(duplicateCandidate);
  }

  async recordDuplicate(eventId: string, decision: DuplicateDecision) {
    if (!decision.canonicalEventId) return;
    const { error } = await this.client.from("intelligence_event_duplicates").upsert(
      {
        canonical_event_id: decision.canonicalEventId,
        duplicate_event_id: eventId,
        similarity_score: decision.similarityScore,
        duplicate_reason: decision.reason,
        independent_confirmation: decision.independentConfirmation
      },
      { onConflict: "canonical_event_id,duplicate_event_id" }
    );
    if (error) throw error;

    if (decision.independentConfirmation) {
      const canonical = await this.client.from("normalized_intelligence_events").select("confirmation_status").eq("id", decision.canonicalEventId).single();
      if (!canonical.error && canonical.data.confirmation_status !== "confirmed") {
        await this.client.from("normalized_intelligence_events").update({ confirmation_status: "partially_confirmed" }).eq("id", decision.canonicalEventId);
      }
    }
  }

  async saveAnalysis(
    eventId: string,
    execution: Awaited<ReturnType<IntelligenceAnalyzer["analyze"]>>,
    score: ImpactScoreResult,
    independentSourceCount: number,
    sourceUrl: string
  ) {
    const analysis = execution.analysis;
    const confidenceScore = score.components.modelConfidence;
    const { error } = await this.client.from("intelligence_analyses").insert({
      event_id: eventId,
      model_provider: execution.modelProvider,
      model_name: execution.modelName,
      model_version: execution.modelVersion,
      prompt_version: execution.promptVersion,
      summary: analysis.summary,
      extracted_facts: analysis.facts,
      uncertainties: analysis.uncertainties,
      bullish_factors: analysis.bullishFactors,
      bearish_factors: analysis.bearishFactors,
      neutral_factors: analysis.neutralFactors,
      affected_time_horizon: analysis.impact.timeHorizon,
      sentiment_score: analysis.sentiment.score,
      relevance_score: score.components.relevance,
      novelty_score: score.components.novelty,
      credibility_score: score.components.credibility,
      impact_score: score.impactScore,
      positive_impact_score: score.positiveImpactScore,
      negative_impact_score: score.negativeImpactScore,
      direction: score.direction,
      confidence_score: confidenceScore,
      reasoning_summary: analysis.reasoningSummary,
      citations: [sourceUrl],
      input_hash: execution.inputHash,
      score_components: score.components,
      independent_source_count: independentSourceCount,
      requires_human_review: analysis.requiresHumanReview,
      input_tokens: execution.inputTokens,
      output_tokens: execution.outputTokens,
      estimated_cost_usd: execution.estimatedCostUsd,
      fallback_used: execution.fallbackUsed
    });
    if (error) throw error;
  }

  async updateCompanyState(event: NormalizedIntelligenceEvent, score: ImpactScoreResult) {
    if (!event.companyId || !event.primarySymbol) return;
    const { data } = await this.client
      .from("company_intelligence_state")
      .select("positive_event_count,negative_event_count,unresolved_risk_count")
      .eq("company_id", event.companyId)
      .maybeSingle();
    const current: Record<string, unknown> = isRecord(data) ? data : {};
    const signedScore = score.direction === "positive" ? score.impactScore : score.direction === "negative" ? -score.impactScore : 0;
    const { error } = await this.client.from("company_intelligence_state").upsert({
      company_id: event.companyId,
      symbol: event.primarySymbol,
      short_term_score: signedScore,
      medium_term_score: Math.round(signedScore * 0.75),
      long_term_score: Math.round(signedScore * 0.45),
      positive_event_count: numberValue(current.positive_event_count) + (score.direction === "positive" ? 1 : 0),
      negative_event_count: numberValue(current.negative_event_count) + (score.direction === "negative" ? 1 : 0),
      unresolved_risk_count: numberValue(current.unresolved_risk_count) + (event.confirmationStatus !== "confirmed" ? 1 : 0),
      last_event_at: event.eventTime,
      last_recalculated_at: new Date().toISOString()
    }, { onConflict: "company_id" });
    if (error) throw error;
  }

  async createWatchlistAlerts(eventId: string, event: NormalizedIntelligenceEvent, analysis: IntelligenceAnalysis, score: ImpactScoreResult) {
    if (!event.primarySymbol) return 0;
    const { data, error } = await this.client.from("watchlists").select("user_id").eq("symbol", event.primarySymbol).limit(10_000);
    if (error) throw error;
    const userIds = [...new Set((data ?? []).map((row) => stringValue(row.user_id)).filter(Boolean))];
    if (!userIds.length) return 0;
    const deterministicCritical =
      score.impactScore >= 90 &&
      event.confirmationStatus === "confirmed" &&
      ["earnings_guidance_change", "legal_regulatory", "merger_acquisition"].includes(event.canonicalEventType);
    const severity = deterministicCritical ? "critical" : score.impactScore >= 80 ? "high" : score.impactScore >= 70 ? "relevant" : "info";
    const { error: insertError } = await this.client.from("intelligence_alerts").upsert(
      userIds.map((userId) => ({
        user_id: userId,
        company_id: event.companyId,
        symbol: event.primarySymbol,
        event_id: eventId,
        alert_type: "intelligence_event",
        severity,
        title: `${event.primarySymbol}: ${event.normalizedTitle}`.slice(0, 240),
        message: `${analysis.summary} Impact ${score.impactScore}/100. Keine Anlageberatung.`.slice(0, 1_000),
        delivery_status: "pending"
      })),
      { onConflict: "user_id,event_id,alert_type", ignoreDuplicates: true }
    );
    if (insertError) throw insertError;
    return userIds.length;
  }

  async listFeed(filters: IntelligenceFeedFilters = {}) {
    let query = this.client.from("intelligence_feed").select("*").order("event_time", { ascending: false }).limit(filters.limit ?? 50);
    if (filters.symbol) query = query.eq("primary_symbol", filters.symbol);
    if (filters.eventType) query = query.eq("canonical_event_type", filters.eventType);
    if (filters.direction) query = query.eq("direction", filters.direction);
    if (filters.confirmationStatus) query = query.eq("confirmation_status", filters.confirmationStatus);
    if (filters.minImpact !== undefined) query = query.gte("impact_score", filters.minImpact);
    if (filters.since) query = query.gte("event_time", filters.since);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapFeedItem);
  }

  async getFeedItem(id: string) {
    const { data, error } = await this.client.from("intelligence_feed").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapFeedItem(data) : null;
  }
}

export function getIntelligenceRepository() {
  const client = createSupabaseServiceClient();
  if (!client) throw new IntelligenceConfigurationError("Supabase Service-Zugang ist für Intelligence nicht konfiguriert.");
  return new SupabaseIntelligenceRepository(client);
}

export async function getPublicIntelligenceFeed(filters: IntelligenceFeedFilters = {}): Promise<IntelligenceFeedResult> {
  const generatedAt = new Date().toISOString();
  try {
    const events = await withIntelligenceReadTimeout(getIntelligenceRepository().listFeed(filters));
    return { configured: true, events, generatedAt, warning: events.length ? null : "Noch keine verarbeiteten Intelligence-Ereignisse vorhanden." };
  } catch (error) {
    const warning = error instanceof IntelligenceConfigurationError
      ? error.message
      : "Intelligence-Daten sind vorübergehend nicht verfügbar.";
    return { configured: false, events: [], generatedAt, warning };
  }
}

export async function getPublicIntelligenceEvent(id: string) {
  try {
    return { configured: true, event: await withIntelligenceReadTimeout(getIntelligenceRepository().getFeedItem(id)), warning: null };
  } catch (error) {
    return {
      configured: false,
      event: null,
      warning: error instanceof IntelligenceConfigurationError ? error.message : "Intelligence-Ereignis ist nicht verfügbar."
    };
  }
}

export function rawEventForTesting(event: RawSourceEvent) {
  return event;
}
