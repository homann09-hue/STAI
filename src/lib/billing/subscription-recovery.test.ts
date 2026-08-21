import { describe, expect, it } from "vitest";
import {
  decideStripeCheckoutDisposition,
  isTerminalStripeSubscriptionStatus,
  requiresStripePaymentRecovery
} from "@/lib/billing/subscription-recovery";

describe("Stripe checkout disposition", () => {
  it("allows checkout only when all historical subscriptions are terminal", () => {
    expect(
      decideStripeCheckoutDisposition({
        customerIds: ["cus_history"],
        subscriptions: [
          { customerId: "cus_history", status: "canceled" },
          { customerId: "cus_history", status: "incomplete_expired" }
        ]
      })
    ).toEqual({ action: "checkout", customerId: "cus_history" });
  });

  it.each(["active", "trialing", "past_due", "unpaid", "incomplete", "paused", "future_status"])(
    "routes the non-terminal status %s to the portal",
    (status) => {
      const result = decideStripeCheckoutDisposition({
        customerIds: ["cus_existing"],
        subscriptions: [{ customerId: "cus_existing", status }]
      });
      expect(result.action).toBe("portal");
      if (result.action !== "portal") return;
      expect(result.customerId).toBe("cus_existing");
      expect(result.statuses).toEqual([status]);
      expect(result.paymentRecoveryRequired).toBe(requiresStripePaymentRecovery(status));
    }
  );

  it("requires support instead of guessing across multiple subscribed customers", () => {
    expect(
      decideStripeCheckoutDisposition({
        customerIds: ["cus_b", "cus_a"],
        subscriptions: [
          { customerId: "cus_a", status: "active" },
          { customerId: "cus_b", status: "past_due" }
        ]
      })
    ).toEqual({ action: "support", customerCount: 2, statuses: ["past_due", "active"] });
  });

  it("orders unknown provider states deterministically", () => {
    const result = decideStripeCheckoutDisposition({
      customerIds: ["cus_unknown"],
      subscriptions: [
        { customerId: "cus_unknown", status: "zeta_state" },
        { customerId: "cus_unknown", status: "alpha_state" }
      ]
    });
    expect(result).toMatchObject({ action: "portal", statuses: ["alpha_state", "zeta_state"] });
  });

  it("deduplicates customers and preserves a trustworthy preferred customer", () => {
    expect(
      decideStripeCheckoutDisposition({
        customerIds: ["cus_b", "cus_a", "cus_b"],
        subscriptions: [],
        preferredCustomerId: "cus_b"
      })
    ).toEqual({ action: "checkout", customerId: "cus_b" });
  });

  it("fails closed without a resolved customer", () => {
    expect(() => decideStripeCheckoutDisposition({ customerIds: [], subscriptions: [] })).toThrow(
      "stripe_customer_missing"
    );
  });

  it("recognizes only Stripe's explicit terminal and payment-recovery states", () => {
    expect(isTerminalStripeSubscriptionStatus("canceled")).toBe(true);
    expect(isTerminalStripeSubscriptionStatus("incomplete_expired")).toBe(true);
    expect(isTerminalStripeSubscriptionStatus("active")).toBe(false);
    expect(requiresStripePaymentRecovery("past_due")).toBe(true);
    expect(requiresStripePaymentRecovery("active")).toBe(false);
  });
});
