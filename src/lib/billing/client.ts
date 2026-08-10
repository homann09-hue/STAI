import type { PublicEntitlements } from "@/lib/billing/entitlements";
import type { BillingInterval, PaidPlanId, PricingTier } from "@/lib/feature-gates";

export type BillingApiResponse = PublicEntitlements & {
  mode: "local" | "supabase";
  tiers: PricingTier[];
  billing: {
    provider: "stripe";
    configured: boolean;
    webhookConfigured: boolean;
    portalConfigured: boolean;
    plans: Record<PaidPlanId, Record<BillingInterval, boolean>>;
  };
};

function authorizationHeaders(accessToken?: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

const pendingEntitlementRequests = new Map<string, Promise<BillingApiResponse>>();

async function loadBillingEntitlements(accessToken?: string | null) {
  const response = await fetch("/api/billing/entitlements", {
    cache: "no-store",
    headers: authorizationHeaders(accessToken)
  });
  const payload = (await response.json()) as BillingApiResponse & { error?: string };
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Billingstatus konnte nicht geladen werden.");
  }
  if (!payload || typeof payload.plan !== "string" || !payload.billing) {
    throw new Error("Billingstatus konnte nicht sicher gelesen werden.");
  }
  return payload;
}

export function fetchBillingEntitlements(accessToken?: string | null) {
  const requestKey = accessToken ? `authenticated:${accessToken}` : "anonymous";
  const pendingRequest = pendingEntitlementRequests.get(requestKey);
  if (pendingRequest) return pendingRequest;

  const request = loadBillingEntitlements(accessToken);
  pendingEntitlementRequests.set(requestKey, request);
  request.then(
    () => {
      if (pendingEntitlementRequests.get(requestKey) === request) pendingEntitlementRequests.delete(requestKey);
    },
    () => {
      if (pendingEntitlementRequests.get(requestKey) === request) pendingEntitlementRequests.delete(requestKey);
    }
  );
  return request;
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

export function createCheckoutSession(accessToken: string, plan: PaidPlanId, interval: BillingInterval = "month") {
  return billingAction("/api/billing/checkout", accessToken, { plan, interval });
}

export function createPortalSession(accessToken: string) {
  return billingAction("/api/billing/portal", accessToken);
}
