import { describe, expect, it } from "vitest";
import type { IntelligenceAnalyzer } from "@/lib/intelligence/analysis";
import type { IntelligenceRepository, IntelligenceSourceState } from "@/lib/intelligence/repository";
import type {
  AdapterCursor,
  DuplicateCandidate,
  DuplicateDecision,
  ImpactScoreResult,
  IntelligenceAnalysis,
  IntelligenceFeedFilters,
  IntelligenceFeedItem,
  IntelligenceSourceAdapter,
  NormalizedIntelligenceEvent
} from "@/lib/intelligence/types";
import type { InstitutionalDataQualityReport } from "./data-quality";
import { runIntelligencePipeline } from "@/lib/intelligence/pipeline";

class QuarantineRepository implements IntelligenceRepository {
  quarantined = 0;
  stored = 0;
  private readonly source: IntelligenceSourceState = { id: "source-dq", configuration: {}, cursor: null };

  async ensureSource(_adapter: IntelligenceSourceAdapter) { return this.source; }
  async markSourceSuccess(_source: IntelligenceSourceState, _cursor: AdapterCursor) {}
  async markSourceError(_sourceId: string, _message: string) {}
  async quarantineEvent(_sourceId: string, _event: NormalizedIntelligenceEvent, report: InstitutionalDataQualityReport) {
    expect(report.disposition).toBe("quarantined");
    this.quarantined += 1;
  }
  async saveRawEvent(_sourceId: string, _event: NormalizedIntelligenceEvent) { this.stored += 1; return { id: "raw", created: true }; }
  async saveNormalizedEvent(_rawEventId: string, _event: NormalizedIntelligenceEvent) { return "event"; }
  async createProcessingJob(_eventId: string) { return "job"; }
  async completeProcessingJob(_jobId: string, _status: "completed" | "failed", _error?: string) {}
  async findDuplicateCandidates(_eventId: string, _event: NormalizedIntelligenceEvent): Promise<DuplicateCandidate[]> { return []; }
  async recordDuplicate(_eventId: string, _decision: DuplicateDecision) {}
  async saveAnalysis(_eventId: string, _execution: Awaited<ReturnType<IntelligenceAnalyzer["analyze"]>>, _score: ImpactScoreResult, _sources: number, _event: NormalizedIntelligenceEvent) {}
  async updateCompanyState(_event: NormalizedIntelligenceEvent, _score: ImpactScoreResult) {}
  async createWatchlistAlerts(_eventId: string, _event: NormalizedIntelligenceEvent, _analysis: IntelligenceAnalysis, _score: ImpactScoreResult) { return 0; }
  async listFeed(_filters?: IntelligenceFeedFilters): Promise<IntelligenceFeedItem[]> { return []; }
  async getFeedItem(_id: string): Promise<IntelligenceFeedItem | null> { return null; }
}

describe("intelligence pipeline data-quality quarantine", () => {
  it("quarantines invalid provider records before raw storage or model analysis", async () => {
    const repository = new QuarantineRepository();
    const adapter: IntelligenceSourceAdapter = {
      descriptor: {
        provider: "invalid-fixture",
        sourceType: "company_news",
        name: "Invalid fixture",
        baseUrl: "https://fixture.invalid",
        priority: 1,
        trustScore: 0.5,
        latencyClass: "periodic"
      },
      async fetchBatch() {
        return {
          events: [{
            provider: "invalid-fixture",
            externalId: "bad-1",
            sourceType: "company_news",
            sourceUrl: "http://unsafe.example/story",
            publisher: "Unknown",
            publishedAt: "2099-01-01T00:00:00Z",
            receivedAt: "2026-07-10T00:00:00Z",
            language: "en",
            title: "Unverified story",
            rawText: "anonymous claim",
            symbols: [],
            companyNames: [],
            metadata: { licenseStatus: "prohibited" },
            rawPayload: {},
            credibilityMetadata: { trustScore: 0.1, isPrimarySource: false, isOfficialSource: false, confirmationHint: "unconfirmed" }
          }],
          nextCursor: null,
          receivedAt: "2026-07-10T00:00:00Z"
        };
      }
    };

    const result = await runIntelligencePipeline(adapter, {}, {
      repository,
      analyzer: { async analyze() { throw new Error("analyzer must not run for quarantined input"); } }
    });

    expect(result.received).toBe(1);
    expect(result.quarantined).toBe(1);
    expect(result.stored).toBe(0);
    expect(result.analyzed).toBe(0);
    expect(repository.quarantined).toBe(1);
    expect(repository.stored).toBe(0);
  });
});
