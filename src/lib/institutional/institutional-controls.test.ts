import { describe, expect, it } from "vitest";
import { assessInstitutionalData, quoteQualityIssues } from "./data-quality";
import { compareReproduction, findProhibitedFinancialClaims, sha256Canonical } from "./lineage";
import { assessHumanReview, evaluateCostBudget, evaluateFeatureFlag, roleHasPermission, validateRoleCombination } from "./governance";

const validRecord = {
  lineage: {
    recordId: "quote:NVDA:2026-07-10T10:00:00Z",
    recordType: "quote",
    source: "Licensed market feed",
    provider: "fixture",
    sourceReference: "https://provider.example/quotes/NVDA",
    fetchedAt: "2026-07-10T10:00:01Z",
    publishedAt: "2026-07-10T10:00:00Z",
    effectiveAt: "2026-07-10T10:00:00Z",
    latencyMs: 1000,
    licenseStatus: "licensed" as const,
    processingVersion: "quotes/1.0.0",
    normalizationVersion: "market-normalization/1.0.0",
    mappingConfidence: 0.99,
    correctionStatus: "original" as const
  },
  payload: { symbol: "NVDA", price: 123.45, volume: 1000, currency: "USD" }
};

describe("institutional controls", () => {
  it("accepts complete records and quarantines implausible market data", () => {
    const accepted = assessInstitutionalData(validRecord, quoteQualityIssues(validRecord.payload), new Date("2026-07-10T10:01:00Z"));
    expect(accepted.disposition).toBe("accepted");
    expect(accepted.validationStatus).toBe("validated");

    const invalidPayload = { symbol: "<SCRIPT>", price: -1, volume: -5, currency: "?" };
    const quarantined = assessInstitutionalData(
      { ...validRecord, payload: invalidPayload },
      quoteQualityIssues(invalidPayload),
      new Date("2026-07-10T10:01:00Z")
    );
    expect(quarantined.disposition).toBe("quarantined");
    expect(quarantined.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining(["DQ-PLAU-QUOTE-001", "DQ-PLAU-QUOTE-002", "DQ-COMP-QUOTE-001", "DQ-CONS-QUOTE-001"])
    );
  });

  it("quarantines missing lineage, future timestamps and prohibited licences", () => {
    const report = assessInstitutionalData(
      {
        ...validRecord,
        lineage: {
          ...validRecord.lineage,
          source: "",
          provider: "",
          publishedAt: "2026-07-11T10:00:00Z",
          licenseStatus: "prohibited" as const,
          mappingConfidence: 0.2
        }
      },
      [],
      new Date("2026-07-10T10:00:00Z")
    );
    expect(report.disposition).toBe("quarantined");
    expect(report.scores.provenance).toBe(0);
  });

  it("uses canonical hashes and reports reproducibility drift", () => {
    expect(sha256Canonical({ b: 2, a: 1 })).toBe(sha256Canonical({ a: 1, b: 2 }));
    const exact = compareReproduction({ originalInputHash: "same", reproducedInputHash: "same", originalOutput: { score: 1 }, reproducedOutput: { score: 1 } });
    expect(exact.result).toBe("exact");
    const drift = compareReproduction({ originalInputHash: "old", reproducedInputHash: "new", originalOutput: { score: 1 }, reproducedOutput: { score: 2 } });
    expect(drift.result).toBe("drift");
    expect(drift.changedTopLevelFields).toEqual(["score"]);
  });

  it("enforces role separation and least privilege", () => {
    expect(roleHasPermission("auditor", "read_audit_log")).toBe(true);
    expect(roleHasPermission("support", "read_own_data")).toBe(false);
    expect(validateRoleCombination(["analyst", "reviewer"]).valid).toBe(false);
    expect(validateRoleCombination(["analyst", "end_user"]).valid).toBe(true);
  });

  it("requires review for uncertain, high impact, stale or drifted analyses", () => {
    const review = assessHumanReview({
      confirmationStatus: "unconfirmed",
      entityConfidence: 0.6,
      impactScore: 92,
      contradictorySources: true,
      staleData: true,
      modelDrift: true,
      sourceType: "social_signal"
    });
    expect(review.required).toBe(true);
    expect(review.reasons).toHaveLength(7);
  });

  it("fails feature flags closed and applies cost kill switches", () => {
    const flag = {
      key: "enterprise_sso",
      enabled: true,
      owner: "security",
      description: "Controlled tenant pilot",
      target: "tenant_allowlist" as const,
      tenantAllowlist: ["tenant-a"],
      expiresAt: "2026-08-01T00:00:00Z",
      rollbackBehavior: "disable" as const
    };
    expect(evaluateFeatureFlag(flag, { tenantId: "tenant-b", internal: false, now: new Date("2026-07-10T00:00:00Z") }).enabled).toBe(false);
    expect(evaluateFeatureFlag(flag, { tenantId: "tenant-a", internal: false, now: new Date("2026-07-10T00:00:00Z") }).enabled).toBe(true);
    expect(evaluateCostBudget(
      { service: "ai", monthlyLimitUsd: 100, tenantLimitUsd: 20, warningPercent: 80, hardStopPercent: 100 },
      { serviceUsd: 50, tenantUsd: 21 }
    ).allowPaidOperation).toBe(false);
  });

  it("detects prohibited financial promises", () => {
    expect(findProhibitedFinancialClaims("Garantierte Rendite und risikolos")).toEqual(expect.arrayContaining(["Garantierte Rendite", "risikolos"]));
    expect(findProhibitedFinancialClaims("Modellbasierte Schätzung mit Unsicherheit und Verlustrisiko.")).toEqual([]);
  });
});
