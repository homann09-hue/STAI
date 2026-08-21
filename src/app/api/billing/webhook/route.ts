import type Stripe from "stripe";
import {
  cancelStripeSubscriptionForDeletedAccount,
  getAccountDeletionDisposition
} from "@/lib/account-deletion";
import { jsonError, jsonOk } from "@/lib/api-guard";
import { entitlementFromStripeSubscription, stripeSubscriptionIds } from "@/lib/billing/stripe-events";
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

async function mappedUserId(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  subscription: Stripe.Subscription
) {
  const { customerId, subscriptionId } = stripeSubscriptionIds(subscription);
  if (subscriptionId) {
    const { data } = await supabase
      .from("entitlements")
      .select("user_id")
      .eq("provider", "stripe")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }
  if (customerId) {
    const { data } = await supabase
      .from("entitlements")
      .select("user_id")
      .eq("provider", "stripe")
      .eq("provider_customer_id", customerId)
      .maybeSingle();
    if (typeof data?.user_id === "string") return data.user_id;
  }
  return null;
}

async function syncSubscription(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceClient>>,
  subscription: Stripe.Subscription,
  eventId: string
) {
  const ids = stripeSubscriptionIds(subscription);
  const metadataUserId = subscription.metadata.stockpilot_user_id || null;
  const earlyDisposition = await getAccountDeletionDisposition(supabase, {
    userId: metadataUserId,
    customerId: ids.customerId
  });
  if (earlyDisposition) {
    await cancelStripeSubscriptionForDeletedAccount(getStripeClientOrThrow(), subscription);
    return { userId: metadataUserId, skippedReason: earlyDisposition };
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
    return { userId: mutation.userId, skippedReason: disposition };
  }

  const userLookup = await supabase.auth.admin.getUserById(mutation.userId);
  const lookupStatus = (userLookup.error as { status?: number } | null)?.status;
  if (userLookup.error && lookupStatus !== 404) throw userLookup.error;
  if (!userLookup.data.user) {
    await cancelStripeSubscriptionForDeletedAccount(getStripeClientOrThrow(), subscription);
    return { userId: mutation.userId, skippedReason: "account_missing" as const };
  }

  const { error } = await supabase.from("entitlements").upsert(
    {
      user_id: mutation.userId,
      plan: mutation.plan,
      status: mutation.status,
      provider: "stripe",
      provider_customer_id: mutation.providerCustomerId,
      provider_subscription_id: mutation.providerSubscriptionId,
      provider_price_id: mutation.providerPriceId,
      valid_until: mutation.validUntil,
      trial_ends_at: mutation.trialEndsAt,
      cancel_at_period_end: mutation.cancelAtPeriodEnd,
      last_provider_event_id: eventId,
      last_synced_at: mutation.lastSyncedAt
    },
    { onConflict: "user_id,provider" }
  );
  if (error) throw error;
  return { userId: mutation.userId, skippedReason: null };
}

function getStripeClientOrThrow() {
  const stripe = getStripeClient();
  if (!stripe) throw new Error("stripe_unavailable");
  return stripe;
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

  const { data: existing, error: existingError } = await supabase
    .from("billing_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existingError) return jsonError("Billing-Ereignis konnte nicht geprüft werden.", 503);
  if (existing) return jsonOk({ received: true, duplicate: true });

  let handled = false;
  let userId: string | null = null;
  let skippedReason: string | null = null;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!subscriptionId) throw new Error("checkout_subscription_missing");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"]
      });
      const sync = await syncSubscription(supabase, subscription, event.id);
      userId = sync.userId;
      skippedReason = sync.skippedReason;
      handled = !skippedReason;
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sync = await syncSubscription(supabase, event.data.object as Stripe.Subscription, event.id);
      userId = sync.userId;
      skippedReason = sync.skippedReason;
      handled = !skippedReason;
    }

    const { error: insertError } = await supabase.from("billing_events").insert({
      provider: "stripe",
      event_id: event.id,
      event_type: event.type,
      status: handled ? "processed" : "ignored",
      user_id: userId,
      payload_hash: await sha256(body),
      livemode: event.livemode,
      provider_created_at: new Date(event.created * 1_000).toISOString(),
      processed_at: new Date().toISOString()
    });

    if (insertError && insertError.code !== "23505") throw insertError;
    logEvent("info", "billing.webhook_processed", { eventType: event.type, handled, userId, skippedReason });
    return jsonOk({ received: true, handled, skippedReason });
  } catch (error) {
    logEvent("error", "billing.webhook_processing_failed", {
      eventType: event.type,
      errorName: error instanceof Error ? error.name : "unknown"
    });
    return jsonError("Billing-Ereignis konnte nicht sicher verarbeitet werden.", 503);
  }
}
