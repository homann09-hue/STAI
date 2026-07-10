export const intelligenceSourceTypes = [
  "company_news",
  "press_release",
  "regulatory_filing",
  "market_anomaly",
  "macro_event",
  "social_signal"
] as const;

export const canonicalEventTypes = [
  "earnings_release",
  "earnings_guidance_change",
  "regulatory_filing",
  "analyst_action",
  "insider_transaction",
  "institutional_ownership_change",
  "merger_acquisition",
  "capital_action",
  "dividend_change",
  "management_change",
  "legal_regulatory",
  "product_event",
  "contract_event",
  "supply_chain_event",
  "market_anomaly",
  "macro_event",
  "rumor",
  "other"
] as const;

export const confirmationStatuses = ["confirmed", "partially_confirmed", "unconfirmed", "ambiguous"] as const;
export const intelligenceDirections = ["positive", "negative", "mixed", "unclear"] as const;
export const intelligenceLatencyClasses = ["streaming", "near_real_time", "periodic", "delayed", "end_of_day"] as const;
export const intelligenceTimeHorizons = ["short_term", "medium_term", "long_term"] as const;

export type IntelligenceSourceType = (typeof intelligenceSourceTypes)[number];
export type CanonicalEventType = (typeof canonicalEventTypes)[number];
export type ConfirmationStatus = (typeof confirmationStatuses)[number];
export type IntelligenceDirection = (typeof intelligenceDirections)[number];
export type IntelligenceLatencyClass = (typeof intelligenceLatencyClasses)[number];
export type IntelligenceTimeHorizon = (typeof intelligenceTimeHorizons)[number];

export type SourceCredibilityMetadata = {
  trustScore: number;
  isPrimarySource: boolean;
  isOfficialSource: boolean;
  confirmationHint?: ConfirmationStatus;
};

export type RawSourceEvent = {
  provider: string;
  externalId: string;
  sourceType: IntelligenceSourceType;
  sourceUrl: string;
  publisher: string;
  publishedAt: string;
  receivedAt: string;
  language: string;
  title: string;
  rawText: string;
  symbols: string[];
  companyNames: string[];
  metadata: Record<string, unknown>;
  rawPayload: Record<string, unknown>;
  credibilityMetadata: SourceCredibilityMetadata;
};

export type SecEntityRequest = {
  cik: string;
  symbol?: string;
};

export type AdapterCursor = string | Record<string, string> | null;

export type AdapterFetchRequest = {
  symbols?: string[];
  secEntities?: SecEntityRequest[];
  cursor?: AdapterCursor;
  limit?: number;
};

export type AdapterBatch = {
  events: RawSourceEvent[];
  nextCursor: AdapterCursor;
  receivedAt: string;
};

export type IntelligenceSourceDescriptor = {
  provider: string;
  sourceType: IntelligenceSourceType;
  name: string;
  baseUrl: string;
  priority: number;
  trustScore: number;
  latencyClass: IntelligenceLatencyClass;
};

export interface IntelligenceSourceAdapter {
  readonly descriptor: IntelligenceSourceDescriptor;
  fetchBatch(request: AdapterFetchRequest): Promise<AdapterBatch>;
}

export type CompanyReference = {
  companyId?: string;
  symbol: string;
  name: string;
  isin?: string;
  cik?: string;
  exchange?: string;
  country?: string;
  aliases?: string[];
  formerNames?: string[];
  subsidiaries?: string[];
  brands?: string[];
};

export type ResolvedEntity = {
  entityType: "company" | "security" | "brand" | "subsidiary";
  entityId: string | null;
  symbol: string | null;
  companyName: string | null;
  confidence: number;
  relationshipType: "direct" | "indirect" | "mentioned";
};

export type NormalizedIntelligenceEvent = RawSourceEvent & {
  contentHash: string;
  normalizedTitle: string;
  normalizedText: string;
  canonicalEventType: CanonicalEventType;
  primarySymbol: string | null;
  companyId: string | null;
  eventTime: string;
  confirmationStatus: ConfirmationStatus;
  sourceCredibilityScore: number;
  entities: ResolvedEntity[];
  entityConfidence: number;
};

