import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ensureStripeCustomer: vi.fn() }));

vi.mock("@/lib/billing/stripe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/stripe")>("@/lib/billing/stripe");
  return { ...actual, ensureStripeCustomer: (...args: unknown[]) => mocks.ensureStripeCustomer(...args) };
});

function stripeHarness(input: {
  searchPages?: Array<{ data: Array<{ id: string; metadata: Record<string, string> }>; next_page: string | null }>;
  listPages?: Array<{ data: Array<{ id: string; email: string; metadata: Record<string, string> }>; has_more: boolean }>;
  subscriptions?: Record<string, string[][]>;
}) {
  const search = vi.fn();
  const listCustomers = vi.fn();
  const listSubscriptions = vi.fn();

  for (const page of input.searchPages ?? [{ data: [], next_page: null }]) search.mockResolvedValueOnce(page);
  for (const page of input.listPages ?? [{ data: [], has_more: false }]) listCustomers.mockResolvedValueOnce(page);
  const subscriptionOffsets = new Map<string, number>();
  listSubscriptions.mockImplementation(async ({ customer }: { customer: string }) => {
    const offset = subscriptionOffsets.get(customer) ?? 0;
    subscriptionOffsets.set(customer, offset + 1);
    const pages = input.subscriptions?.[customer] ?? [[]];
    const statuses = pages[offset] ?? [];
    return {
      data: statuses.map((status, index) => ({ id: `sub_${customer}_${offset}_${index}`, status })),
      has_more: offset < pages.length - 1
    };
  });

  return {
    stripe: {
      customers: { search, list: listCustomers },
      subscriptions: { list: listSubscriptions }
    } as unknown as Stripe,
    search,
    listCustomers,
    listSubscriptions
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensureStripeCustomer.mockResolvedValue({ id: "cus_created" });
});

