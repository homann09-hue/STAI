import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { entitlementFromStripeSubscription } from "@/lib/billing/stripe-events";

const userId = "11111111-1111-4111-8111-111111111111";

function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return {
    id: "sub_verified123",
    customer: "cus_verified123",
    status: "active",
    metadata: { stockpilot_user_id: userId, stockpilot_plan: "pro" },
    cancel_at_period_end: false,
    trial_end: null,
    items: {
      data: [
        {
          current_period_end: 2_000_000_000,
          price: { id: "price_pro123" }
        }
      ]
    },
    ...overrides
  } as unknown as Stripe.Subscription;
}

describe("Stripe subscription normalization", () => {
  it("maps provider data to a normalized entitlement mutation", () => {
    const result = entitlementFromStripeSubscription(
      subscription(),
      (priceId) => (priceId === "price_pro123" ? "pro" : null)
    );

    expect(result).toMatchObject({
      userId,
      plan: "pro",
      status: "active",
      providerCustomerId: "cus_verified123",
      providerSubscriptionId: "sub_verified123",
      providerPriceId: "price_pro123",
      cancelAtPeriodEnd: false
    });
    expect(result?.validUntil).toBe("2033-05-18T03:33:20.000Z");
  });

  it("uses the configured price mapping before mutable metadata", () => {
    const result = entitlementFromStripeSubscription(
      subscription({ metadata: { stockpilot_user_id: userId, stockpilot_plan: "starter" } }),
      () => "pro"
    );
    expect(result?.plan).toBe("pro");
  });

  it("fails closed when a present Stripe price is not configured", () => {
    const result = entitlementFromStripeSubscription(
      subscription({ metadata: { stockpilot_user_id: userId, stockpilot_plan: "premium" } }),
      () => null
    );

    expect(result).toBeNull();
  });

  it("fails closed when the subscription has no price", () => {
    const result = entitlementFromStripeSubscription(
      subscription({ items: { data: [] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem> }),
      () => "pro"
    );

    expect(result).toBeNull();
  });

  it("rejects subscriptions without a trustworthy user mapping", () => {
    const result = entitlementFromStripeSubscription(
      subscription({ metadata: { stockpilot_user_id: "not-a-user", stockpilot_plan: "pro" } }),
      () => "pro"
    );
    expect(result).toBeNull();
  });

  it("normalizes Stripe's incomplete-expired status", () => {
    const result = entitlementFromStripeSubscription(
      subscription({ status: "incomplete_expired" }),
      () => "pro"
    );
    expect(result?.status).toBe("expired");
  });
});
