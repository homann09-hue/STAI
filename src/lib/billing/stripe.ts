import "server-only";
import Stripe from "stripe";
import type { BillingInterval, PaidPlanId } from "@/lib/feature-gates";

export type StripeCheckoutPlan = PaidPlanId;

/**
 * Preis-IDs je Tarif und Abrechnungszeitraum.
 *
 * §5 verlangt monatliche und jaehrliche Abonnements. Beide brauchen in Stripe
 * eine eigene Preis-ID; ein Jahresabo laesst sich nicht aus einem Monatspreis
 * ableiten. Fehlt eine ID, ist der jeweilige Zeitraum schlicht nicht buchbar --
 * ein Knopf ohne hinterlegten Preis waere eine Funktionsattrappe.
 *
 * Exportiert, weil der Adminbereich beim Fehlen einer Variablen ihren **Namen**
 * nennen muss. "Premium jaehrlich ist nicht buchbar" schickt jemanden auf die
 * Suche; "STRIPE_PREMIUM_YEARLY_PRICE_ID fehlt" ist in einer Minute behoben.
 */
export const priceEnvNames: Record<PaidPlanId, Record<BillingInterval, string>> = {
  pro: { month: "STRIPE_PRO_PRICE_ID", year: "STRIPE_PRO_YEARLY_PRICE_ID" },
  premium: { month: "STRIPE_PREMIUM_PRICE_ID", year: "STRIPE_PREMIUM_YEARLY_PRICE_ID" }
};

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
  const portalConfigurationId = validPortalConfigurationId(process.env.STRIPE_PORTAL_CONFIGURATION_ID)
    ? process.env.STRIPE_PORTAL_CONFIGURATION_ID
    : null;
  const entitlementsConfigured = Boolean(secretKey && webhookSecret);

  const priceIds = Object.fromEntries(
    (Object.keys(priceEnvNames) as PaidPlanId[]).map((plan) => [
      plan,
      {
        month: validPriceId(process.env[priceEnvNames[plan].month]) ? process.env[priceEnvNames[plan].month]! : null,
        year: validPriceId(process.env[priceEnvNames[plan].year]) ? process.env[priceEnvNames[plan].year]! : null
      }
    ])
  ) as Record<PaidPlanId, Record<BillingInterval, string | null>>;

  const plans = Object.fromEntries(
    (Object.keys(priceEnvNames) as PaidPlanId[]).map((plan) => [
      plan,
      {
        month: Boolean(entitlementsConfigured && priceIds[plan].month),
        year: Boolean(entitlementsConfigured && priceIds[plan].year)
      }
    ])
  ) as Record<PaidPlanId, Record<BillingInterval, boolean>>;

  return { secretKey, webhookSecret, portalConfigurationId, entitlementsConfigured, priceIds, plans };
}

export function getStripePublicConfiguration() {
  const configuration = getStripeBillingConfiguration();
  const anyBookable = Object.values(configuration.plans).some((intervals) => intervals.month || intervals.year);

  return {
    provider: "stripe" as const,
    configured: anyBookable,
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

export function getStripePriceId(plan: StripeCheckoutPlan, interval: BillingInterval) {
  return getStripeBillingConfiguration().priceIds[plan][interval];
}

/**
 * Von der Preis-ID zurueck zum Tarif.
 *
 * Der Weg ueber die Preis-ID ist verbindlich: die Metadaten einer Subscription
 * lassen sich in Stripe von Hand aendern, der bezahlte Preis nicht.
 */
export function getPlanForStripePriceId(priceId: string): PaidPlanId | null {
  const prices = getStripeBillingConfiguration().priceIds;
  for (const plan of Object.keys(prices) as PaidPlanId[]) {
    if (prices[plan].month === priceId || prices[plan].year === priceId) return plan;
  }
  return null;
}

/**
 * Von der Preis-ID zum Abrechnungsintervall.
 *
 * Der Adminbereich braucht das, um MRR zu rechnen: ein Jahresabo traegt ein
 * Zwoelftel bei, kein volles Monatsentgelt.
 *
 * `null` heisst „nicht zuzuordnen" — etwa weil die Preis-ID aus einem alten
 * Preis stammt, den keine Umgebungsvariable mehr nennt. Solche Abos duerfen
 * nicht stillschweigend als Monatsabo gezaehlt werden; sie gehoeren als
 * ungeklaert ausgewiesen.
 */
export function getIntervalForStripePriceId(priceId: string): BillingInterval | null {
  const prices = getStripeBillingConfiguration().priceIds;
  for (const plan of Object.keys(prices) as PaidPlanId[]) {
    if (prices[plan].month === priceId) return "month";
    if (prices[plan].year === priceId) return "year";
  }
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

/**
 * Sucht oder erzeugt den Stripe-Kunden zu einem Nutzer.
 *
 * Aus der parallel auf `main` entstandenen Fassung übernommen — dort war die
 * Reihenfolge sauberer als meine: den Kunden ausdrücklich anlegen und an die
 * Nutzer-ID binden, statt Stripe aus `customer_email` einen erzeugen zu lassen.
 * Das macht die Zuordnung später nachvollziehbar, etwa bei Rechnungen.
 *
 * Zwei Änderungen gegenüber dem Original:
 *
 * 1. Der dortige innere Zweig `if (matching.metadata?.supabase_user_id !== userId)`
 *    konnte **nie** zutreffen — `matching` war ja gerade daran erkannt worden.
 *    Toter Code nach §90, deshalb nicht mitkopiert.
 * 2. Der Metadatenschlüssel heißt `stockpilot_user_id` wie im Checkout. Zwei
 *    Namen für dieselbe Zuordnung wären eine Fehlerquelle beim Zuordnen von
 *    Zahlungen.
 */
export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function ensureStripeCustomer(stripe: Stripe, userId: string, email: string | null) {
  if (!isValidEmail(email)) {
    throw new Error("Ungültige Kunden-E-Mail. Ohne gültige Adresse wird kein Stripe-Kunde angelegt.");
  }

  const customers = await stripe.customers.list({ email, limit: 10 });

  const byUserId = customers.data.find((customer) => customer.metadata?.stockpilot_user_id === userId);
  if (byUserId) return byUserId;

  // Gleiche Adresse, aber noch ohne Zuordnung: nachtragen statt einen zweiten
  // Kunden anlegen -- doppelte Kunden zu derselben Adresse machen jede spaetere
  // Rechnungszuordnung mehrdeutig.
  const byEmail = customers.data.find(
    (customer) => customer.email === email && !customer.metadata?.stockpilot_user_id
  );
  if (byEmail) {
    return stripe.customers.update(byEmail.id, {
      metadata: { ...byEmail.metadata, stockpilot_user_id: userId }
    });
  }

  return stripe.customers.create({ email, metadata: { stockpilot_user_id: userId } });
}
