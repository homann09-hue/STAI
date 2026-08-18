import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  getAccountDeletionDisposition: vi.fn(),
  billingEventMaybeSingle: vi.fn(),
  billingEventInsert: vi.fn(),
  entitlementMaybeSingle: vi.fn(),
  entitlementUpsert: vi.fn(),
  getUserById: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  stripeClient: vi.fn(),
  billingConfiguration: vi.fn()
}));

vi.mock("@/lib/account-deletion", () => ({
  getAccountDeletionDisposition: (...args: unknown[]) => mocks.getAccountDeletionDisposition(...args)
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: () => mocks.stripeClient(),
  getStripeBillingConfiguration: () => mocks.billingConfiguration(),
  getPlanForStripePriceId: () => "pro"
}));

function serviceFrom(table: string) {
  if (table === "billing_events") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.billingEventMaybeSingle }) }) }),
      insert: mocks.billingEventInsert
    };
  }
  if (table === "entitlements") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.entitlementMaybeSingle }) }) }),
      upsert: mocks.entitlementUpsert
    };
  }
  throw new Error(`unexpected_table:${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: serviceFrom,
    auth: { admin: { getUserById: mocks.getUserById } }
  })
}));

function subscriptionEvent() {
  return {
    id: "evt_account_deletion_race",
    type: "customer.subscription.updated",
    livemode: false,
    created: 1_787_001_600,
    data: {
      object: {
        id: "sub_active123",
        customer: "cus_existing123",
        status: "active",
        metadata: { stockpilot_user_id: USER_ID, stockpilot_plan: "pro" },
        trial_end: null,
        cancel_at_period_end: false,
        items: {
          data: [{ current_period_end: 1_789_593_600, price: { id: "price_pro123" } }]
        }
      }
    }
  };
}

async function callWebhook(input: { signature?: string | null; body?: string; contentLength?: string } = {}) {
  const { POST } = await import("./route");
  const headers = new Headers({ "content-type": "application/json" });
  const signature = input.signature === undefined ? "verified-signature" : input.signature;
  if (signature) headers.set("stripe-signature", signature);
  if (input.contentLength) headers.set("content-length", input.contentLength);
  const response = await POST(new Request("https://stockpilot.test/api/billing/webhook", {
    method: "POST",
    headers,
    body: input.body ?? "{}"
  }));
  return { response, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.constructEvent.mockReturnValue(subscriptionEvent());
  mocks.stripeClient.mockReturnValue({
    webhooks: { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve }
  });
  mocks.billingConfiguration.mockReturnValue({ webhookSecret: "whsec_test_1234567890123456" });
  mocks.getAccountDeletionDisposition.mockResolvedValue(null);
  mocks.billingEventMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.billingEventInsert.mockResolvedValue({ error: null });
  mocks.entitlementMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.entitlementUpsert.mockResolvedValue({ error: null });
  mocks.getUserById.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mocks.subscriptionsRetrieve.mockResolvedValue(subscriptionEvent().data.object);
});

describe("POST /api/billing/webhook account-deletion races", () => {
  it("does not recreate entitlements while account deletion is in progress", async () => {
    mocks.getAccountDeletionDisposition.mockResolvedValue("account_deletion_in_progress");

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(false);
    expect(body.skippedReason).toBe("account_deletion_in_progress");
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled();
    expect(mocks.billingEventInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "ignored" }));
  });

  it("does not recreate entitlements for an already deleted user", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404 } });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(false);
    expect(body.skippedReason).toBe("account_missing");
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled();
  });

  it("still applies a valid event for an existing account", async () => {
    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(true);
    expect(body.skippedReason).toBeNull();
    expect(mocks.entitlementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, provider_subscription_id: "sub_active123" }),
      { onConflict: "user_id,provider" }
    );
    expect(mocks.billingEventInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "processed" }));
  });

  it("returns an idempotent response for a duplicate event", async () => {
    mocks.billingEventMaybeSingle.mockResolvedValue({ data: { id: "existing-ledger-row" }, error: null });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(mocks.billingEventInsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid Stripe signature", async () => {
    mocks.constructEvent.mockImplementation(() => { throw new Error("invalid signature"); });

    const { response } = await callWebhook();

    expect(response.status).toBe(400);
    expect(mocks.billingEventInsert).not.toHaveBeenCalled();
  });

  it("returns a safe retry response when entitlement persistence fails", async () => {
    mocks.entitlementUpsert.mockResolvedValue({ error: { code: "database_unavailable" } });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(503);
    expect(String(body.error)).not.toContain("database_unavailable");
  });

  it("records unrelated Stripe events as ignored", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_unrelated",
      type: "customer.created",
      livemode: false,
      created: 1_787_001_600,
      data: { object: {} }
    });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(false);
    expect(mocks.billingEventInsert).toHaveBeenCalledWith(expect.objectContaining({ status: "ignored" }));
  });

  it("processes checkout completion through the retrieved subscription", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_checkout",
      type: "checkout.session.completed",
      livemode: false,
      created: 1_787_001_600,
      data: { object: { subscription: "sub_active123" } }
    });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(true);
    expect(mocks.subscriptionsRetrieve).toHaveBeenCalledWith("sub_active123", { expand: ["items.data.price"] });
  });

  it("fails closed when the webhook is not configured", async () => {
    mocks.stripeClient.mockReturnValue(null);

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing signature and an oversized declared body", async () => {
    const missingSignature = await callWebhook({ signature: null });
    expect(missingSignature.response.status).toBe(400);

    const oversized = await callWebhook({ contentLength: "300000" });
    expect(oversized.response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("fails closed when duplicate detection is unavailable", async () => {
    mocks.billingEventMaybeSingle.mockResolvedValue({ data: null, error: { code: "database_unavailable" } });

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled();
  });

  it("suppresses an event when deletion begins after the first lookup", async () => {
    mocks.getAccountDeletionDisposition
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("account_deletion_in_progress");

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.skippedReason).toBe("account_deletion_in_progress");
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled();
  });

  it("uses the existing subscription mapping when Stripe metadata is missing", async () => {
    const event = subscriptionEvent();
    event.data.object.metadata = { stockpilot_user_id: "", stockpilot_plan: "pro" };
    mocks.constructEvent.mockReturnValue(event);
    mocks.entitlementMaybeSingle.mockResolvedValueOnce({ data: { user_id: USER_ID }, error: null });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(true);
    expect(mocks.entitlementUpsert).toHaveBeenCalled();
  });

  it("fails safely when Supabase user lookup is unavailable", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 503 } });

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.entitlementUpsert).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate ledger insert as idempotent", async () => {
    mocks.billingEventInsert.mockResolvedValue({ error: { code: "23505" } });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(true);
  });

  it("rejects checkout completion without a subscription", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_checkout_missing_subscription",
      type: "checkout.session.completed",
      livemode: false,
      created: 1_787_001_600,
      data: { object: { subscription: null } }
    });

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled();
  });
});
