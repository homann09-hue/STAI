import { z } from "zod";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { getUserEntitlements } from "@/lib/billing/server";
import {
  getStripeBillingConfiguration,
  getStripeClient,
  getStripePriceId,
  getTrustedBillingOrigin
} from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "premium"]),
  // Monats- und Jahresabo brauchen je eine eigene Preis-ID in Stripe. Ohne
  // Angabe gilt der Monat, damit bestehende Aufrufe unveraendert weiterlaufen.
  interval: z.enum(["month", "year"]).default("month")
});

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;
  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;
  const parsed = await parseJsonBody(request, checkoutSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich, bevor ein Abo gestartet werden kann.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const stripe = getStripeClient();
  const configuration = getStripeBillingConfiguration();
  const priceId = getStripePriceId(parsed.data.plan, parsed.data.interval);
  const appOrigin = getTrustedBillingOrigin(request);
  if (!stripe || !configuration.webhookSecret || !priceId || !appOrigin) {
    return jsonError("Billing ist noch nicht vollständig konfiguriert. Es wurde keine Zahlung gestartet.", 503);
  }

  const entitlement = await getUserEntitlements(auth);
  if (entitlement.degraded) return jsonError("Billingstatus ist derzeit nicht verifizierbar.", 503);
  if (entitlement.billingActive) {
    return jsonError("Ein aktives Abo ist bereits vorhanden. Änderungen erfolgen sicher über das Kundenportal.", 409);
  }

  const metadata = {
    stockpilot_user_id: auth.userId,
    stockpilot_plan: parsed.data.plan,
    stockpilot_interval: parsed.data.interval
  };

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appOrigin}/pricing?billing=success`,
        cancel_url: `${appOrigin}/pricing?billing=canceled`,
        client_reference_id: auth.userId,
        metadata,
        subscription_data: { metadata },
        ...(entitlement.providerCustomerId
          ? { customer: entitlement.providerCustomerId }
          : auth.email
            ? { customer_email: auth.email }
            : {})
      },
      {
        idempotencyKey: `stockpilot-checkout:${auth.userId}:${parsed.data.plan}:${parsed.data.interval}:${Math.floor(Date.now() / 60_000)}`
      }
    );

    if (!session.url) return jsonError("Checkout konnte nicht sicher erstellt werden.", 502);
    logEvent("info", "billing.checkout_created", { userId: auth.userId, plan: parsed.data.plan, interval: parsed.data.interval });
    return jsonOk({ url: session.url });
  } catch (error) {
    logEvent("error", "billing.checkout_failed", {
      userId: auth.userId,
      plan: parsed.data.plan,
      errorName: error instanceof Error ? error.name : "unknown"
    });
    return jsonError("Checkout ist vorübergehend nicht verfügbar. Es wurde keine Freischaltung vorgenommen.", 502);
  }
}
