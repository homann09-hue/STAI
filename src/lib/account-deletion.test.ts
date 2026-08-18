import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  getStripeClient: vi.fn(),
  deleteUserAccount: vi.fn(),
  customersList: vi.fn(),
  subscriptionsList: vi.fn(),
  subscriptionsCancel: vi.fn(),
  entitlementMaybeSingle: vi.fn(),
  entitlementUpdateResult: vi.fn(),
  getUserById: vi.fn(),
  adminDeleteUser: vi.fn(),
  createServiceClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => mocks.createServiceClient()
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: () => mocks.getStripeClient(),
  isValidEmail: (value: unknown) => typeof value === "string" && value.includes("@")
}));

vi.mock("@/lib/supabase/user-data", () => ({
  deleteUserAccount: (auth: unknown) => mocks.deleteUserAccount(auth)
}));

const auth = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.invalid",
  accessToken: "verified-access-token",
  supabase: {}
};

function entitlementQuery() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mocks.entitlementMaybeSingle }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ eq: mocks.entitlementUpdateResult }))
    }))
  };
}

function stripeClient() {
  return {
    customers: { list: mocks.customersList },
    subscriptions: { list: mocks.subscriptionsList, cancel: mocks.subscriptionsCancel }
  };
}

function serviceClient() {
  return {
    rpc: mocks.rpc,
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById, deleteUser: mocks.adminDeleteUser } }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServiceClient.mockReturnValue(serviceClient());
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "claim_account_deletion") {
      return { data: [{ job_id: "22222222-2222-4222-8222-222222222222", job_status: "requested", claimed: true }], error: null };
    }
    if (name === "record_account_deletion_step") return { data: true, error: null };
    return { data: null, error: null };
  });
  mocks.from.mockImplementation((table: string) => {
    if (table === "entitlements") return entitlementQuery();
    throw new Error(`unexpected_table:${table}`);
  });
  mocks.entitlementMaybeSingle.mockResolvedValue({ data: { provider_customer_id: "cus_existing123" }, error: null });
  mocks.entitlementUpdateResult.mockResolvedValue({ error: null });
  mocks.customersList.mockResolvedValue({
    data: [{ id: "cus_existing123", metadata: { stockpilot_user_id: auth.userId } }],
    has_more: false
  });
  mocks.subscriptionsList.mockResolvedValue({
    data: [
      { id: "sub_active123", status: "active" },
      { id: "sub_closed123", status: "canceled" }
    ],
    has_more: false
  });
  mocks.subscriptionsCancel.mockResolvedValue({ id: "sub_active123", status: "canceled" });
  mocks.getStripeClient.mockReturnValue(stripeClient());
  mocks.deleteUserAccount.mockResolvedValue(undefined);
  mocks.getUserById.mockResolvedValue({ data: { user: null }, error: { status: 404 } });
  mocks.adminDeleteUser.mockResolvedValue({ error: null });
});

