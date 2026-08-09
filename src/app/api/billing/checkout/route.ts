import { z } from "zod";
import { jsonError, jsonOk, parseJsonBody, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { getSupabaseAuth } from "@/lib/supabase/user-data";
import { ensureStripeCustomer, getStripeClient, getStripePriceId, getStripeReturnUrls, getStripeWebhookSecret } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/feature-gates";

const checkoutSchema = z.object({ plan: z.enum(["starter", "pro", "elite"]) });
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const parsed = await parseJsonBody(request, checkoutSchema);
  if (!parsed.ok) return parsed.response;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich, um ein Abonnement zu starten.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Stripe ist nicht konfiguriert. Bitte Admins prüfen die SERVER-Umgebungsvariablen.", 503);
  }

  const priceId = getStripePriceId(parsed.data.plan as PlanId);
  if (!priceId) {
    return jsonError("Der ausgewählte Plan ist nicht verfügbar. Bitte prüfe die Stripe-Preis-Konfiguration.", 500);
  }

  try {
    const customer = await ensureStripeCustomer(stripe, auth.userId, auth.email);
    const { successUrl, cancelUrl } = getStripeReturnUrls();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      client_reference_id: auth.userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          supabase_user_id: auth.userId,
          plan: parsed.data.plan
        }
      }
    });

    return jsonOk({ url: session.url });
  } catch (error) {
    return jsonError(
      "Checkout konnte nicht gestartet werden. Bitte prüfe die Stripe-Konfiguration.",
      502,
      { "X-StockPilot-Billing-Error": String((error as Error)?.message ?? "unknown") }
    );
  }
}
