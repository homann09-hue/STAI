import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getSupabaseAuth: vi.fn(),
  getUserEntitlements: vi.fn(),
  getAccountDeletionDisposition: vi.fn(),
  resolveStripeCheckoutDisposition: vi.fn(),
  sessionCreate: vi.fn(),
  sessionExpire: vi.fn(),
  portalCreate: vi.fn(),
  configuration: { webhookSecret: "whsec_test_1234567890123456", portalConfigurationId: "bpc_test123" } as {
    webhookSecret: string | null;
    portalConfigurationId: string | null;
  },
  priceId: "price_pro123" as string | null,
  appOrigin: "https://stockpilot.test" as string | null
}));

vi.mock("@/lib/supabase/user-data", () => ({
  getSupabaseAuth: (request: Request) => mocks.getSupabaseAuth(request)
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({ from: vi.fn() })
}));

vi.mock("@/lib/account-deletion", () => ({
  getAccountDeletionDisposition: (...args: unknown[]) => mocks.getAccountDeletionDisposition(...args)
}));

vi.mock("@/lib/billing/server", () => ({
  getUserEntitlements: (...args: unknown[]) => mocks.getUserEntitlements(...args)
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: mocks.sessionCreate, expire: mocks.sessionExpire } },
    billingPortal: { sessions: { create: mocks.portalCreate } }
  }),
  getStripeBillingConfiguration: () => mocks.configuration,
  getStripePriceId: () => mocks.priceId,
  getTrustedBillingOrigin: () => mocks.appOrigin
}));

vi.mock("@/lib/billing/stripe-subscription-recovery", () => ({
  resolveStripeCheckoutDisposition: (...args: unknown[]) => mocks.resolveStripeCheckoutDisposition(...args)
}));

function request(body: unknown = { plan: "pro", interval: "month" }, origin = "https://stockpilot.test") {
  return new Request("https://stockpilot.test/api/billing/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "x-real-ip": `10.9.0.${Math.floor(Math.random() * 200) + 1}`
    },
    body: JSON.stringify(body)
  });
}

async function callRoute(body?: unknown, origin?: string) {
  const { POST } = await import("./route");
  const response = await POST(request(body, origin));
  return { response, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.getSupabaseAuth.mockResolvedValue({
    ok: true,
    userId: USER_ID,
    email: "owner@example.invalid",
    supabase: {}
  });
  mocks.getUserEntitlements.mockResolvedValue({
    degraded: false,
    billingActive: false,
    provider: "none",
    providerCustomerId: null
  });
  mocks.getAccountDeletionDisposition.mockResolvedValue(null);
  mocks.resolveStripeCheckoutDisposition.mockResolvedValue({ action: "checkout", customerId: "cus_owner123" });
  mocks.sessionCreate.mockResolvedValue({ id: "cs_owner123", url: "https://checkout.stripe.test/session" });
  mocks.sessionExpire.mockResolvedValue({ id: "cs_owner123", status: "expired" });
  mocks.portalCreate.mockResolvedValue({ url: "https://billing.stripe.com/session" });
  mocks.configuration = { webhookSecret: "whsec_test_1234567890123456", portalConfigurationId: "bpc_test123" };
  mocks.priceId = "price_pro123";
  mocks.appOrigin = "https://stockpilot.test";
});

describe("POST /api/billing/checkout deletion races", () => {
  it("blocks checkout before Stripe is called when account deletion exists", async () => {
    mocks.getAccountDeletionDisposition.mockResolvedValue("account_deletion_in_progress");

    const { response } = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("expires a newly created session when deletion begins concurrently", async () => {
    mocks.getAccountDeletionDisposition
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("account_deletion_in_progress");

    const { response } = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.sessionExpire).toHaveBeenCalledWith("cs_owner123");
  });

  it("creates checkout with an explicitly user-bound Stripe customer", async () => {
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.test/session");
    expect(mocks.resolveStripeCheckoutDisposition).toHaveBeenCalledWith(expect.anything(), {
      userId: USER_ID,
      email: "owner@example.invalid",
      knownCustomerId: null
    });
    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_owner123" }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining(USER_ID) })
    );
  });

  it.each(["active", "past_due", "unpaid", "incomplete", "paused"])(
    "redirects an existing %s subscription to the portal without creating checkout",
    async (status) => {
      mocks.resolveStripeCheckoutDisposition.mockResolvedValue({
        action: "portal",
        customerId: "cus_owner123",
        statuses: [status],
        paymentRecoveryRequired: status !== "active"
      });

      const { response, body } = await callRoute();

      expect(response.status).toBe(200);
      expect(body.action).toBe("portal");
      expect(body.url).toBe("https://billing.stripe.com/session");
      expect(mocks.portalCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_owner123" })
      );
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
    }
  );

  it("blocks checkout when subscriptions span multiple Stripe customers", async () => {
    mocks.resolveStripeCheckoutDisposition.mockResolvedValue({
      action: "support",
      customerCount: 2,
      statuses: ["past_due", "active"]
    });

    const { response } = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("fails closed when Stripe subscription state cannot be verified", async () => {
    mocks.resolveStripeCheckoutDisposition.mockRejectedValue(new Error("stripe timeout"));

    const { response } = await callRoute();

    expect(response.status).toBe(502);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("fails closed when deletion state cannot be verified", async () => {
    mocks.getAccountDeletionDisposition.mockRejectedValue(new Error("database unavailable"));

    const { response } = await callRoute();

    expect(response.status).toBe(503);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated, cross-origin and invalid checkout requests before Stripe", async () => {
    mocks.getSupabaseAuth.mockResolvedValueOnce({ ok: false, reason: "missing_bearer" });
    expect((await callRoute()).response.status).toBe(401);
    expect((await callRoute({ plan: "pro" }, "https://evil.invalid")).response.status).toBe(403);
    expect((await callRoute({ plan: "enterprise" })).response.status).toBe(400);
    expect(mocks.resolveStripeCheckoutDisposition).not.toHaveBeenCalled();
  });

  it("fails closed for degraded entitlement storage or incomplete billing configuration", async () => {
    mocks.getUserEntitlements.mockResolvedValueOnce({ degraded: true });
    expect((await callRoute()).response.status).toBe(503);

    mocks.priceId = null;
    expect((await callRoute()).response.status).toBe(503);
    expect(mocks.resolveStripeCheckoutDisposition).not.toHaveBeenCalled();
  });

  it("creates a recovery portal without an optional portal configuration", async () => {
    mocks.configuration.portalConfigurationId = null;
    mocks.resolveStripeCheckoutDisposition.mockResolvedValue({
      action: "portal",
      customerId: "cus_owner123",
      statuses: ["past_due"],
      paymentRecoveryRequired: true
    });

    const { response } = await callRoute();

    expect(response.status).toBe(200);
    expect(mocks.portalCreate).toHaveBeenCalledWith({
      customer: "cus_owner123",
      return_url: "https://stockpilot.test/account/billing"
    });
  });

  it("rejects a Stripe checkout session without a safe continuation URL", async () => {
    mocks.sessionCreate.mockResolvedValue({ id: "cs_owner123", url: null });

    const { response } = await callRoute();

    expect(response.status).toBe(502);
  });

  it("does not sell a second subscription over an active manual entitlement", async () => {
    mocks.getUserEntitlements.mockResolvedValue({
      degraded: false,
      billingActive: true,
      provider: "manual",
      providerCustomerId: null
    });

    const { response } = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.resolveStripeCheckoutDisposition).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
});
