import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getSupabaseAuth: vi.fn(),
  getUserEntitlements: vi.fn(),
  getAccountDeletionDisposition: vi.fn(),
  ensureStripeCustomer: vi.fn(),
  sessionCreate: vi.fn(),
  sessionExpire: vi.fn()
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
  getStripeClient: () => ({ checkout: { sessions: { create: mocks.sessionCreate, expire: mocks.sessionExpire } } }),
  getStripeBillingConfiguration: () => ({ webhookSecret: "whsec_test_1234567890123456" }),
  getStripePriceId: () => "price_pro123",
  getTrustedBillingOrigin: () => "https://stockpilot.test",
  ensureStripeCustomer: (...args: unknown[]) => mocks.ensureStripeCustomer(...args)
}));

function request() {
  return new Request("https://stockpilot.test/api/billing/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://stockpilot.test",
      "x-real-ip": `10.9.0.${Math.floor(Math.random() * 200) + 1}`
    },
    body: JSON.stringify({ plan: "pro", interval: "month" })
  });
}

async function callRoute() {
  const { POST } = await import("./route");
  const response = await POST(request());
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
    providerCustomerId: null
  });
  mocks.getAccountDeletionDisposition.mockResolvedValue(null);
  mocks.ensureStripeCustomer.mockResolvedValue({ id: "cus_owner123" });
  mocks.sessionCreate.mockResolvedValue({ id: "cs_owner123", url: "https://checkout.stripe.test/session" });
  mocks.sessionExpire.mockResolvedValue({ id: "cs_owner123", status: "expired" });
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
    expect(mocks.ensureStripeCustomer).toHaveBeenCalledWith(expect.anything(), USER_ID, "owner@example.invalid");
    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_owner123" }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining(USER_ID) })
    );
  });

  it("fails closed when deletion state cannot be verified", async () => {
    mocks.getAccountDeletionDisposition.mockRejectedValue(new Error("database unavailable"));

    const { response } = await callRoute();

    expect(response.status).toBe(503);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });
});
