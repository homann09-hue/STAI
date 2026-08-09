import { describe, expect, it } from "vitest";
import { isAllowedStripeRedirect } from "@/lib/billing/client";

describe("billing redirect validation", () => {
  it("accepts only official HTTPS Checkout and Portal origins", () => {
    expect(isAllowedStripeRedirect("https://checkout.stripe.com/c/pay/test")).toBe(true);
    expect(isAllowedStripeRedirect("https://billing.stripe.com/p/session/test")).toBe(true);
    expect(isAllowedStripeRedirect("http://checkout.stripe.com/c/pay/test")).toBe(false);
    expect(isAllowedStripeRedirect("https://checkout.stripe.com.evil.test/c/pay/test")).toBe(false);
    expect(isAllowedStripeRedirect("javascript:alert(1)")).toBe(false);
  });
});
