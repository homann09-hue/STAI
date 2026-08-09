import Stripe from "stripe";
import { PlanId } from "@/lib/feature-gates";
import { siteUrlFromEnv } from "@/lib/env";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripePriceIds: Partial<Record<PlanId, string>> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  elite: process.env.STRIPE_PRICE_ELITE
};

const stripePriceIdToPlan = new Map<string, PlanId>(
  Object.entries(stripePriceIds).flatMap(([plan, priceId]) => (priceId ? [[priceId, plan as PlanId]] : []))
);

export function getStripeClient() {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey, {
    apiVersion: "2022-11-15"
  });
}

export function getStripeWebhookSecret() {
  return stripeWebhookSecret ?? null;
}

export function isStripeBillingConfigured() {
  return Boolean(
    stripeSecretKey &&
      stripeWebhookSecret &&
      stripePriceIds.starter &&
      stripePriceIds.pro &&
      stripePriceIds.elite
  );
}

export function getStripePriceId(plan: PlanId) {
  return stripePriceIds[plan] ?? null;
}

export function getPlanIdFromStripePrice(priceId: string): PlanId | null {
  return stripePriceIdToPlan.get(priceId) ?? null;
}

export function normalizeStripeSubscriptionStatus(status: string) {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return status;
  }

  if (status === "canceled" || status === "incomplete" || status === "incomplete_expired" || status === "unpaid") {
    return "canceled";
  }

  return "demo";
}

export function normalizeStripeValidUntil(timestamp: number | null | undefined) {
  if (!Number.isFinite(Number(timestamp))) return null;
  return new Date(Number(timestamp) * 1000).toISOString();
}

export function getStripeReturnUrls() {
  const siteUrl = siteUrlFromEnv();
  return {
    successUrl: `${siteUrl}/settings?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${siteUrl}/pricing`
  };
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function ensureStripeCustomer(stripe: Stripe, userId: string, email: string | null) {
  if (!email || !isValidEmail(email)) {
    throw new Error("Ungültige Kunden-E-Mail für Stripe. Bitte benutze eine registrierte E-Mail-Adresse.");
  }

  const customers = await stripe.customers.list({ email, limit: 10 });
  const matching = customers.data.find(
    (customer) => customer.metadata?.supabase_user_id === userId
  );

  if (matching) {
    if (matching.metadata?.supabase_user_id !== userId) {
      await stripe.customers.update(matching.id, {
        metadata: {
          ...matching.metadata,
          supabase_user_id: userId
        }
      });
    }
    return matching;
  }

  const existingByEmail = customers.data.find((customer) => customer.email === email);
  if (existingByEmail) {
    return await stripe.customers.update(existingByEmail.id, {
      metadata: {
        ...existingByEmail.metadata,
        supabase_user_id: userId
      }
    });
  }

  return await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId
    }
  });
}
