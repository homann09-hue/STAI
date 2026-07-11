import {
  featureDefinitions,
  getFeatureGateStatus,
  getPlanLimits,
  type FeatureId,
  type PlanId,
  type PlanLimits
} from "@/lib/feature-gates";

export type BillingStatus =
  | "demo"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
  | "incomplete"
  | "unpaid"
  | "paused";

export type EntitlementRecordInput = {
  plan?: unknown;
  status?: unknown;
  provider?: unknown;
  provider_customer_id?: unknown;
  provider_subscription_id?: unknown;
  provider_price_id?: unknown;
  valid_until?: unknown;
  trial_ends_at?: unknown;
  cancel_at_period_end?: unknown;
  last_synced_at?: unknown;
  features?: unknown;
};

export type ResolvedEntitlements = {
  plan: PlanId;
  status: BillingStatus;
  provider: string;
  billingActive: boolean;
  billingConfigured: boolean;
  canManageBilling: boolean;
  degraded: boolean;
  reason: string | null;
  validUntil: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  lastSyncedAt: string | null;
  features: Record<FeatureId, boolean>;
  limits: PlanLimits;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  providerPriceId: string | null;
};

export type PublicEntitlements = Omit<
  ResolvedEntitlements,
  "providerCustomerId" | "providerSubscriptionId" | "providerPriceId"
>;

export type ResourceLimitKey = "watchlistItems" | "alerts" | "portfolios";

const knownPlans = new Set<PlanId>(["free", "starter", "pro", "elite"]);
const knownStatuses = new Set<BillingStatus>([
  "demo",
  "active",
  "trialing",
  "past_due",
  "canceled",
  "expired",
  "incomplete",
  "unpaid",
  "paused"
]);

export function normalizePlanId(value: unknown): PlanId {
  return typeof value === "string" && knownPlans.has(value as PlanId) ? (value as PlanId) : "free";
}

export function normalizeBillingStatus(value: unknown): BillingStatus {
  return typeof value === "string" && knownStatuses.has(value as BillingStatus)
    ? (value as BillingStatus)
    : "demo";
}

export function isPaidPlan(plan: PlanId): plan is Exclude<PlanId, "free"> {
  return plan !== "free";
}

function normalizeProvider(value: unknown) {
  if (typeof value !== "string") return "none";
  const provider = value.trim().toLowerCase().replace(/[^a-z0-9._:-]/g, "").slice(0, 40);
  return provider || "none";
}

function normalizeProviderId(value: unknown, prefix: string) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.startsWith(prefix) || !/^[A-Za-z0-9_:-]+$/.test(normalized)) return null;
  return normalized.slice(0, 160);
}

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeFeatureOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Partial<Record<FeatureId, boolean>>;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([featureId]) => featureDefinitions.some((feature) => feature.id === featureId))
      .map(([featureId, enabled]) => [featureId, enabled === true])
  ) as Partial<Record<FeatureId, boolean>>;
}

export function resolveEntitlements(
  record: EntitlementRecordInput | null | undefined,
  options: { billingConfigured: boolean; degraded?: boolean; reason?: string | null; now?: number }
): ResolvedEntitlements {
  const now = options.now ?? Date.now();
  const requestedPlan = normalizePlanId(record?.plan);
  const provider = normalizeProvider(record?.provider);
  const rawStatus = normalizeBillingStatus(record?.status);
  const validUntil = normalizeTimestamp(record?.valid_until);
  const trialEndsAt = normalizeTimestamp(record?.trial_ends_at);
  const expired = validUntil !== null && Date.parse(validUntil) <= now;
  const status: BillingStatus = expired ? "expired" : rawStatus;
  const activeStatus = status === "active" || status === "trialing";
  const stripeAccess =
    provider === "stripe" && options.billingConfigured && activeStatus && validUntil !== null && !expired;
  const manualAccess = provider === "manual" && activeStatus && !expired;
  const billingActive = isPaidPlan(requestedPlan) && (stripeAccess || manualAccess);
  const plan = billingActive ? requestedPlan : "free";
  const overrides = normalizeFeatureOverrides(record?.features);

  const features = Object.fromEntries(
    featureDefinitions.map((feature) => {
      const included = getFeatureGateStatus(plan, feature.id) === "included";
      return [feature.id, included && overrides[feature.id] !== false];
    })
  ) as Record<FeatureId, boolean>;

  const providerCustomerId = normalizeProviderId(record?.provider_customer_id, "cus_");

  return {
    plan,
    status,
    provider,
    billingActive,
    billingConfigured: options.billingConfigured,
    canManageBilling: billingActive && provider === "stripe" && providerCustomerId !== null,
    degraded: options.degraded === true,
    reason: options.reason ?? null,
    validUntil,
    trialEndsAt,
    cancelAtPeriodEnd: record?.cancel_at_period_end === true,
    lastSyncedAt: normalizeTimestamp(record?.last_synced_at),
    features,
    limits: getPlanLimits(plan),
    providerCustomerId,
    providerSubscriptionId: normalizeProviderId(record?.provider_subscription_id, "sub_"),
    providerPriceId: normalizeProviderId(record?.provider_price_id, "price_")
  };
}

export function toPublicEntitlements(entitlements: ResolvedEntitlements): PublicEntitlements {
  return {
    plan: entitlements.plan,
    status: entitlements.status,
    provider: entitlements.provider,
    billingActive: entitlements.billingActive,
    billingConfigured: entitlements.billingConfigured,
    canManageBilling: entitlements.canManageBilling,
    degraded: entitlements.degraded,
    reason: entitlements.reason,
    validUntil: entitlements.validUntil,
    trialEndsAt: entitlements.trialEndsAt,
    cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    lastSyncedAt: entitlements.lastSyncedAt,
    features: entitlements.features,
    limits: entitlements.limits
  };
}

export function evaluateResourceLimit(
  entitlements: ResolvedEntitlements,
  resource: ResourceLimitKey,
  currentUsage: number,
  existingResource = false
) {
  const limit = entitlements.limits[resource];
  const normalizedUsage = Math.max(0, Math.floor(Number.isFinite(currentUsage) ? currentUsage : 0));
  const allowed = existingResource || normalizedUsage < limit;

  return {
    allowed,
    current: normalizedUsage,
    limit,
    remaining: Math.max(0, limit - normalizedUsage)
  };
}

export function resourceLimitHeaders(entitlements: ResolvedEntitlements, limit: number) {
  return {
    "X-StockPilot-Plan": entitlements.plan,
    "X-StockPilot-Plan-Limit": `${limit}`
  };
}

export function isPlanLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.details, candidate.hint].some(
    (value) => typeof value === "string" && value.includes("plan_limit_exceeded")
  );
}