describe("runAccountDeletion", () => {
  it("cancels every nonterminal subscription before deleting the identity", async () => {
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    const result = await runAccountDeletion(auth as never);

    expect(result.deleted).toBe(true);
    expect(mocks.subscriptionsCancel).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptionsCancel).toHaveBeenCalledWith("sub_active123", { prorate: false });
    expect(mocks.deleteUserAccount).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptionsCancel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteUserAccount.mock.invocationCallOrder[0]
    );
    const recordedStatuses = mocks.rpc.mock.calls
      .filter(([name]) => name === "record_account_deletion_step")
      .map(([, payload]) => payload.p_status);
    expect(recordedStatuses).toEqual(["cancelling_subscriptions", "deleting_identity", "completed"]);
  });

  it("keeps the identity when Stripe times out and records a retryable failure", async () => {
    mocks.subscriptionsList.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    const { AccountDeletionError, runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toBeInstanceOf(AccountDeletionError);

    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
    expect(mocks.entitlementUpdateResult).not.toHaveBeenCalled();
    const failure = mocks.rpc.mock.calls.find(
      ([name, payload]) => name === "record_account_deletion_step" && payload.p_event_type === "deletion_failed"
    );
    expect(failure?.[1]).toMatchObject({ p_status: "failed", p_error_code: "ETIMEDOUT" });
  });

  it("can safely retry after a transient Stripe failure", async () => {
    mocks.subscriptionsList
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))
      .mockResolvedValue({ data: [{ id: "sub_active123", status: "active" }], has_more: false });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toThrow();
    await expect(runAccountDeletion(auth as never)).resolves.toMatchObject({ deleted: true });

    expect(mocks.deleteUserAccount).toHaveBeenCalledTimes(1);
    expect(mocks.subscriptionsCancel).toHaveBeenCalledTimes(1);
  });

  it("rejects a duplicate request while another worker owns the lease", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ job_id: "22222222-2222-4222-8222-222222222222", job_status: "cancelling_subscriptions", claimed: false }],
      error: null
    });
    const { AccountDeletionError, runAccountDeletion } = await import("@/lib/account-deletion");

    const request = runAccountDeletion(auth as never);
    await expect(request).rejects.toBeInstanceOf(AccountDeletionError);
    await expect(request).rejects.toMatchObject({ code: "already_running", status: 409 });
    expect(mocks.customersList).not.toHaveBeenCalled();
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("fails closed when a Stripe entitlement has no usable customer mapping", async () => {
    mocks.entitlementMaybeSingle.mockResolvedValue({ data: { provider_customer_id: null }, error: null });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "billing_mapping_incomplete", status: 503 });
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("deletes a never-billed free account even when Stripe is not configured", async () => {
    mocks.getStripeClient.mockReturnValue(null);
    mocks.entitlementMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).resolves.toMatchObject({ deleted: true });
    expect(mocks.subscriptionsList).not.toHaveBeenCalled();
    expect(mocks.deleteUserAccount).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the service database is unavailable", async () => {
    mocks.createServiceClient.mockReturnValue(null);
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "configuration_missing" });
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("fails closed when the deletion claim cannot be persisted", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "database_unavailable" } });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "persistence_failed" });
    expect(mocks.customersList).not.toHaveBeenCalled();
  });

  it("fails closed when entitlement lookup is unavailable", async () => {
    mocks.entitlementMaybeSingle.mockResolvedValue({ data: null, error: { code: "database_unavailable" } });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "persistence_failed" });
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("does not delete a billed account when Stripe is not configured", async () => {
    mocks.getStripeClient.mockReturnValue(null);
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "configuration_missing" });
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });

  it("paginates subscriptions and tolerates an idempotent resource-missing cancellation", async () => {
    mocks.subscriptionsList
      .mockResolvedValueOnce({ data: [{ id: "sub_gone123", status: "active" }], has_more: true })
      .mockResolvedValueOnce({ data: [{ id: "sub_second123", status: "past_due" }], has_more: false });
    mocks.subscriptionsCancel
      .mockRejectedValueOnce({ code: "resource_missing" })
      .mockResolvedValueOnce({ id: "sub_second123", status: "canceled" });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).resolves.toMatchObject({ deleted: true });
    expect(mocks.subscriptionsList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ starting_after: "sub_gone123" })
    );
    expect(mocks.subscriptionsCancel).toHaveBeenCalledTimes(2);
  });

  it("paginates Stripe customers before deciding that discovery is complete", async () => {
    mocks.entitlementMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.customersList
      .mockResolvedValueOnce({
        data: [{ id: "cus_unrelated123", metadata: { stockpilot_user_id: "99999999-9999-4999-8999-999999999999" } }],
        has_more: true
      })
      .mockResolvedValueOnce({
        data: [{ id: "cus_existing123", metadata: { stockpilot_user_id: auth.userId } }],
        has_more: false
      });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).resolves.toMatchObject({ deleted: true });
    expect(mocks.customersList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ starting_after: "cus_unrelated123" })
    );
  });

  it("keeps the recovery stage when identity deletion fails after Stripe cancellation", async () => {
    mocks.deleteUserAccount.mockRejectedValueOnce(new Error("identity provider unavailable"));
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "provider_failed" });
    const finalRecord = mocks.rpc.mock.calls
      .filter(([name]) => name === "record_account_deletion_step")
      .at(-1)?.[1];
    expect(finalRecord).toMatchObject({ p_status: "deleting_identity", p_event_type: "deletion_failed" });
  });

  it("reports a transition persistence failure without deleting the identity", async () => {
    let recordCalls = 0;
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "claim_account_deletion") {
        return { data: [{ job_id: "22222222-2222-4222-8222-222222222222", job_status: "requested", claimed: true }], error: null };
      }
      recordCalls += 1;
      return recordCalls === 1 ? { data: false, error: null } : { data: true, error: null };
    });
    const { runAccountDeletion } = await import("@/lib/account-deletion");

    await expect(runAccountDeletion(auth as never)).rejects.toMatchObject({ code: "persistence_failed" });
    expect(mocks.deleteUserAccount).not.toHaveBeenCalled();
  });
});

