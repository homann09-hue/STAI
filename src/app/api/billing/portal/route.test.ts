import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  getSupabaseAuth: vi.fn(),
  getUserEntitlements: vi.fn(),
  resolveStripePortalCustomer: vi.fn(),
  portalCreate: vi.fn(),
  portalConfigurationId: "bpc_test123" as string | null,
  appOrigin: "https://stockpilot.test" as string | null
}));

vi.mock("@/lib/supabase/user-data", () => ({
  getSupabaseAuth: (...args: unknown[]) => mocks.getSupabaseAuth(...args)
}));
vi.mock("@/lib/billing/server", () => ({
  getUserEntitlements: (...args: unknown[]) => mocks.getUserEntitlements(...args)
}));
vi.mock("@/lib/billing/stripe-subscription-recovery", () => ({
  resolveStripePortalCustomer: (...args: unknown[]) => mocks.resolveStripePortalCustomer(...args)
}));
vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: () => ({ billingPortal: { sessions: { create: mocks.portalCreate } } }),
  getStripeBillingConfiguration: () => ({ portalConfigurationId: mocks.portalConfigurationId }),
  getTrustedBillingOrigin: () => mocks.appOrigin
}));

function request(body = "{}", origin = "https://stockpilot.test") {
  return new Request("https://stockpilot.test/api/billing/portal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "x-real-ip": `10.8.0.${Math.floor(Math.random() * 200) + 1}`
    },
    body
  });
}

async function callRoute(body?: string, origin?: string) {
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
    providerCustomerId: "cus_known123"
  });
  mocks.resolveStripePortalCustomer.mockResolvedValue("cus_recovered123");
  mocks.portalCreate.mockResolvedValue({ url: "https://billing.stripe.com/session" });
  mocks.portalConfigurationId = "bpc_test123";
  mocks.appOrigin = "https://stockpilot.test";
});

describe("POST /api/billing/portal", () => {
  it("resolves the Stripe customer independently from active entitlement status", async () => {
    const { response, body } = await callRoute();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://billing.stripe.com/session");
    expect(mocks.resolveStripePortalCustomer).toHaveBeenCalledWith(expect.anything(), {
      userId: USER_ID,
      email: "owner@example.invalid",
      knownCustomerId: "cus_known123"
    });
    expect(mocks.portalCreate).toHaveBeenCalledWith({
      customer: "cus_recovered123",
      return_url: "https://stockpilot.test/pricing",
      configuration: "bpc_test123"
    });
  });

  it("fails closed when entitlement storage is degraded", async () => {
    mocks.getUserEntitlements.mockResolvedValue({ degraded: true, providerCustomerId: null });

    const { response } = await callRoute();

    expect(response.status).toBe(503);
    expect(mocks.resolveStripePortalCustomer).not.toHaveBeenCalled();
  });

  it("does not create a portal session without a verified customer", async () => {
    mocks.resolveStripePortalCustomer.mockResolvedValue(null);

    const { response } = await callRoute();

    expect(response.status).toBe(409);
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("does not guess when Stripe customer discovery fails", async () => {
    mocks.resolveStripePortalCustomer.mockRejectedValue(new Error("stripe unavailable"));

    const { response } = await callRoute();

    expect(response.status).toBe(502);
    expect(mocks.portalCreate).not.toHaveBeenCalled();
  });

  it("requires authentication before Stripe is called", async () => {
    mocks.getSupabaseAuth.mockResolvedValue({ ok: false, reason: "missing_bearer" });

    const { response } = await callRoute();

    expect(response.status).toBe(401);
    expect(mocks.resolveStripePortalCustomer).not.toHaveBeenCalled();
  });

  it("rejects cross-origin and non-empty portal requests before customer discovery", async () => {
    expect((await callRoute("{}", "https://evil.invalid")).response.status).toBe(403);
    expect((await callRoute('{"unexpected":true}')).response.status).toBe(400);
    expect(mocks.resolveStripePortalCustomer).not.toHaveBeenCalled();
  });

  it("opens the portal without an optional Stripe portal configuration", async () => {
    mocks.portalConfigurationId = null;

    const { response } = await callRoute();

    expect(response.status).toBe(200);
    expect(mocks.portalCreate).toHaveBeenCalledWith({
      customer: "cus_recovered123",
      return_url: "https://stockpilot.test/pricing"
    });
  });
});
