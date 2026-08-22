import type Stripe from "stripe";
import {
  cancelStripeSubscriptionForDeletedAccount,
  getAccountDeletionDisposition
} from "@/lib/account-deletion";
import { jsonError, jsonOk } from "@/lib/api-guard";
import {
  entitlementFromStripeSubscription,
  stripeSubscriptionIds,
  type StripeEntitlementMutation
} from "@/lib/billing/stripe-events";
import {
  getPlanForStripePriceId,
  getStripeBillingConfiguration,
  getStripeClient
} from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 262_144;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseServiceClient>>;

type SubscriptionAction = {
  mutation: StripeEntitlementMutation | null;
  objectId: string | null;
  skippedReason: string | null;
  userId: string | null;
};

type AtomicApplyResult = {
  applied: boolean;
  duplicate: boolean;
  reason: string | null;
  stale: boolean;
};

async function rawWebhookBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BYTES) return null;
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_WEBHOOK_BYTES) return null;
  return new TextDecoder().decode(bytes);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function trustedUserId(value: unknown) {
  return typeof value === "string" && uuidPattern.test(value) ? value : null;
}

function providerCreatedAt(event: Stripe.Event) {
  if (!Number.isSafeInteger(event.created) || event.created <= 0) {
    throw new Error("stripe_event_created_invalid");
  }
  return new Date(event.created * 1_000).toISOString();
}

async function mappedUserId(supabase: ServiceClient, subscription: Stripe.Subscription) {
  const { customerId, subscriptionId } = stripeSubscriptionIds(subscription);
  if (subscriptionId) {
    const { data, error } = await supabase
      .from("entitlements")
      .select("user_id")
      .eq("provider", "stripe")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (typeof data?.user_id === "string") return data.user_id;
  }
  if (customerId) {
    const { data, error } = await supabase
      .from("entitlements")
      .select("user_id")
      .eq("provider", "stripe")
      .eq("provider_customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    if (typeof data?.user_id === "string") return data.user_id;
  }
  return null;
}

async function subscriptionAction(
  supabase: ServiceClient,
  subscription: Stripe.Subscription
): Promise<SubscriptionAction> {
  const ids = stripeSubscriptionIds(subscription);
  const metadataUserId = trustedUserId(subscription.metadata.stockpilot_user_id);
  const earlyDisposition = await getAccountDeletionDisposition(supabase, {
    userId: metadataUserId,
    customerId: ids.customerId
  });
  if (earlyDisposition) {
    await cancelStripeSubscriptionForDeletedAccount(getStripeClientOrThrow(), subscription);
    return {
      mutation: null,
      objectId: ids.subscriptionId,
      skippedReason: earlyDisposition,
      userId: earlyDisposition === "account_deleted" ? null : metadataUserId
    };
  }

  const fallbackUserId = await mappedUserId(supabase, subscription);
  const mutation = entitlementFromStripeSubscription(subscription, getPlanForStripePriceId, fallbackUserId);
  if (!mutation) throw new Error("subscription_mapping_missing");

  const disposition = await getAccountDeletionDisposition(supabase, {
    userId: mutation.userId,
    customerId: mutation.providerCustomerId
  });
  if (disposition) {
    await cancelStripeSubscriptionForDeletedAccount(getStripeClientOrThrow(), subscription);
    return {
      mutation: null,
      objectId: mutation.providerSubscriptionId,
      skippedReason: disposition,
      userId: disposition === "account_deleted" ? null : mutation.userId
    };
  }

  const userLookup = await supabase.auth.admin.getUserById(mutation.userId);
  const lookupStatus = (userLookup.error as { status?: number } | null)?.status;
  if (userLookup.error && lookupStatus !== 404) throw userLookup.error;
  if (!userLookup.data.user) {
    await cancelStripeSubscriptionForDeletedAccount(getStripeClientOrThrow(), subscription);
    return {
      mutation: null,
      objectId: mutation.providerSubscriptionId,
      skippedReason: "account_missing",
      userId: null
    };
  }

  return {
    mutation,
    objectId: mutation.providerSubscriptionId,
    skippedReason: null,
    userId: mutation.userId
  };
}

function getStripeClientOrThrow() {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("stripe_unavailable");
  return stripe;
}

function parseAtomicApplyResult(data: unknown): AtomicApplyResult {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new Error("billing_event_result_invalid");
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.applied !== "boolean" ||
    typeof candidate.duplicate !== "boolean" ||
    typeof candidate.stale !== "boolean" ||
    (candidate.reason !== null && typeof candidate.reason !== "string")
  ) {
    throw new Error("billing_event_result_invalid");
  }
  return candidate as AtomicApplyResult;
}

