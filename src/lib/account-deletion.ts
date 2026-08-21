import "server-only";

import type Stripe from "stripe";
import { isAccountDeletionLeaseAvailable, isTerminalStripeSubscription } from "@/lib/account-deletion-policy";
import { getStripeClient, isValidEmail } from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";
import { deleteUserAccount } from "@/lib/supabase/user-data";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;
type DeletionAuth = Parameters<typeof deleteUserAccount>[0];

type ClaimedDeletion = {
  job_id: string;
  job_status: string;
  claimed: boolean;
};

type RecoveryClaim = {
  job_id: string;
  subject_user_id: string | null;
  claimed: boolean;
};

type DeletionJobRow = {
  id: string;
  status: string;
  lease_expires_at: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9_:-]{6,120}$/;
const STRIPE_RESOURCE_MISSING = "resource_missing";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class AccountDeletionError extends Error {
  constructor(
    readonly code: "configuration_missing" | "already_running" | "billing_mapping_incomplete" | "provider_failed" | "persistence_failed",
    readonly status: 409 | 503,
    message: string
  ) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

function safeFailureCode(error: unknown) {
  if (error instanceof AccountDeletionError) return error.code;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && /^[a-z0-9_:-]{1,80}$/i.test(code)) return code;
  return "unexpected_failure";
}

async function claimDeletion(service: ServiceClient, userId: string, operationId: string) {
  const { data, error } = await service.rpc("claim_account_deletion", {
    p_user_id: userId,
    p_operation_id: operationId
  });
  if (error) throw new AccountDeletionError("persistence_failed", 503, "Kontolöschung konnte nicht sicher gestartet werden.");
  const claim = (data as ClaimedDeletion[] | null)?.[0];
  if (!claim?.claimed) {
    throw new AccountDeletionError("already_running", 409, "Eine Kontolöschung wird bereits verarbeitet.");
  }
  return claim;
}

async function recordStep(
  service: ServiceClient,
  input: {
    jobId: string;
    operationId: string;
    status: "requested" | "cancelling_subscriptions" | "deleting_identity" | "completed" | "failed";
    eventType: string;
    details?: Record<string, unknown>;
    errorCode?: string | null;
    customerIds?: string[] | null;
    cancelledSubscriptionIds?: string[] | null;
  }
) {
  const { data, error } = await service.rpc("record_account_deletion_step", {
    p_job_id: input.jobId,
    p_operation_id: input.operationId,
    p_status: input.status,
    p_event_type: input.eventType,
    p_details: input.details ?? {},
    p_error_code: input.errorCode ?? null,
    p_stripe_customer_ids: input.customerIds ?? null,
    p_cancelled_subscription_ids: input.cancelledSubscriptionIds ?? null
  });
  if (error || data !== true) {
    throw new AccountDeletionError("persistence_failed", 503, "Kontolöschung konnte nicht sicher fortgesetzt werden.");
  }
}

async function loadStripeCustomerIds(service: ServiceClient, stripe: Stripe | null, auth: DeletionAuth) {
  const { data: entitlement, error } = await service
    .from("entitlements")
    .select("provider_customer_id")
    .eq("user_id", auth.userId)
    .eq("provider", "stripe")
    .maybeSingle();
  if (error) throw new AccountDeletionError("persistence_failed", 503, "Abrechnungszuordnung konnte nicht geprüft werden.");

  const ids = new Set<string>();
  if (STRIPE_CUSTOMER_PATTERN.test(entitlement?.provider_customer_id ?? "")) {
    ids.add(entitlement!.provider_customer_id as string);
  } else if (entitlement) {
    throw new AccountDeletionError(
      "billing_mapping_incomplete",
      503,
      "Das Konto besitzt eine unvollständige Abrechnungszuordnung. Die Löschung wurde sicher angehalten."
    );
  }

  if (!stripe) {
    if (ids.size > 0) {
      throw new AccountDeletionError("configuration_missing", 503, "Stripe ist für die sichere Kontolöschung nicht verfügbar.");
    }
    return [];
  }

  let searchPage: string | undefined;
  do {
    const customers = await stripe.customers.search({
      query: `metadata['stockpilot_user_id']:'${auth.userId}'`,
      limit: 100,
      ...(searchPage ? { page: searchPage } : {})
    });
    for (const customer of customers.data) {
      if (customer.metadata?.stockpilot_user_id === auth.userId && STRIPE_CUSTOMER_PATTERN.test(customer.id)) {
        ids.add(customer.id);
      }
    }
    searchPage = customers.next_page ?? undefined;
  } while (searchPage);

  if (isValidEmail(auth.email)) {
    let startingAfter: string | undefined;
    do {
      const customers = await stripe.customers.list({
        email: auth.email,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });
      for (const customer of customers.data) {
        if (
          customer.metadata?.stockpilot_user_id === auth.userId &&
          STRIPE_CUSTOMER_PATTERN.test(customer.id)
        ) {
          ids.add(customer.id);
        }
      }
      startingAfter = customers.has_more ? customers.data.at(-1)?.id : undefined;
    } while (startingAfter);
  }

  return [...ids].sort();
}

