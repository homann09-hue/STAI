import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { getUserEntitlements } from "@/lib/billing/server";
import {
  getStripeBillingConfiguration,
  getStripeClient,
  getTrustedBillingOrigin
} from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";
import { getSupabaseAuth } from "@/lib/supabase/user-data";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emptyBodySchema = z.object({}).strict();

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;
  const parsed = await parseJsonBody(request, emptyBodySchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich, um ein Abo zu verwalten.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const stripe = getStripeClient();
  const configuration = getStripeBillingConfiguration();
  const appOrigin = getTrustedBillingOrigin(request);
  const entitlement = await getUserEntitlements(auth);
  if (!stripe || !appOrigin || !entitlement.providerCustomerId) {
    return jsonError("Für dieses Konto ist kein verwaltbares Stripe-Abo vorhanden.", 409);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: entitlement.providerCustomerId,
      return_url: `${appOrigin}/pricing`,
      ...(configuration.portalConfigurationId ? { configuration: configuration.portalConfigurationId } : {})
    });
    logEvent("info", "billing.portal_created", { userId: auth.userId });
    return jsonOk({ url: session.url });
  } catch (error) {
    logEvent("error", "billing.portal_failed", {
      userId: auth.userId,
      errorName: error instanceof Error ? error.name : "unknown"
    });
    return jsonError("Kundenportal ist vorübergehend nicht verfügbar.", 502);
  }
}
