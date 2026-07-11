import "server-only";
import Stripe from "stripe";
import type { PlanId } from "@/lib/feature-gates";

export type StripeCheckoutPlan = "starter" | "pro";

function validSecretKey(value: string | undefined): value is string {
  return Boolean(value && /^sk_(test|live)_[A-Za-z0-9_]{16,}$/.test(value));
}

function validWebhookSecret(value: string | undefined): value is string {
  return Boolean(value && /^whsec_[A-Za-z0-9]{16,}$/.test(value));
}

function validPriceId(value: string | undefined): value is string {
  return Boolean(value && /^price_[A-Za-z0-9]{8,}$/.test(value));
}

function validPortalConfigurationId(value: string | undefined): value is string {
  return Boolean(value && /^bpc_[A-Za-z0-9]{8,}$/.test(value));
}

export function getStripeBillingConfiguration() {
  const secretKey = validSecretKey(process.env.STRIPE_SECRET_KEY) ? process.env.STRIPE_SECRET_KEY : null;
  const webhookSecret = validWebhookSecret(process.env.STRIPE_WEBHOOK_SECRET)
    ? process.env.STRIPE_WEBHOOK_SECRET
    : null;
  const starterPriceId = validPriceId(process.env.STRIPE_STARTER_PRICE_ID)
    ? process.env.STRIPE_STARTER_PRICE_ID
    : null;
  const proPriceId = validPriceId(process.env.STRIPE_PRO_PRICE_ID) ? process.env.STRIPE_PRO_PRICE_ID : null;
  const portalConfigurationId = validPortalConfigurationId(process.env.STRIPE_PORTAL_CONFIGURATION_ID)
    ? process.env.STRIPE_PORTAL_CONFIGURATION_ID
    : null;
  const entitlementsConfigured = Boolean(secretKey && webhookSecret);

  return {
    secretKey,
    webhookSecret,
    portalConfigurationId,
    entitlementsConfigured,
    priceIds: {
      starter: starterPriceId,
      pro: proPriceId
    },
    plans: {
      starter: Boolean(entitlementsConfigured && starterPriceId),
      pro: Boolean(entitlementsConfigured && proPriceId),
      elite: false
    }
  };
}

export function getStripePublicConfiguration() {
  const configuration = getStripeBillingConfiguration();
  return {
    provider: "stripe" as const,
    configured: configuration.plans.starter || configuration.plans.pro,
    webhookConfigured: Boolean(configuration.webhookSecret),
    portalConfigured: Boolean(configuration.secretKey),
    plans: configuration.plans
  };
}

let cachedSecret: string | null = null;
let cachedClient: Stripe | null = null;

export function getStripeClient() {
  const configuration = getStripeBillingConfiguration();
  if (!configuration.secretKey) return null;

  if (cachedClient && cachedSecret === configuration.secretKey) return cachedClient;

  cachedSecret = configuration.secretKey;
  cachedClient = new Stripe(configuration.secretKey, {
    maxNetworkRetries: 2,
    telemetry: false,
    timeout: 12_000
  });
  return cachedClient;
}

export function getStripePriceId(plan: StripeCheckoutPlan) {
  return getStripeBillingConfiguration().priceIds[plan];
}

export function getPlanForStripePriceId(priceId: string): Exclude<PlanId, "free" | "elite"> | null {
  const prices = getStripeBillingConfiguration().priceIds;
  if (prices.starter === priceId) return "starter";
  if (prices.pro === priceId) return "pro";
  return null;
}

function safeOrigin(candidate: string | undefined) {
  if (!candidate) return null;

  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const localDevelopment =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.username || url.password || (url.protocol !== "https:" && !localDevelopment)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getTrustedBillingOrigin(request: Request) {
  return (
    safeOrigin(process.env.STOCKPILOT_APP_URL) ??
    safeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    safeOrigin(new URL(request.url).origin)
  );
}
