export const institutionalRoles = [
  "end_user",
  "analyst",
  "reviewer",
  "support",
  "operations",
  "security_administrator",
  "tenant_administrator",
  "platform_administrator",
  "service_account",
  "auditor"
] as const;

export type InstitutionalRole = (typeof institutionalRoles)[number];

export type InstitutionalPermission =
  | "read_own_data"
  | "submit_analysis"
  | "review_analysis"
  | "manage_tenant_members"
  | "operate_platform"
  | "manage_security"
  | "support_metadata"
  | "read_audit_log"
  | "run_service_jobs";

const permissions: Record<InstitutionalRole, InstitutionalPermission[]> = {
  end_user: ["read_own_data"],
  analyst: ["read_own_data", "submit_analysis"],
  reviewer: ["read_own_data", "review_analysis"],
  support: ["support_metadata"],
  operations: ["operate_platform"],
  security_administrator: ["manage_security", "read_audit_log"],
  tenant_administrator: ["read_own_data", "manage_tenant_members"],
  platform_administrator: ["operate_platform", "manage_tenant_members"],
  service_account: ["run_service_jobs"],
  auditor: ["read_audit_log"]
};

const incompatibleRolePairs: Array<readonly [InstitutionalRole, InstitutionalRole]> = [
  ["analyst", "reviewer"],
  ["platform_administrator", "auditor"],
  ["security_administrator", "auditor"],
  ["support", "platform_administrator"],
  ["service_account", "end_user"]
];

export function roleHasPermission(role: InstitutionalRole, permission: InstitutionalPermission) {
  return permissions[role].includes(permission);
}

export function validateRoleCombination(roles: InstitutionalRole[]) {
  const uniqueRoles = [...new Set(roles)];
  const conflicts = incompatibleRolePairs.filter(([left, right]) => uniqueRoles.includes(left) && uniqueRoles.includes(right));
  return {
    valid: conflicts.length === 0,
    conflicts: conflicts.map(([left, right]) => `${left}:${right}`)
  };
}

export type HumanReviewInput = {
  confirmationStatus: "confirmed" | "partially_confirmed" | "unconfirmed" | "ambiguous";
  entityConfidence: number;
  impactScore: number;
  contradictorySources: boolean;
  staleData: boolean;
  modelDrift: boolean;
  sourceType: string;
};

export function assessHumanReview(input: HumanReviewInput) {
  const reasons = [
    ...(input.confirmationStatus !== "confirmed" ? ["information_not_confirmed"] : []),
    ...(input.entityConfidence < 0.9 ? ["low_entity_confidence"] : []),
    ...(input.impactScore >= 85 ? ["very_high_impact"] : []),
    ...(input.contradictorySources ? ["contradictory_sources"] : []),
    ...(input.staleData ? ["stale_data"] : []),
    ...(input.modelDrift ? ["model_drift"] : []),
    ...(input.sourceType === "social_signal" || input.sourceType === "rumor" ? ["unverified_source_type"] : [])
  ];

  return {
    required: reasons.length > 0,
    reasons,
    decision: reasons.length ? "pending_human_review" as const : "automated_validation_complete" as const
  };
}

export type ControlledFeatureFlag = {
  key: string;
  enabled: boolean;
  owner: string;
  description: string;
  target: "all" | "internal" | "tenant_allowlist";
  tenantAllowlist: string[];
  expiresAt: string;
  rollbackBehavior: "disable" | "read_only" | "fallback";
};

export function evaluateFeatureFlag(flag: ControlledFeatureFlag, context: { tenantId?: string; internal: boolean; now?: Date }) {
  const now = context.now ?? new Date();
  if (!flag.owner.trim() || !flag.description.trim() || !flag.expiresAt) {
    return { enabled: false, reason: "invalid_governance_metadata" as const };
  }
  if (!Number.isFinite(new Date(flag.expiresAt).getTime()) || new Date(flag.expiresAt) <= now) {
    return { enabled: false, reason: "expired" as const };
  }
  if (!flag.enabled) return { enabled: false, reason: "disabled" as const };
  if (flag.target === "internal" && !context.internal) return { enabled: false, reason: "target_mismatch" as const };
  if (flag.target === "tenant_allowlist" && (!context.tenantId || !flag.tenantAllowlist.includes(context.tenantId))) {
    return { enabled: false, reason: "tenant_not_allowlisted" as const };
  }
  return { enabled: true, reason: "enabled" as const };
}

export type CostBudget = {
  service: string;
  monthlyLimitUsd: number;
  tenantLimitUsd: number;
  warningPercent: number;
  hardStopPercent: number;
};

export function evaluateCostBudget(budget: CostBudget, usage: { serviceUsd: number; tenantUsd: number }) {
  const serviceRatio = budget.monthlyLimitUsd > 0 ? usage.serviceUsd / budget.monthlyLimitUsd : Number.POSITIVE_INFINITY;
  const tenantRatio = budget.tenantLimitUsd > 0 ? usage.tenantUsd / budget.tenantLimitUsd : Number.POSITIVE_INFINITY;
  const ratio = Math.max(serviceRatio, tenantRatio);
  const hardStop = budget.hardStopPercent / 100;
  const warning = budget.warningPercent / 100;

  return {
    ratio,
    state: ratio >= hardStop ? "blocked" as const : ratio >= warning ? "degraded" as const : "within_budget" as const,
    allowPaidOperation: ratio < hardStop
  };
}
