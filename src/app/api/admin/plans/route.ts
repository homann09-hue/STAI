import { jsonOk, rateLimit } from "@/lib/api-guard";
import { hasPrivilegedAccess } from "@/lib/admin-access";
import { requireAdmin } from "@/lib/billing/admin-guard";
import { assessPlanReadiness } from "@/lib/billing/plan-readiness";
import { getStripeBillingConfiguration, priceEnvNames } from "@/lib/billing/stripe";
import { featureDefinitions, paidPlanIds, pricingTiers } from "@/lib/feature-gates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "cache-control": "no-store, private", "x-content-type-options": "nosniff" };

/**
 * Tarife, Grenzen und die Frage, ob sie sich überhaupt kaufen lassen.
 *
 * Die Antwort ist bewusst **beschreibend und nicht einstellbar**. Warum, gehört
 * hierher, weil die Anforderung „Tarife und Limits einstellen" lautete:
 *
 * Die Grenzen werden an jeder Stelle synchron über `getPlanLimits` gelesen —
 * beim Rendern, beim Prüfen, beim Durchsetzen. Sie zur Laufzeit veränderbar zu
 * machen hieße entweder, diesen Aufruf überall asynchron zu machen, oder einen
 * zwischengespeicherten Stand zu halten. Ein solcher Zwischenspeicher ist genau
 * dann falsch, wenn es darauf ankommt: nach einer Verschärfung liefe die alte,
 * großzügigere Grenze weiter — eine Bezahlschranke, die ins Leere greift.
 *
 * Preise sind noch heikler: die verbindliche Zahl steht bei Stripe. Ein hier
 * geänderter Preis würde die Verkaufsseite ändern, aber nicht die Abbuchung —
 * die Seite würde also etwas anderes versprechen, als abgerechnet wird. Das ist
 * kein Konfigurationsfehler mehr, sondern eine falsche Preisangabe.
 *
 * Was diese Route stattdessen liefert, ist die Auskunft, die heute an keiner
 * Stelle zu bekommen ist: welcher beworbene Tarif tatsächlich buchbar ist und
 * welche Umgebungsvariable dafür fehlt.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(request);
  if (limited) return limited;

  if (!hasPrivilegedAccess(request, "admin")) {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
  }

  const configuration = getStripeBillingConfiguration();

  const readiness = assessPlanReadiness({
    hasSecretKey: Boolean(configuration.secretKey),
    hasWebhookSecret: Boolean(configuration.webhookSecret),
    priceIds: configuration.priceIds,
    paidPlans: paidPlanIds,
    priceEnvNames
  });

  const plans = pricingTiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    audience: tier.audience,
    pricing: tier.pricing,
    limits: tier.limits,
    billingRequired: tier.billingRequired,
    includedFeatures: featureDefinitions
      .filter((feature) => tier.featureStatus[feature.id] === "included")
      .map((feature) => feature.id),
    // Status `demo` heißt in diesem Katalog: im vorgesehenen Tarif sichtbar
    // angekündigt, aber nicht gebaut. Für den Betreiber ist das die wichtigere
    // Zahl von beiden — es ist die Liste dessen, was beworben und nicht
    // geliefert wird.
    announcedNotBuilt: featureDefinitions
      .filter((feature) => tier.featureStatus[feature.id] === "demo")
      .map((feature) => feature.id)
  }));

  return jsonOk(
    {
      plans,
      readiness,
      // Ausdruecklich benannt, damit niemand im Adminbereich nach einem
      // Bearbeitungsknopf sucht, den es aus gutem Grund nicht gibt.
      editable: false,
      editableNote:
        "Tarife und Grenzen stehen im Code und werden bei jeder Prüfung synchron gelesen. Eine Änderung zur Laufzeit würde entweder veraltete Grenzen durchsetzen oder einen Preis anzeigen, der von der Abbuchung abweicht. Änderungen laufen deshalb über eine Codeänderung — sichtbar, überprüfbar und mit Tests abgesichert."
    },
    { headers: privateHeaders }
  );
}
