import type Stripe from "stripe";
import {
  normalizeBillingStatus,
  normalizePlanId,
  type BillingStatus
} from "@/lib/billing/entitlements";
import type { PlanId } from "@/lib/feature-gates";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectId(value: string | { id?: string } | null | undefined, prefix: string) {
  const id = typeof value === "string" ? value : value?.id;
  return typeof id === "string" && id.startsWith(prefix) && /^[A-Za-z0-9_:-]+$/.test(id) ? id : null;
}

function stripeStatus(status: Stripe.Subscription.Status): BillingStatus {
  if (status === "incomplete_expired") return "expired";
  return normalizeBillingStatus(status);
}

function timestamp(value: number | null | undefined) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? new Date(value * 1_000).toISOString()
    : null;
}

export type StripeEntitlementMutation = {
  userId: string;
  plan: Exclude<PlanId, "free">;
  status: BillingStatus;
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerPriceId: string | null;
  validUntil: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  lastSyncedAt: string;
};

export function stripeSubscriptionIds(subscription: Stripe.Subscription) {
  return {
    customerId: objectId(subscription.customer, "cus_"),
    subscriptionId: objectId(subscription.id, "sub_")
  };
}

export function entitlementFromStripeSubscription(
  subscription: Stripe.Subscription,
  resolvePricePlan: (priceId: string) => "starter" | "pro" | null,
  fallbackUserId?: string | null
): StripeEntitlementMutation | null {
  const userId = subscription.metadata.stockpilot_user_id || fallbackUserId || "";
  if (!uuidPattern.test(userId)) return null;

  const item = subscription.items.data[0];
  const priceId = objectId(item?.price, "price_");
  const metadataPlan = normalizePlanId(subscription.metadata.stockpilot_plan);
  const pricePlan = priceId ? resolvePricePlan(priceId) : null;
  const plan = pricePlan ?? (metadataPlan === "starter" || metadataPlan === "pro" || metadataPlan === "elite" ? metadataPlan : null);
  const { customerId, subscriptionId } = stripeSubscriptionIds(subscription);

  if (!plan || !customerId || !subscriptionId) return null;

  const periodEnds = subscription.items.data
    .map((subscriptionItem) => subscriptionItem.current_period_end)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const validUntilSeconds = periodEnds.length > 0 ? Math.max(...periodEnds) : subscription.trial_end;

  return {
    userId,
    plan,
    status: stripeStatus(subscription.status),
    providerCustomerId: customerId,
    providerSubscriptionId: subscriptionId,
    providerPriceId: priceId,
    validUntil: timestamp(validUntilSeconds),
    trialEndsAt: timestamp(subscription.trial_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    lastSyncedAt: new Date().toISOString()
  };
}