async function applyEventAtomically(
  supabase: ServiceClient,
  event: Stripe.Event,
  body: string,
  action: SubscriptionAction
) {
  const mutation = action.mutation;
  const { data, error } = await supabase.rpc("apply_stripe_billing_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: action.userId,
    p_payload_hash: await sha256(body),
    p_livemode: event.livemode,
    p_provider_created_at: providerCreatedAt(event),
    p_provider_object_id: action.objectId,
    p_apply_entitlement: Boolean(mutation),
    p_ignore_reason: action.skippedReason,
    p_plan: mutation?.plan ?? null,
    p_status: mutation?.status ?? null,
    p_provider_customer_id: mutation?.providerCustomerId ?? null,
    p_provider_subscription_id: mutation?.providerSubscriptionId ?? null,
    p_provider_price_id: mutation?.providerPriceId ?? null,
    p_valid_until: mutation?.validUntil ?? null,
    p_trial_ends_at: mutation?.trialEndsAt ?? null,
    p_cancel_at_period_end: mutation?.cancelAtPeriodEnd ?? false,
    p_last_synced_at: mutation?.lastSyncedAt ?? new Date().toISOString()
  });
  if (error) throw error;
  return parseAtomicApplyResult(data);
}

async function duplicateEventExists(supabase: ServiceClient, eventId: string) {
  const { data, error } = await supabase
    .from("billing_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const configuration = getStripeBillingConfiguration();
  const supabase = createSupabaseServiceClient();
  if (!stripe || !configuration.webhookSecret || !supabase) {
    return jsonError("Billing-Webhook ist nicht vollständig konfiguriert.", 503);
  }

  const signature = request.headers.get("stripe-signature");
  const body = await rawWebhookBody(request);
  if (!signature || !body) return jsonError("Ungültiger Billing-Webhook.", 400);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, configuration.webhookSecret);
  } catch {
    logEvent("warn", "billing.webhook_signature_rejected", {});
    return jsonError("Ungültige Webhook-Signatur.", 400);
  }

  try {
    if (await duplicateEventExists(supabase, event.id)) {
      return jsonOk({ received: true, duplicate: true });
    }

    let action: SubscriptionAction = {
      mutation: null,
      objectId: null,
      skippedReason: "event_type_not_actionable",
      userId: null
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!subscriptionId) throw new Error("checkout_subscription_missing");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"]
      });
      action = await subscriptionAction(supabase, subscription);
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      action = await subscriptionAction(supabase, event.data.object as Stripe.Subscription);
    }

    const result = await applyEventAtomically(supabase, event, body, action);
    if (result.duplicate) return jsonOk({ received: true, duplicate: true });

    logEvent("info", "billing.webhook_processed", {
      eventType: event.type,
      handled: result.applied,
      stale: result.stale,
      userId: action.userId,
      skippedReason: result.reason
    });
    return jsonOk({
      received: true,
      handled: result.applied,
      skippedReason: result.reason,
      stale: result.stale
    });
  } catch (error) {
    logEvent("error", "billing.webhook_processing_failed", {
      eventType: event.type,
      errorName: error instanceof Error ? error.name : "unknown"
    });
    return jsonError("Billing-Ereignis konnte nicht sicher verarbeitet werden.", 503);
  }
}
