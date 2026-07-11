import type { PublicEntitlements } from "@/lib/billing/entitlements";
import type { PricingTier } from "@/lib/feature-gates";

export type BillingApiResponse = PublicEntitlements & {
  mode: "local" | "supabase";
  tiers: PricingTier[];
  billing: {
    provider: "stripe";
    configured: boolean;
    webhookConfigured: boolean;
    portalConfigured: boolean;
    plans: { starter: boolean; pro: boolean; elite: boolean };
  };
};

function authorizationHeaders(accessToken?: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function fetchBillingEntitlements(accessToken?: string | null) {
  const response = await fetch("/api/billing/entitlements", {
    cache: "no-store",
    headers: authorizationHeaders(accessToken)
  });
  const payload = (await response.json()) as BillingApiResponse & { error?: string };
  if (!payload || typeof payload.plan !== "string" || !payload.billing) {
    throw new Error("Billingstatus konnte nicht sicher gelesen werden.");
  }
  return payload;
}

export function isAllowedStripeRedirect(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "checkout.stripe.com" || url.hostname === "billing.stripe.com")
    );
  } catch {
    return false;
  }
}

async function billingAction(path: string, accessToken: string, body?: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body ?? {})
  });
  const payload = (await response.json().catch(() => ({}))) as { url?: unknown; error?: unknown };

  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Billing-Aktion konnte nicht ausgeführt werden.");
  }
  if (typeof payload.url !== "string" || !isAllowedStripeRedirect(payload.url)) {
    throw new Error("Billing-Provider lieferte keine sichere Weiterleitung.");
  }
  return payload.url;
}

export function createCheckoutSession(accessToken: string, plan: "starter" | "pro") {
  return billingAction("/api/billing/checkout", accessToken, { plan });
}

export function createPortalSession(accessToken: string) {
  return billingAction("/api/billing/portal", accessToken);
}
