import { billingGateStatus, pricingTiers } from "@/lib/feature-gates";
import { resolveEntitlements, toPublicEntitlements } from "@/lib/billing/entitlements";
import { getBillingPublicConfiguration, getUserEntitlements } from "@/lib/billing/server";
import { jsonOk, rateLimit } from "@/lib/api-guard";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const billing = getBillingPublicConfiguration();
  const auth = await getSupabaseAuth(request);

  if (!auth.ok) {
    const entitlement = resolveEntitlements(null, {
      billingConfigured: billing.webhookConfigured,
      reason: auth.reason
    });
    return jsonOk({
      mode: "local" as const,
      ...toPublicEntitlements(entitlement),
      tiers: pricingTiers,
      gate: billingGateStatus,
      billing
    });
  }

  const entitlement = await getUserEntitlements(auth);
  return jsonOk(
    {
      mode: "supabase" as const,
      ...toPublicEntitlements(entitlement),
      tiers: pricingTiers,
      gate: billingGateStatus,
      billing
    },
    { status: entitlement.degraded ? 503 : 200 }
  );
}