async function expireOpenCheckoutSessions(stripe: Stripe, customerIds: string[]) {
  const sessionIds: string[] = [];

  for (const customer of customerIds) {
    let startingAfter: string | undefined;
    do {
      const page = await stripe.checkout.sessions.list({
        customer,
        status: "open",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });
      sessionIds.push(...page.data.map((session) => session.id));
      if (sessionIds.length > 1_000) {
        throw new AccountDeletionError(
          "provider_failed",
          503,
          "Zu viele offene Checkout-Sitzungen. Die Kontolöschung wurde sicher angehalten."
        );
      }
      startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
    } while (startingAfter);
  }

  for (const sessionId of [...new Set(sessionIds)]) {
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== STRIPE_RESOURCE_MISSING) throw error;
    }
  }

  return [...new Set(sessionIds)].sort();
}

async function cancelCustomerSubscriptions(stripe: Stripe, customerIds: string[]) {
  const cancelledIds: string[] = [];

  for (const customer of customerIds) {
    let startingAfter: string | undefined;
    do {
      const page = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {})
      });

      for (const subscription of page.data) {
        if (isTerminalStripeSubscription(subscription.status)) continue;
        try {
          await stripe.subscriptions.cancel(subscription.id, { prorate: false });
          cancelledIds.push(subscription.id);
        } catch (error) {
          if ((error as { code?: string } | null)?.code !== STRIPE_RESOURCE_MISSING) throw error;
        }
      }

      startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
    } while (startingAfter);
  }

  return [...new Set(cancelledIds)].sort();
}

export async function getAccountDeletionDisposition(
  service: ServiceClient,
  identifiers: { userId?: string | null; customerId?: string | null }
) {
  let job: { status: string } | null = null;

  if (identifiers.userId && UUID_PATTERN.test(identifiers.userId)) {
    const result = await service
      .from("account_deletion_jobs")
      .select("status")
      .eq("user_id", identifiers.userId)
      .maybeSingle();
    if (result.error) throw result.error;
    job = result.data;

    if (!job) {
      const fingerprint = await sha256(identifiers.userId.toLowerCase());
      const fingerprintResult = await service
        .from("account_deletion_jobs")
        .select("status")
        .eq("user_fingerprint", fingerprint)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fingerprintResult.error) throw fingerprintResult.error;
      job = fingerprintResult.data;
    }
  }

  if (!job && identifiers.customerId && STRIPE_CUSTOMER_PATTERN.test(identifiers.customerId)) {
    const result = await service
      .from("account_deletion_jobs")
      .select("status")
      .contains("stripe_customer_ids", [identifiers.customerId])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    job = result.data;
  }

  if (!job || job.status === "failed") return null;
  return job.status === "completed" ? "account_deleted" as const : "account_deletion_in_progress" as const;
}

export async function cancelStripeSubscriptionForDeletedAccount(stripe: Stripe, subscription: Stripe.Subscription) {
  if (isTerminalStripeSubscription(subscription.status)) return false;
  try {
    await stripe.subscriptions.cancel(subscription.id, { prorate: false });
    return true;
  } catch (error) {
    if ((error as { code?: string } | null)?.code === STRIPE_RESOURCE_MISSING) return false;
    throw error;
  }
}