export type ExtractedFact = {
  statement: string;
  sourceEvidence: string;
  confidence: number;
};

export type IntelligenceAnalysis = {
  eventType: CanonicalEventType;
  summary: string;
  facts: ExtractedFact[];
  affectedCompanies: Array<{
    symbol: string;
    relationship: "direct" | "indirect" | "mentioned";
    confidence: number;
  }>;
  sentiment: {
    score: number;
    label: "positive" | "negative" | "neutral" | "mixed";
  };
  impact: {
    score: number;
    severity: "low" | "medium" | "high" | "critical";
    timeHorizon: IntelligenceTimeHorizon[];
  };
  credibility: {
    score: number;
    status: ConfirmationStatus;
  };
  novelty: {
    score: number;
    alreadyKnown: boolean;
  };
  bullishFactors: string[];
  bearishFactors: string[];
  neutralFactors: string[];
  uncertainties: string[];
  reasoningSummary: string;
  requiresHumanReview: boolean;
};

export type AnalysisExecution = {
  analysis: IntelligenceAnalysis;
  modelProvider: string;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  inputHash: string;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  fallbackUsed: boolean;
};

export type ImpactScoreComponents = {
  eventSeverity: number;
  relevance: number;
  credibility: number;
  novelty: number;
  entityConfidence: number;
  confirmationFactor: number;
  magnitude: number;
  marketReaction: number | null;
  volumeReaction: number | null;
  modelConfidence: number;
  independentSources: number;
};

export type ImpactScoreResult = {
  impactScore: number;
  positiveImpactScore: number;
  negativeImpactScore: number;
  direction: IntelligenceDirection;
  components: ImpactScoreComponents;
};

export type DuplicateCandidate = {
  id: string;
  provider: string;
  externalId: string;
  sourceUrl: string;
  contentHash: string;
  normalizedTitle: string;
  primarySymbol: string | null;
  canonicalEventType: CanonicalEventType;
  eventTime: string;
};

export type DuplicateDecision = {
  isDuplicate: boolean;
  canonicalEventId: string | null;
  similarityScore: number;
  reason: "provider_id" | "source_url" | "content_hash" | "title_similarity" | "semantic_window" | "none";
  independentConfirmation: boolean;
};

export type IntelligenceFeedFilters = {
  symbol?: string;
  eventType?: CanonicalEventType;
  direction?: IntelligenceDirection;
  confirmationStatus?: ConfirmationStatus;
  minImpact?: number;
  since?: string;
  limit?: number;
};

export type IntelligenceFeedItem = {
  id: string;
  title: string;
  summary: string;
  normalizedTitle: string;
  primarySymbol: string | null;
  companyId: string | null;
  eventType: CanonicalEventType;
  eventTime: string;
  confirmationStatus: ConfirmationStatus;
  provider: string;
  publisher: string;
  sourceUrl: string;
  latencyClass: IntelligenceLatencyClass;
  sourceCredibilityScore: number;
  direction: IntelligenceDirection;
  sentimentScore: number;
  relevanceScore: number;
  noveltyScore: number;
  credibilityScore: number;
  impactScore: number;
  positiveImpactScore: number;
  negativeImpactScore: number;
  confidenceScore: number;
  reasoningSummary: string;
  facts: ExtractedFact[];
  uncertainties: string[];
  bullishFactors: string[];
  bearishFactors: string[];
  neutralFactors: string[];
  timeHorizons: IntelligenceTimeHorizon[];
  citations: string[];
  modelProvider: string;
  modelName: string;
  analysisId: string;
  modelVersion: string;
  promptVersion: string;
  inputHash: string;
  scoringVersion: string;
  processingVersion: string;
  normalizationVersion: string;
  validationStatus: string;
  analyzedAt: string;
  requiresHumanReview: boolean;
  scoreComponents: ImpactScoreComponents;
  independentSourceCount: number;
};

export type IntelligenceFeedResult = {
  configured: boolean;
  events: IntelligenceFeedItem[];
  generatedAt: string;
  warning: string | null;
};
