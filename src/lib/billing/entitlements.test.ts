import { describe, expect, it } from "vitest";
import {
  evaluateResourceLimit,
  resolveEntitlements,
  toPublicEntitlements
} from "@/lib/billing/entitlements";

const future = "2030-01-01T00:00:00.000Z";

describe("billing entitlements", () => {
  it("returns a usable but limited free entitlement without a provider record", () => {
    const entitlement = resolveEntitlements(null, { billingConfigured: false, now: 1_800_000_000_000 });

    expect(entitlement.plan).toBe("free");
    expect(entitlement.billingActive).toBe(false);
    expect(entitlement.features.asset_analysis).toBe(true);
    expect(entitlement.features.pro_terminal).toBe(false);
    expect(entitlement.limits.maxWatchlistItems).toBe(15);
  });

  it("activates a paid Stripe plan only with provider configuration and a future period end", () => {
    const record = {
      plan: "pro",
      status: "active",
      provider: "stripe",
      provider_customer_id: "cus_verified123456",
      provider_subscription_id: "sub_verified123456",
      provider_price_id: "price_verified123456",
      valid_until: future
    };

    expect(resolveEntitlements(record, { billingConfigured: false, now: 1_800_000_000_000 }).plan).toBe("free");

    const active = resolveEntitlements(record, { billingConfigured: true, now: 1_800_000_000_000 });
    expect(active.plan).toBe("pro");
    expect(active.billingActive).toBe(true);
    expect(active.canManageBilling).toBe(true);
    expect(active.features.pro_terminal).toBe(true);
  });

  it("fails closed for expired, past-due and incomplete subscriptions", () => {
    for (const status of ["past_due", "incomplete", "unpaid"]) {
      const entitlement = resolveEntitlements(
        { plan: "pro", status, provider: "stripe", valid_until: future },
        { billingConfigured: true, now: 1_800_000_000_000 }
      );
      expect(entitlement.plan).toBe("free");
      expect(entitlement.billingActive).toBe(false);
    }

    const expired = resolveEntitlements(
      { plan: "pro", status: "active", provider: "stripe", valid_until: "2020-01-01T00:00:00Z" },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );
    expect(expired.status).toBe("expired");
    expect(expired.plan).toBe("free");
  });

  it("allows feature overrides to disable access but never elevate unfinished features", () => {
    const entitlement = resolveEntitlements(
      {
        plan: "pro",
        status: "active",
        provider: "manual",
        valid_until: future,
        features: { pro_terminal: false, team: true }
      },
      { billingConfigured: false, now: 1_800_000_000_000 }
    );

    expect(entitlement.features.pro_terminal).toBe(false);
    expect(entitlement.features.exports).toBe(false);
  });

  it("applies limits while preserving idempotent updates of existing resources", () => {
    const entitlement = resolveEntitlements(null, { billingConfigured: false });
    expect(evaluateResourceLimit(entitlement, "maxWatchlistItems", 15).allowed).toBe(false);
    expect(evaluateResourceLimit(entitlement, "maxWatchlistItems", 10, true).allowed).toBe(true);
    expect(evaluateResourceLimit(entitlement, "maxAlerts", Number.NaN)).toEqual({
      allowed: true,
      current: 0,
      limit: 3,
      remaining: 3
    });
  });

  it("redacts provider identifiers from the public entitlement response", () => {
    const entitlement = resolveEntitlements(
      {
        plan: "pro",
        status: "active",
        provider: "stripe",
        provider_customer_id: "cus_verified123456",
        provider_subscription_id: "sub_verified123456",
        provider_price_id: "price_verified123456",
        valid_until: future
      },
      { billingConfigured: true, now: 1_800_000_000_000 }
    );

    const publicValue = toPublicEntitlements(entitlement) as Record<string, unknown>;
    expect(publicValue.providerCustomerId).toBeUndefined();
    expect(publicValue.providerSubscriptionId).toBeUndefined();
    expect(publicValue.providerPriceId).toBeUndefined();
  });
});