export async function runAccountDeletion(auth: DeletionAuth) {
  const service = createSupabaseServiceClient();
  if (!service) {
    throw new AccountDeletionError("configuration_missing", 503, "Kontolöschung ist serverseitig nicht verfügbar.");
  }

  const operationId = crypto.randomUUID();
  const claim = await claimDeletion(service, auth.userId, operationId);
  let identityDeletionStarted = false;

  try {
    const stripe = getStripeClient();
    const customerIds = await loadStripeCustomerIds(service, stripe, auth);
    await recordStep(service, {
      jobId: claim.job_id,
      operationId,
      status: "cancelling_subscriptions",
      eventType: "billing_discovered",
      customerIds,
      details: { customerCount: customerIds.length }
    });

    const expiredCheckoutSessionIds = stripe
      ? await expireOpenCheckoutSessions(stripe, customerIds)
      : [];
    const cancelledSubscriptionIds = stripe ? await cancelCustomerSubscriptions(stripe, customerIds) : [];

    if (customerIds.length > 0) {
      const { error } = await service
        .from("entitlements")
        .update({ status: "canceled", cancel_at_period_end: false, last_synced_at: new Date().toISOString() })
        .eq("user_id", auth.userId)
        .eq("provider", "stripe");
      if (error) throw error;
    }

    await recordStep(service, {
      jobId: claim.job_id,
      operationId,
      status: "deleting_identity",
      eventType: "subscriptions_cancelled",
      customerIds,
      cancelledSubscriptionIds,
      details: {
        expiredCheckoutSessionCount: expiredCheckoutSessionIds.length,
        cancelledSubscriptionCount: cancelledSubscriptionIds.length
      }
    });

    identityDeletionStarted = true;
    await deleteUserAccount(auth);
    await recordStep(service, {
      jobId: claim.job_id,
      operationId,
      status: "completed",
      eventType: "account_deleted",
      customerIds,
      cancelledSubscriptionIds,
      details: { completed: true }
    });

    logEvent("info", "account_deletion.completed", {
      deletionJobId: claim.job_id,
      customerCount: customerIds.length,
      expiredCheckoutSessionCount: expiredCheckoutSessionIds.length,
      cancelledSubscriptionCount: cancelledSubscriptionIds.length
    });
    return { deleted: true as const, deletionId: claim.job_id };
  } catch (error) {
    const failureCode = safeFailureCode(error);
    try {
      await recordStep(service, {
        jobId: claim.job_id,
        operationId,
        status: identityDeletionStarted ? "deleting_identity" : "failed",
        eventType: "deletion_failed",
        errorCode: failureCode,
        details: { retryable: true, identityDeletionStarted }
      });
    } catch {
      logEvent("error", "account_deletion.failure_not_persisted", { deletionJobId: claim.job_id, failureCode });
    }

    logEvent("error", "account_deletion.failed", {
      deletionJobId: claim.job_id,
      failureCode,
      identityDeletionStarted
    });
    if (error instanceof AccountDeletionError) throw error;
    throw new AccountDeletionError("provider_failed", 503, "Kontolöschung wurde sicher angehalten und kann erneut versucht werden.");
  }
}

export async function reconcileAccountDeletionJobs(limit = 20) {
  const service = createSupabaseServiceClient();
  if (!service) throw new AccountDeletionError("configuration_missing", 503, "Kontolöschungs-Worker ist nicht konfiguriert.");

  const { data, error } = await service
    .from("account_deletion_jobs")
    .select("id,status,lease_expires_at")
    .eq("status", "deleting_identity")
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw error;

  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of (data ?? []) as DeletionJobRow[]) {
    if (!isAccountDeletionLeaseAvailable(row.lease_expires_at)) {
      skipped += 1;
      continue;
    }

    const operationId = crypto.randomUUID();
    const claimResult = await service.rpc("claim_account_deletion_recovery", {
      p_job_id: row.id,
      p_operation_id: operationId
    });
    const claim = (claimResult.data as RecoveryClaim[] | null)?.[0];
    if (claimResult.error || !claim?.claimed || !claim.subject_user_id) {
      skipped += 1;
      continue;
    }

    try {
      const lookup = await service.auth.admin.getUserById(claim.subject_user_id);
      const lookupStatus = (lookup.error as { status?: number } | null)?.status;
      if (lookup.error && lookupStatus !== 404) throw lookup.error;
      if (lookup.data.user) {
        const deletion = await service.auth.admin.deleteUser(claim.subject_user_id);
        if (deletion.error) throw deletion.error;
      }
      await recordStep(service, {
        jobId: claim.job_id,
        operationId,
        status: "completed",
        eventType: "account_deletion_recovered",
        details: { recovered: true }
      });
      completed += 1;
    } catch (recoveryError) {
      failed += 1;
      try {
        await recordStep(service, {
          jobId: claim.job_id,
          operationId,
          status: "deleting_identity",
          eventType: "account_deletion_recovery_failed",
          errorCode: safeFailureCode(recoveryError),
          details: { retryable: true }
        });
      } catch {
        logEvent("error", "account_deletion.recovery_failure_not_persisted", { deletionJobId: claim.job_id });
      }
    }
  }

  const purge = await service
    .from("account_deletion_jobs")
    .delete({ count: "exact" })
    .eq("status", "completed")
    .lte("purge_after", new Date().toISOString());
  if (purge.error) throw purge.error;

  return { inspected: data?.length ?? 0, completed, skipped, failed, purged: purge.count ?? 0 };
}