describe("Stripe subscription recovery I/O", () => {
  it("discovers a user-bound customer and routes a past-due subscription to the portal", async () => {
    const harness = stripeHarness({
      searchPages: [
        { data: [{ id: "cus_bound", metadata: { stockpilot_user_id: "user-1" } }], next_page: null }
      ],
      subscriptions: { cus_bound: [["past_due"]] }
    });
    const { resolveStripeCheckoutDisposition } = await import("./stripe-subscription-recovery");

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, {
        userId: "user-1",
        email: "owner@example.invalid"
      })
    ).resolves.toEqual({
      action: "portal",
      customerId: "cus_bound",
      statuses: ["past_due"],
      paymentRecoveryRequired: true
    });
    expect(mocks.ensureStripeCustomer).not.toHaveBeenCalled();
  });

  it("paginates customer search and subscription history", async () => {
    const harness = stripeHarness({
      searchPages: [
        { data: [], next_page: "page-2" },
        { data: [{ id: "cus_page2", metadata: { stockpilot_user_id: "user-1" } }], next_page: null }
      ],
      subscriptions: { cus_page2: [["canceled"], ["active"]] }
    });
    const { resolveStripeCheckoutDisposition } = await import("./stripe-subscription-recovery");

    const result = await resolveStripeCheckoutDisposition(harness.stripe, {
      userId: "user-1",
      email: null
    });
    expect(result.action).toBe("portal");
    expect(harness.search).toHaveBeenCalledTimes(2);
    expect(harness.listSubscriptions).toHaveBeenCalledTimes(2);
  });

  it("creates a customer only after exhaustive discovery and then checks its subscriptions", async () => {
    const harness = stripeHarness({ subscriptions: { cus_created: [["incomplete"]] } });
    const { resolveStripeCheckoutDisposition } = await import("./stripe-subscription-recovery");

    const result = await resolveStripeCheckoutDisposition(harness.stripe, {
      userId: "user-1",
      email: "owner@example.invalid"
    });
    expect(mocks.ensureStripeCustomer).toHaveBeenCalledWith(
      harness.stripe,
      "user-1",
      "owner@example.invalid"
    );
    expect(result.action).toBe("portal");
  });

  it("uses a known customer with terminal history for a new checkout", async () => {
    const harness = stripeHarness({ subscriptions: { cus_known: [["canceled", "incomplete_expired"]] } });
    const { resolveStripeCheckoutDisposition } = await import("./stripe-subscription-recovery");

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, {
        userId: "user-1",
        email: null,
        knownCustomerId: "cus_known"
      })
    ).resolves.toEqual({ action: "checkout", customerId: "cus_known" });
  });

  it("paginates email lookup and ignores customers owned by another user", async () => {
    const harness = stripeHarness({
      listPages: [
        {
          data: [
            { id: "cus_foreign", email: "owner@example.invalid", metadata: { stockpilot_user_id: "user-2" } }
          ],
          has_more: true
        },
        {
          data: [
            { id: "cus_email_bound", email: "owner@example.invalid", metadata: { stockpilot_user_id: "user-1" } }
          ],
          has_more: false
        }
      ],
      subscriptions: { cus_email_bound: [["canceled"]] }
    });
    const { resolveStripeCheckoutDisposition } = await import("./stripe-subscription-recovery");

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, {
        userId: "user-1",
        email: "owner@example.invalid"
      })
    ).resolves.toEqual({ action: "checkout", customerId: "cus_email_bound" });
    expect(harness.listCustomers).toHaveBeenCalledTimes(2);
  });

  it("returns an existing terminal customer for portal history", async () => {
    const harness = stripeHarness({ subscriptions: { cus_known: [["canceled"]] } });
    const { resolveStripePortalCustomer } = await import("./stripe-subscription-recovery");

    await expect(
      resolveStripePortalCustomer(harness.stripe, {
        userId: "user-1",
        email: null,
        knownCustomerId: "cus_known"
      })
    ).resolves.toBe("cus_known");
  });

  it("rejects an invalid customer id returned by Stripe customer creation", async () => {
    const harness = stripeHarness({});
    mocks.ensureStripeCustomer.mockResolvedValue({ id: "invalid" });
    const { resolveStripeCheckoutDisposition } = await import("./stripe-subscription-recovery");

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, {
        userId: "user-1",
        email: "owner@example.invalid"
      })
    ).rejects.toThrow("stripe_customer_missing");
  });

  it("caps discovered customer identities", async () => {
    const customers = Array.from({ length: 1_001 }, (_, index) => ({
      id: `cus_customer_${index}`,
      metadata: { stockpilot_user_id: "user-1" }
    }));
    const harness = stripeHarness({ searchPages: [{ data: customers, next_page: null }] });
    const { resolveStripeCheckoutDisposition, StripeSubscriptionRecoveryError } = await import(
      "./stripe-subscription-recovery"
    );

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, { userId: "user-1", email: null })
    ).rejects.toBeInstanceOf(StripeSubscriptionRecoveryError);
  });

  it("caps anomalously large subscription histories", async () => {
    const statuses = Array.from({ length: 2_001 }, () => "canceled");
    const harness = stripeHarness({ subscriptions: { cus_known: [statuses] } });
    const { resolveStripeCheckoutDisposition, StripeSubscriptionRecoveryError } = await import(
      "./stripe-subscription-recovery"
    );

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, {
        userId: "user-1",
        email: null,
        knownCustomerId: "cus_known"
      })
    ).rejects.toBeInstanceOf(StripeSubscriptionRecoveryError);
  });

  it("returns no portal customer for a user without a Stripe identity", async () => {
    const harness = stripeHarness({});
    const { resolveStripePortalCustomer } = await import("./stripe-subscription-recovery");

    await expect(
      resolveStripePortalCustomer(harness.stripe, { userId: "user-1", email: null })
    ).resolves.toBeNull();
    expect(mocks.ensureStripeCustomer).not.toHaveBeenCalled();
  });

  it("fails closed when non-terminal subscriptions span multiple customers", async () => {
    const harness = stripeHarness({
      searchPages: [
        {
          data: [
            { id: "cus_alpha", metadata: { stockpilot_user_id: "user-1" } },
            { id: "cus_beta", metadata: { stockpilot_user_id: "user-1" } }
          ],
          next_page: null
        }
      ],
      subscriptions: { cus_alpha: [["active"]], cus_beta: [["unpaid"]] }
    });
    const { resolveStripeCheckoutDisposition, resolveStripePortalCustomer } = await import(
      "./stripe-subscription-recovery"
    );

    await expect(
      resolveStripeCheckoutDisposition(harness.stripe, { userId: "user-1", email: null })
    ).resolves.toMatchObject({ action: "support", customerCount: 2 });
    const portalHarness = stripeHarness({
      searchPages: [
        {
          data: [
            { id: "cus_alpha", metadata: { stockpilot_user_id: "user-1" } },
            { id: "cus_beta", metadata: { stockpilot_user_id: "user-1" } }
          ],
          next_page: null
        }
      ],
      subscriptions: { cus_alpha: [["active"]], cus_beta: [["unpaid"]] }
    });
    await expect(resolveStripePortalCustomer(portalHarness.stripe, { userId: "user-1", email: null })).rejects.toThrow(
      "multiple_subscription_customers"
    );
  });
});
