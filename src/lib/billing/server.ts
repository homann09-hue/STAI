import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEntitlements, type EntitlementRecordInput } from "@/lib/billing/entitlements";
import { getStripeBillingConfiguration, getStripePublicConfiguration } from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";

export type BillingAuthContext = {
  supabase: SupabaseClient;
  userId: string;
};

export async function getUserEntitlements(auth: BillingAuthContext) {
  const stripeConfiguration = getStripeBillingConfiguration();
  const { data, error } = await auth.supabase
    .from("entitlements")
    .select(
      "plan,status,provider,provider_customer_id,provider_subscription_id,provider_price_id,valid_until,trial_ends_at,cancel_at_period_end,last_synced_at,features,updated_at"
    )
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logEvent("error", "billing.entitlements_read_failed", {
      userId: auth.userId,
      code: error.code,
      message: error.message
    });
    return resolveEntitlements(null, {
      billingConfigured: stripeConfiguration.entitlementsConfigured,
      degraded: true,
      reason: "entitlements_unavailable"
    });
  }

  return resolveEntitlements(data as EntitlementRecordInput | null, {
    billingConfigured: stripeConfiguration.entitlementsConfigured
  });
}

export function getBillingPublicConfiguration() {
  return getStripePublicConfiguration();
}
