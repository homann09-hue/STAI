import { describe, expect, it } from "vitest";
import {
  assertSafeStripeTestmodeEnvironment,
  assertStripePortalUrl,
  buildSignedWebhookPayload,
  extractTestCheckoutSessionId
} from "./stripe-testmode-e2e-lib.mjs";

const safeEnvironment = {
  STRIPE_TESTMODE_E2E_SECRET_KEY: "sk_test_example",
  STRIPE_TESTMODE_E2E_APP_URL: "http://127.0.0.1:3012",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_SERVICE_ROLE_KEY: "local-service-role",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-anon"
};

describe("Stripe testmode E2E safety contract", () => {
  it("accepts only local testmode infrastructure", () => {
    const result = assertSafeStripeTestmodeEnvironment(safeEnvironment);
    expect(result.appUrl).toBe("http://127.0.0.1:3012");
    expect(result.supabaseUrl).toBe("http://127.0.0.1:54321");
    expect(result.webhookSecret).toMatch(/^whsec_/);
  });

  it.each(["sk_test_example", "rk_test_example", "rkcs_test_example"])(
    "accepts supported Stripe testmode secret key %s",
    (secretKey) => {
      expect(
        assertSafeStripeTestmodeEnvironment({
          ...safeEnvironment,
          STRIPE_TESTMODE_E2E_SECRET_KEY: secretKey
        }).secretKey
      ).toBe(secretKey);
    }
  );

  it.each([
    { ...safeEnvironment, STRIPE_TESTMODE_E2E_SECRET_KEY: "sk_live_forbidden" },
    { ...safeEnvironment, STRIPE_TESTMODE_E2E_SECRET_KEY: "rk_live_forbidden" },
    { ...safeEnvironment, STRIPE_TESTMODE_E2E_SECRET_KEY: "rkcs_live_forbidden" },
    { ...safeEnvironment, STRIPE_TESTMODE_E2E_SECRET_KEY: "pk_test_not_a_secret" },
    { ...safeEnvironment, STRIPE_TESTMODE_E2E_SECRET_KEY: "rkcs_other_forbidden" },
    { ...safeEnvironment, STRIPE_TESTMODE_E2E_APP_URL: "https://stockpilot.example" },
    { ...safeEnvironment, SUPABASE_URL: "https://production.supabase.co" }
  ])("rejects live or remote targets", (environment) => {
    expect(() => assertSafeStripeTestmodeEnvironment(environment)).toThrow();
  });

  it("accepts only Stripe testmode Checkout and Portal URLs", () => {
    expect(extractTestCheckoutSessionId("https://checkout.stripe.com/c/pay/cs_test_abc123")).toBe(
      "cs_test_abc123"
    );
    expect(assertStripePortalUrl("https://billing.stripe.com/p/session/test_abc")).toContain(
      "billing.stripe.com"
    );
    expect(() => extractTestCheckoutSessionId("https://checkout.stripe.com/c/pay/cs_live_abc123")).toThrow();
    expect(() => assertStripePortalUrl("https://example.com/portal")).toThrow();
  });

  it("refuses livemode objects in generated webhook payloads", () => {
    expect(() =>
      buildSignedWebhookPayload({
        eventId: "evt_test_1",
        created: 1_787_300_000,
        object: { id: "sub_live", livemode: true },
        type: "customer.subscription.updated"
      })
    ).toThrow(/testmode/);

    const payload = buildSignedWebhookPayload({
      eventId: "evt_test_2",
      created: 1_787_300_001,
      object: { id: "sub_test", livemode: false },
      type: "customer.subscription.updated"
    });
    expect(JSON.parse(payload)).toMatchObject({ id: "evt_test_2", livemode: false });
  });
});