describe("account deletion webhook disposition", () => {
  it("recognizes an in-progress deletion by user id", async () => {
    const service = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "deleting_identity" }, error: null }) }) })
      })
    } as never;
    const { getAccountDeletionDisposition } = await import("@/lib/account-deletion");

    await expect(
      getAccountDeletionDisposition(service, { userId: "11111111-1111-4111-8111-111111111111" })
    ).resolves.toBe("account_deletion_in_progress");
  });

  it("recognizes a completed tombstone by Stripe customer id", async () => {
    const service = {
      from: () => ({
        select: () => ({
          contains: () => ({
            order: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: { status: "completed" }, error: null }) })
            })
          })
        })
      })
    } as never;
    const { getAccountDeletionDisposition } = await import("@/lib/account-deletion");

    await expect(
      getAccountDeletionDisposition(service, { customerId: "cus_existing123" })
    ).resolves.toBe("account_deleted");
  });

  it("does not suppress webhooks for a failed deletion", async () => {
    const service = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { status: "failed" }, error: null }) }) })
      })
    } as never;
    const { getAccountDeletionDisposition } = await import("@/lib/account-deletion");

    await expect(
      getAccountDeletionDisposition(service, { userId: "11111111-1111-4111-8111-111111111111" })
    ).resolves.toBeNull();
  });
});

describe("reconcileAccountDeletionJobs", () => {
  it("finishes a leased identity deletion after the original request crashed", async () => {
    const jobsQuery = {
      delete: () => ({ eq: () => ({ lte: async () => ({ count: 0, error: null }) }) }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: [{ id: "22222222-2222-4222-8222-222222222222", status: "deleting_identity", lease_expires_at: null }],
              error: null
            })
          })
        })
      })
    };
    mocks.from.mockImplementation((table: string) => {
      if (table === "account_deletion_jobs") return jobsQuery;
      throw new Error(`unexpected_table:${table}`);
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "claim_account_deletion_recovery") {
        return {
          data: [{
            job_id: "22222222-2222-4222-8222-222222222222",
            subject_user_id: "11111111-1111-4111-8111-111111111111",
            claimed: true
          }],
          error: null
        };
      }
      return { data: true, error: null };
    });
    mocks.getUserById.mockResolvedValue({ data: { user: { id: auth.userId } }, error: null });
    const { reconcileAccountDeletionJobs } = await import("@/lib/account-deletion");

    await expect(reconcileAccountDeletionJobs()).resolves.toEqual({ inspected: 1, completed: 1, skipped: 0, failed: 0, purged: 0 });
    expect(mocks.adminDeleteUser).toHaveBeenCalledWith(auth.userId);
  });

  it("skips an active lease and an unclaimable recovery job", async () => {
    const jobsQuery = {
      delete: () => ({ eq: () => ({ lte: async () => ({ count: 0, error: null }) }) }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: [
                { id: "22222222-2222-4222-8222-222222222222", status: "deleting_identity", lease_expires_at: new Date(Date.now() + 60_000).toISOString() },
                { id: "33333333-3333-4333-8333-333333333333", status: "deleting_identity", lease_expires_at: null }
              ],
              error: null
            })
          })
        })
      })
    };
    mocks.from.mockReturnValue(jobsQuery);
    mocks.rpc.mockResolvedValue({ data: [{ job_id: "33333333-3333-4333-8333-333333333333", subject_user_id: null, claimed: false }], error: null });
    const { reconcileAccountDeletionJobs } = await import("@/lib/account-deletion");

    await expect(reconcileAccountDeletionJobs()).resolves.toEqual({ inspected: 2, completed: 0, skipped: 2, failed: 0, purged: 0 });
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("records a retryable recovery failure", async () => {
    const jobsQuery = {
      delete: () => ({ eq: () => ({ lte: async () => ({ count: 1, error: null }) }) }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: [{ id: "22222222-2222-4222-8222-222222222222", status: "deleting_identity", lease_expires_at: null }],
              error: null
            })
          })
        })
      })
    };
    mocks.from.mockReturnValue(jobsQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "claim_account_deletion_recovery"
      ? { data: [{ job_id: "22222222-2222-4222-8222-222222222222", subject_user_id: auth.userId, claimed: true }], error: null }
      : { data: true, error: null });
    mocks.getUserById.mockRejectedValueOnce(Object.assign(new Error("auth timeout"), { code: "ETIMEDOUT" }));
    const { reconcileAccountDeletionJobs } = await import("@/lib/account-deletion");

    await expect(reconcileAccountDeletionJobs()).resolves.toEqual({ inspected: 1, completed: 0, skipped: 0, failed: 1, purged: 1 });
    const failureRecord = mocks.rpc.mock.calls.find(
      ([name, payload]) => name === "record_account_deletion_step" && payload.p_event_type === "account_deletion_recovery_failed"
    );
    expect(failureRecord?.[1]).toMatchObject({ p_error_code: "ETIMEDOUT" });
  });
});
