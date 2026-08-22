import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  billingConfiguration: vi.fn(),
  billingEventMaybeSingle: vi.fn(),
  constructEvent: vi.fn(),
  entitlementMaybeSingle: vi.fn(),
  getAccountDeletionDisposition: vi.fn(),
  getUserById: vi.fn(),
  resolvePricePlan: vi.fn(),
  rpc: vi.fn(),
  stripeClient: vi.fn(),
  subscriptionsCancel: vi.fn(),
  subscriptionsRetrieve: vi.fn()
}));

vi.mock("@/lib/account-deletion", () => ({
  getAccountDeletionDisposition: (...args: unknown[]) => mocks.getAccountDeletionDisposition(...args),
  cancelStripeSubscriptionForDeletedAccount: async (_stripe: unknown, subscription: { id: string; status: string }) => {
    if (subscription.status === "canceled" || subscription.status === "incomplete_expired") return false;
    await mocks.subscriptionsCancel(subscription.id, { prorate: false });
    return true;
  }
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: () => mocks.stripeClient(),
  getStripeBillingConfiguration: () => mocks.billingConfiguration(),
  getPlanForStripePriceId: (priceId: string) => mocks.resolvePricePlan(priceId)
}));

function serviceFrom(table: string) {
  if (table === "billing_events") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.billingEventMaybeSingle }) }) })
    };
  }
  if (table === "entitlements") {
    return {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.entitlementMaybeSingle }) }) })
    };
  }
  throw new Error(`unexpected_table:${table}`);
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: serviceFrom,
    rpc: mocks.rpc,
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
    subscriptions: { retrieve: mocks.subscriptionsRetrieve, cancel: mocks.subscriptionsCancel }
  });
  mocks.billingConfiguration.mockReturnValue({ webhookSecret: "whsec_test_1234567890123456" });
  mocks.getAccountDeletionDisposition.mockResolvedValue(null);
  mocks.billingEventMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.entitlementMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.getUserById.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  mocks.resolvePricePlan.mockImplementation((priceId: string) => priceId === "price_pro123" ? "pro" : null);
  mocks.subscriptionsRetrieve.mockResolvedValue(subscriptionEvent().data.object);
  mocks.subscriptionsCancel.mockResolvedValue({ id: "sub_active123", status: "canceled" });
  mocks.rpc.mockImplementation((_name: string, args: Record<string, unknown>) => Promise.resolve({
    data: args.p_apply_entitlement
      ? { applied: true, duplicate: false, reason: null, stale: false }
      : {
          applied: false,
          duplicate: false,
          reason: args.p_ignore_reason ?? "event_not_applied",
          stale: false
        },
    error: null
  }));
});

