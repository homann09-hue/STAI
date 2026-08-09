import type Stripe from "stripe";
import { jsonError, jsonOk } from "@/lib/api-guard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPlanIdFromStripePrice, getStripeClient, getStripeWebhookSecret, normalizeStripeSubscriptionStatus, normalizeStripeValidUntil } from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

function getStripeEventSignature(request: Request) {
  return request.headers.get("stripe-signature");
}

async function resolveSupabaseUserId(stripe: ReturnType<typeof getStripeClient>, customerId: string) {
  if (!stripe) return null;
  const customerResponse = await stripe.customers.retrieve(customerId);
  const customer = customerResponse as unknown as Stripe.Customer | Stripe.DeletedCustomer;

  if (!customer || ("deleted" in customer && customer.deleted)) {
    return null;
  }

  if (typeof customer.metadata?.supabase_user_id === "string" && customer.metadata.supabase_user_id) {
    return customer.metadata.supabase_user_id;
  }

  const db = createSupabaseServiceClient();
  if (!db) return null;

  const { data } = await db
    .from("entitlements")
    .select("user_id")
    .eq("provider", "stripe")
    .eq("provider_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}

async function upsertEntitlement({
  userId,
  customerId,
  plan,
  status,
  validUntil
}: {
  userId: string;
  customerId: string;
  plan: string;
  status: string;
  validUntil: string | null;
}) {
  const db = createSupabaseServiceClient();
  if (!db) throw new Error("Supabase Service Client is not configured.");

  const { error } = await db.from("entitlements").upsert(
    {
      user_id: userId,
      provider: "stripe",
      provider_customer_id: customerId,
      plan,
      status,
      valid_until: validUntil,
      features: {}
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    throw error;
  }
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Stripe ist nicht konfiguriert.", 503);
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return jsonError("Stripe Webhook Secret ist nicht konfiguriert.", 503);
  }

  const signature = getStripeEventSignature(request);
  if (!signature) {
    return jsonError("Stripe-Signatur fehlt im Header.", 400);
  }

  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    logEvent("warn", "billing.stripe_webhook.invalid_signature", { error: String((error as Error)?.message ?? "unknown") });
    return jsonError("Stripe-Webhooksignatur konnte nicht validiert werden.", 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!session.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
          expand: ["items.data.price"]
        });
        await handleSubscription(subscription, stripe);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscription(subscription, stripe);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string, {
          expand: ["items.data.price"]
        });
        await handleSubscription(subscription, stripe);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string, {
          expand: ["items.data.price"]
        });
        await handleSubscription(subscription, stripe);
        break;
      }
      default:
        logEvent("info", "billing.stripe_webhook.unhandled_event", { type: event.type });
    }

    return jsonOk({ received: true });
  } catch (error) {
    logEvent("error", "billing.stripe_webhook.processing_failed", {
      event: event.type,
      error: String((error as Error)?.message ?? "unknown")
    });
    return jsonError("Stripe-Webhook konnte nicht verarbeitet werden.", 500);
  }
}

async function handleSubscription(subscription: Stripe.Subscription, stripe: Stripe) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) {
    throw new Error("Stripe-Subscription hat keine gültige Kunden-ID.");
  }

  const plan = getPlanIdFromStripePrice(subscription.items.data[0]?.price?.id ?? "");
  if (!plan) {
    throw new Error("Kein Stripe-Preis konnte einem Plan zugeordnet werden.");
  }

  const status = normalizeStripeSubscriptionStatus(subscription.status);
  const validUntil = normalizeStripeValidUntil(subscription.current_period_end ?? null);

  const userId = await resolveSupabaseUserId(stripe, customerId);
  if (!userId) {
    throw new Error("Supabase user_id konnte für den Stripe-Kunden nicht gefunden werden.");
  }

  await upsertEntitlement({
    userId,
    customerId,
    plan,
    status,
    validUntil
  });
}
