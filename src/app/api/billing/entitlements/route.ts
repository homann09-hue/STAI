import { billingGateStatus, featureDefinitions, pricingTiers } from "@/lib/feature-gates";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { logEvent } from "@/lib/observability";
import { getSupabaseAuth } from "@/lib/supabase/user-data";
import type { FeatureDefinition, PlanId } from "@/lib/feature-gates";

export const dynamic = "force-dynamic";
const knownPlanIds = new Set<string>(pricingTiers.map((tier) => tier.id));
const knownFeatureIds = new Set<string>(featureDefinitions.map((feature) => feature.id));

function normalizePlan(value: unknown): PlanId {
  return typeof value === "string" && knownPlanIds.has(value) ? (value as PlanId) : "free";
}

function normalizeStatus(value: unknown) {
  if (value === "active" || value === "trialing" || value === "past_due" || value === "canceled" || value === "expired") {
    return value;
  }

  return "demo";
}

function normalizeProvider(value: unknown) {
  if (typeof value !== "string") return "none";
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._:-]/g, "").slice(0, 40);
  return normalized || "none";
}

function normalizeValidUntil(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isExpired(validUntil: string | null) {
  return validUntil ? Date.parse(validUntil) <= Date.now() : false;
}

function normalizeFeatures(value: unknown, billingActive: boolean) {
  if (!billingActive || !value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([featureId]) => knownFeatureIds.has(featureId))
      .map(([featureId, enabled]) => [featureId as FeatureDefinition["id"], enabled === true])
  );
}

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    return jsonOk({
      mode: "local",
      billingActive: false,
      plan: "free",
      status: "demo",
      reason: auth.reason,
      tiers: pricingTiers,
      gate: billingGateStatus
    });
  }

  const { data, error } = await auth.supabase
    .from("entitlements")
    .select("plan,status,provider,valid_until,features")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logEvent("error", "billing.entitlements_read_failed", {
      userId: auth.userId,
      error
    });

    return jsonOk({
      mode: "supabase",
      billingActive: false,
      plan: "free",
      status: "degraded",
      provider: "none",
      validUntil: null,
      features: {},
      degraded: true,
      error: "Entitlements konnten nicht gelesen werden. Feature-Gates bleiben sicherheitshalber deaktiviert.",
      tiers: pricingTiers,
      gate: billingGateStatus
    }, { status: 503 });
  }

  const plan = normalizePlan(data?.plan);
  const rawStatus = normalizeStatus(data?.status);
  const validUntil = normalizeValidUntil(data?.valid_until);
  const expired = isExpired(validUntil);
  const billingActive = Boolean(data && rawStatus === "active" && plan !== "free" && !expired);
  const status = expired ? "expired" : rawStatus;

  return jsonOk({
    mode: "supabase",
    billingActive,
    plan: billingActive ? plan : "free",
    status,
    provider: normalizeProvider(data?.provider),
    validUntil,
    features: normalizeFeatures(data?.features, billingActive),
    degraded: false,
    error: expired ? "Entitlement ist abgelaufen. Feature-Gates bleiben deaktiviert." : null,
    tiers: pricingTiers,
    gate: billingGateStatus
  });
}