describe("POST /api/billing/webhook atomic ordering", () => {
  it("persists a valid event and entitlement through one atomic RPC", async () => {
    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(true);
    expect(body.stale).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stripe_billing_event", expect.objectContaining({
      p_apply_entitlement: true,
      p_event_id: "evt_account_deletion_race",
      p_plan: "pro",
      p_provider_created_at: "2026-08-17T21:20:00.000Z",
      p_provider_subscription_id: "sub_active123",
      p_status: "active",
      p_user_id: USER_ID
    }));
  });

  it("does not recreate entitlements while account deletion is in progress", async () => {
    mocks.getAccountDeletionDisposition.mockResolvedValue("account_deletion_in_progress");

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(false);
    expect(body.skippedReason).toBe("account_deletion_in_progress");
    expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_active123", { prorate: false });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stripe_billing_event", expect.objectContaining({
      p_apply_entitlement: false,
      p_ignore_reason: "account_deletion_in_progress",
      p_user_id: USER_ID
    }));
  });

  it("pseudonymizes ledger ownership for an already deleted account", async () => {
    mocks.getAccountDeletionDisposition.mockResolvedValue("account_deleted");

    const { response } = await callWebhook();

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stripe_billing_event", expect.objectContaining({
      p_apply_entitlement: false,
      p_ignore_reason: "account_deleted",
      p_user_id: null
    }));
  });

  it("does not reference a missing auth user from immutable billing evidence", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404 } });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.skippedReason).toBe("account_missing");
    expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_active123", { prorate: false });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stripe_billing_event", expect.objectContaining({
      p_apply_entitlement: false,
      p_user_id: null
    }));
  });

  it("returns an idempotent response for an existing ledger event", async () => {
    mocks.billingEventMaybeSingle.mockResolvedValue({ data: { id: "existing-ledger-row" }, error: null });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("treats a duplicate detected atomically by the RPC as idempotent", async () => {
    mocks.rpc.mockResolvedValue({
      data: { applied: false, duplicate: true, reason: "duplicate_event", stale: false },
      error: null
    });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not apply a stale provider event", async () => {
    mocks.rpc.mockResolvedValue({
      data: { applied: false, duplicate: false, reason: "stale_event", stale: true },
      error: null
    });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(false);
    expect(body.skippedReason).toBe("stale_event");
    expect(body.stale).toBe(true);
  });

  it("rejects an invalid Stripe signature", async () => {
    mocks.constructEvent.mockImplementation(() => { throw new Error("invalid signature"); });

    const { response } = await callWebhook();

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns a safe retry response when the atomic RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "database_unavailable" } });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(503);
    expect(String(body.error)).not.toContain("database_unavailable");
  });

  it("returns a safe retry response for a malformed RPC result", async () => {
    mocks.rpc.mockResolvedValue({ data: { applied: "yes" }, error: null });

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
  });

  it("records unrelated verified Stripe events as ignored", async () => {
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
    expect(body.skippedReason).toBe("event_type_not_actionable");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stripe_billing_event", expect.objectContaining({
      p_apply_entitlement: false,
      p_ignore_reason: "event_type_not_actionable"
    }));
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

  it("fails closed when a present Stripe price is unknown", async () => {
    mocks.resolvePricePlan.mockReturnValue(null);

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
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
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("suppresses an event when deletion begins after the first lookup", async () => {
    mocks.getAccountDeletionDisposition
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("account_deletion_in_progress");

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.skippedReason).toBe("account_deletion_in_progress");
    expect(mocks.subscriptionsCancel).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_stripe_billing_event", expect.objectContaining({
      p_apply_entitlement: false
    }));
  });

  it("asks Stripe to retry when a late subscription cannot be cancelled", async () => {
    mocks.getAccountDeletionDisposition.mockResolvedValue("account_deleted");
    mocks.subscriptionsCancel.mockRejectedValue(new Error("stripe timeout"));

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the existing subscription mapping when Stripe metadata is missing", async () => {
    const event = subscriptionEvent();
    event.data.object.metadata = { stockpilot_user_id: "", stockpilot_plan: "pro" };
    mocks.constructEvent.mockReturnValue(event);
    mocks.entitlementMaybeSingle.mockResolvedValueOnce({ data: { user_id: USER_ID }, error: null });

    const { response, body } = await callWebhook();

    expect(response.status).toBe(200);
    expect(body.handled).toBe(true);
    expect(mocks.rpc).toHaveBeenCalled();
  });

  it("retries when an existing subscription mapping cannot be read", async () => {
    const event = subscriptionEvent();
    event.data.object.metadata = { stockpilot_user_id: "", stockpilot_plan: "pro" };
    mocks.constructEvent.mockReturnValue(event);
    mocks.entitlementMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: "database_unavailable" } });

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails safely when Supabase user lookup is unavailable", async () => {
    mocks.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 503 } });

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
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

  it("rejects an invalid provider timestamp before persistence", async () => {
    const event = subscriptionEvent();
    event.created = 0;
    mocks.constructEvent.mockReturnValue(event);

    const { response } = await callWebhook();

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
