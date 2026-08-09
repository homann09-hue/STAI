import { jsonError, jsonOk, rateLimit, requireSameOrigin } from "@/lib/api-guard";
import { getSupabaseAuth } from "@/lib/supabase/user-data";
import { ensureStripeCustomer, getStripeClient, getStripeReturnUrls } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const originBlocked = requireSameOrigin(request);
  if (originBlocked) return originBlocked;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich, um den Billing-Portal-Zugang zu öffnen.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Stripe ist nicht konfiguriert. Bitte Admins prüfen die SERVER-Umgebungsvariablen.", 503);
  }

  try {
    const customer = await ensureStripeCustomer(stripe, auth.userId, auth.email);
    const { successUrl } = getStripeReturnUrls();
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: successUrl
    });

    return jsonOk({ url: portal.url });
  } catch (error) {
    return jsonError(
      "Billing-Portal konnte nicht geöffnet werden. Bitte prüfe die Stripe-Konfiguration.",
      502,
      { "X-StockPilot-Billing-Error": String((error as Error)?.message ?? "unknown") }
    );
  }
}
