import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function requireValue(environment, name) {
  const value = environment[name]?.trim();
  assert.ok(value, `${name} is required`);
  return value;
}

function requireLocalHttpUrl(environment, name) {
  const value = requireValue(environment, name);
  const url = new URL(value);
  assert.equal(url.protocol, "http:", `${name} must use HTTP for this local-only harness`);
  assert.ok(LOCAL_HOSTS.has(url.hostname), `${name} must target localhost`);
  assert.equal(url.username, "", `${name} must not contain credentials`);
  assert.equal(url.password, "", `${name} must not contain credentials`);
  return url.toString().replace(/\/$/, "");
}

export function assertSafeStripeTestmodeEnvironment(environment = process.env) {
  const secretKey = requireValue(environment, "STRIPE_TESTMODE_E2E_SECRET_KEY");
  assert.match(secretKey, /^(?:sk|rk)_test_[A-Za-z0-9_]+$/, "Stripe key must be a testmode key");
  assert.ok(!secretKey.includes("_live_"), "Live Stripe keys are forbidden");

  const appUrl = requireLocalHttpUrl(environment, "STRIPE_TESTMODE_E2E_APP_URL");
  const supabaseUrl = requireLocalHttpUrl(environment, "SUPABASE_URL");
  const serviceRoleKey = requireValue(environment, "SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey =
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    environment.SUPABASE_ANON_KEY?.trim();
  assert.ok(publishableKey, "A local Supabase publishable/anon key is required");

  const webhookSecret = environment.STRIPE_TESTMODE_E2E_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    assert.match(webhookSecret, /^whsec_[A-Za-z0-9_-]+$/, "Webhook secret must use the whsec_ prefix");
  }

  return {
    appUrl,
    publishableKey,
    secretKey,
    serviceRoleKey,
    supabaseUrl,
    webhookSecret: webhookSecret || `whsec_${randomUUID().replaceAll("-", "")}`
  };
}

export function extractTestCheckoutSessionId(checkoutUrl) {
  const url = new URL(checkoutUrl);
  assert.ok(
    url.hostname === "checkout.stripe.com" || url.hostname.endsWith(".checkout.stripe.com"),
    "Checkout URL must target Stripe Checkout"
  );
  const sessionId = url.pathname.match(/\b(cs_test_[A-Za-z0-9_]+)\b/)?.[1];
  assert.ok(sessionId, "Checkout URL must contain a testmode session ID");
  return sessionId;
}

export function assertStripePortalUrl(portalUrl) {
  const url = new URL(portalUrl);
  assert.ok(
    url.hostname === "billing.stripe.com" || url.hostname.endsWith(".billing.stripe.com"),
    "Portal URL must target Stripe Billing"
  );
  return url.toString();
}

export function buildSignedWebhookPayload({ eventId, created, object, type }) {
  assert.match(eventId, /^evt_[A-Za-z0-9_]+$/, "Event ID is invalid");
  assert.equal(Number.isInteger(created), true, "Event timestamp must be an integer");
  assert.equal(object?.livemode, false, "Only Stripe testmode objects are allowed");

  return JSON.stringify({
    id: eventId,
    object: "event",
    api_version: null,
    created,
    data: { object },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type
  });
}
