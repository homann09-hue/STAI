import { jsonError, jsonOk, rateLimit } from "@/lib/api-guard";
import { entitledCacheHeaders } from "@/lib/billing/feature-guard";
import { normalizeInvoices, normalizePaymentMethod } from "@/lib/billing/invoices";
import { getUserEntitlements } from "@/lib/billing/server";
import { getStripeClient } from "@/lib/billing/stripe";
import { logEvent } from "@/lib/observability";
import { getSupabaseAuth } from "@/lib/supabase/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INVOICES = 24;

/**
 * Rechnungen und hinterlegte Zahlungsmethode des angemeldeten Kontos.
 *
 * §6 verlangt, dass ein zahlender Nutzer seine Rechnungen im Produkt sieht.
 * Bisher gab es dafür nur den Umweg über das Stripe-Portal.
 *
 * Die Kundennummer kommt ausschließlich aus den serverseitig gelesenen
 * Entitlements, niemals aus der Anfrage. Andernfalls könnte ein Aufrufer die
 * Rechnungen eines fremden Kontos anfordern — das wäre ein IDOR im
 * empfindlichsten Bereich der Anwendung.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  const auth = await getSupabaseAuth(request);
  if (!auth.ok) {
    return jsonError("Anmeldung erforderlich, um Rechnungen zu sehen.", 401, {
      "X-StockPilot-Auth-Reason": auth.reason
    });
  }

  const entitlements = await getUserEntitlements(auth);

  if (entitlements.degraded) {
    return jsonError("Der Abrechnungsstatus lässt sich gerade nicht sicher lesen.", 503, entitledCacheHeaders);
  }

  // Kein Kunde bei Stripe heißt: es gab nie eine Zahlung. Das ist kein Fehler
  // und wird auch nicht als solcher dargestellt.
  if (!entitlements.providerCustomerId) {
    return jsonOk(
      {
        invoices: [],
        paymentMethod: null,
        hasCustomer: false,
        note: "Für dieses Konto liegt keine Zahlung vor. Rechnungen entstehen erst mit dem ersten Abo."
      },
      { headers: entitledCacheHeaders }
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return jsonError("Die Abrechnung ist derzeit nicht erreichbar.", 503, entitledCacheHeaders);
  }

  try {
    const [invoiceList, customer] = await Promise.all([
      stripe.invoices.list({ customer: entitlements.providerCustomerId, limit: MAX_INVOICES }),
      stripe.customers.retrieve(entitlements.providerCustomerId, {
        expand: ["invoice_settings.default_payment_method"]
      })
    ]);

    const defaultPaymentMethod =
      "deleted" in customer && customer.deleted
        ? null
        : (customer as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings
            ?.default_payment_method;

    return jsonOk(
      {
        invoices: normalizeInvoices(invoiceList.data),
        paymentMethod: normalizePaymentMethod(defaultPaymentMethod),
        hasCustomer: true,
        hasMore: invoiceList.has_more === true
      },
      { headers: entitledCacheHeaders }
    );
  } catch (error) {
    logEvent("error", "billing.invoices_failed", {
      userId: auth.userId,
      errorName: error instanceof Error ? error.name : "unknown"
    });
    return jsonError("Rechnungen konnten nicht geladen werden.", 502, entitledCacheHeaders);
  }
}
