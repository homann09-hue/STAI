import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  assertSafeStripeTestmodeEnvironment,
  assertStripePortalUrl,
  buildSignedWebhookPayload,
  extractTestCheckoutSessionId
} from "./stripe-testmode-e2e-lib.mjs";

const config = assertSafeStripeTestmodeEnvironment();
await access(".next/BUILD_ID");

const stripe = new Stripe(config.secretKey, {
  appInfo: { name: "StockPilot Stripe Testmode E2E" },
  maxNetworkRetries: 2,
  timeout: 20_000
});
const admin = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const publicClient = createClient(config.supabaseUrl, config.publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const runId = randomUUID().replaceAll("-", "");
const email = `stripe-e2e-${runId}@example.invalid`;
const password = `Stai-${randomBytes(24).toString("base64url")}!`;
const createdAt = Math.floor(Date.now() / 1000);
const resources = {
  checkoutSessions: [],
  customerId: null,
  portalConfigurationId: null,
  priceId: null,
  productId: null,
  recoveryCustomerId: null,
  recoverySubscriptionId: null,
  recoveryTestClockId: null,
  recoveryUserId: null,
  server: null,
  subscriptionId: null,
  userId: null
};
const serverLog = [];

function rememberServerLog(chunk) {
  serverLog.push(...String(chunk).split("\n").filter(Boolean));
  if (serverLog.length > 80) serverLog.splice(0, serverLog.length - 80);
}

async function appRequest(path, { body, method = "GET", token, accepted = [200] } = {}) {
  const response = await fetch(`${config.appUrl}${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      origin: config.appUrl
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { nonJsonResponse: true };
    }
  }
  const safeReason = typeof payload?.error === "string" ? `: ${payload.error}` : "";
  assert.ok(accepted.includes(response.status), `Unexpected ${response.status} response from ${path}${safeReason}`);
  return { payload, status: response.status };
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${config.appUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Startup connection errors are expected until Next is listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("StockPilot test server did not become ready");
}

async function waitForEntitlement(token, plan, billingActive) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const { payload } = await appRequest("/api/billing/entitlements", { token });
    if (payload?.plan === plan && payload?.billingActive === billingActive) return payload;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Entitlement did not converge to ${plan}/${billingActive}`);
}

async function waitForTestClockReady(testClockId, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const clock = await stripe.testHelpers.testClocks.retrieve(testClockId);
    if (clock.status === "ready") return clock;
    if (clock.status === "internal_failure") throw new Error("Stripe test clock entered internal_failure");
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Stripe test clock did not become ready");
}

async function waitForSubscriptionStatus(subscriptionId, expectedStatus, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
    if (subscription.status === expectedStatus) return subscription;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Stripe subscription did not converge to ${expectedStatus}`);
}

async function sendWebhook(object, type, ordinal, eventId = `evt_stai_${runId}_${ordinal}`) {
  const timestamp = createdAt + ordinal;
  const payload = buildSignedWebhookPayload({ eventId, created: timestamp, object, type });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: config.webhookSecret,
    timestamp
  });
  const response = await fetch(`${config.appUrl}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: payload
  });
  assert.equal(response.status, 200, `Webhook ${type} failed with HTTP ${response.status}`);
  return eventId;
}

async function stopServer() {
  const server = resources.server;
  if (!server || server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

async function cleanup() {
  const failures = [];
  const attempt = async (label, operation) => {
    try {
      await operation();
    } catch (error) {
      if (error?.code === "resource_missing") return;
      failures.push(label);
    }
  };

  await stopServer();
  for (const sessionId of resources.checkoutSessions) {
    await attempt("checkout session", async () => {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
    });
  }
  if (resources.subscriptionId) {
    await attempt("subscription", async () => {
      const subscription = await stripe.subscriptions.retrieve(resources.subscriptionId);
      if (subscription.status !== "canceled") await stripe.subscriptions.cancel(subscription.id);
    });
  }
  if (resources.recoverySubscriptionId) {
    await attempt("recovery subscription", async () => {
      const subscription = await stripe.subscriptions.retrieve(resources.recoverySubscriptionId);
      if (subscription.status !== "canceled") await stripe.subscriptions.cancel(subscription.id);
    });
  }
  if (resources.recoveryCustomerId) {
    await attempt("recovery customer", () => stripe.customers.del(resources.recoveryCustomerId));
  }
  if (resources.recoveryTestClockId) {
    await attempt("recovery test clock", () => stripe.testHelpers.testClocks.del(resources.recoveryTestClockId));
  }
  if (resources.customerId) {
    await attempt("customer", () => stripe.customers.del(resources.customerId));
  }
  if (resources.priceId) {
    await attempt("price", () => stripe.prices.update(resources.priceId, { active: false }));
  }
  if (resources.productId) {
    await attempt("product", () => stripe.products.update(resources.productId, { active: false }));
  }
  if (resources.portalConfigurationId) {
    await attempt("portal configuration", () =>
      stripe.billingPortal.configurations.update(resources.portalConfigurationId, { active: false })
    );
  }
  if (resources.userId) {
    await attempt("Supabase test user", async () => {
      const { error } = await admin.auth.admin.deleteUser(resources.userId);
      if (error) throw error;
    });
  }
  if (resources.recoveryUserId) {
    await attempt("Supabase recovery test user", async () => {
      const { error } = await admin.auth.admin.deleteUser(resources.recoveryUserId);
      if (error) throw error;
    });
  }
  if (failures.length > 0) throw new Error(`Cleanup failed for: ${failures.join(", ")}`);
}

let testFailure = null;
try {
  const product = await stripe.products.create({
    name: `StockPilot Pro E2E ${runId.slice(0, 8)}`,
    metadata: { stockpilot_test_run: runId }
  });
  resources.productId = product.id;
  assert.equal(product.livemode, false);

  const price = await stripe.prices.create({
    currency: "eur",
    product: product.id,
    recurring: { interval: "month" },
    unit_amount: 1999,
    metadata: { stockpilot_plan: "pro", stockpilot_test_run: runId }
  });
  resources.priceId = price.id;
  assert.equal(price.livemode, false);

  const portalConfiguration = await stripe.billingPortal.configurations.create({
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" }
    },
    metadata: { stockpilot_test_run: runId }
  });
  resources.portalConfigurationId = portalConfiguration.id;
  assert.equal(portalConfiguration.livemode, false);

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { stockpilot_test_run: runId }
  });
  if (createUserError) throw createUserError;
  assert.ok(createdUser.user?.id);
  resources.userId = createdUser.user.id;

  const { data: sessionData, error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const accessToken = sessionData.session?.access_token;
  assert.ok(accessToken, "Supabase test session was not created");

  const serverUrl = new URL(config.appUrl);
  resources.server = spawn("npm", ["run", "start", "--", "-p", serverUrl.port, "-H", serverUrl.hostname], {
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: config.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.publishableKey,
      ["SUPABASE_SECRET_KEY"]: config.serviceRoleKey,
      ["SUPABASE_SERVICE_ROLE_KEY"]: config.serviceRoleKey,
      STOCKPILOT_APP_URL: config.appUrl,
      ["STRIPE_SECRET_KEY"]: config.secretKey,
      STRIPE_WEBHOOK_SECRET: config.webhookSecret,
      STRIPE_PRO_PRICE_ID: price.id,
      STRIPE_PORTAL_CONFIGURATION_ID: portalConfiguration.id,
      MARKET_DATA_PROVIDER: "mock",
      STOCKPILOT_MARKET_PROVIDER: "mock",
      STOCKPILOT_NEWS_PROVIDER: "mock",
      STOCKPILOT_FUNDAMENTALS_PROVIDER: "mock",
      STOCKPILOT_AI_PROVIDER: "mock",
      STOCKPILOT_ALLOW_TEST_FIXTURES: "true",
      NEXT_TELEMETRY_DISABLED: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  resources.server.stdout.on("data", rememberServerLog);
  resources.server.stderr.on("data", rememberServerLog);
  await waitForServer();

  const checkout = await appRequest("/api/billing/checkout", {
    method: "POST",
    token: accessToken,
    body: { plan: "pro" }
  });
  assert.equal(typeof checkout.payload?.url, "string", "Checkout response did not contain a URL");
  const firstCheckoutId = extractTestCheckoutSessionId(checkout.payload.url);
  resources.checkoutSessions.push(firstCheckoutId);
  const checkoutSession = await stripe.checkout.sessions.retrieve(firstCheckoutId);
  assert.equal(checkoutSession.livemode, false);
  assert.equal(checkoutSession.mode, "subscription");
  assert.equal(typeof checkoutSession.customer, "string");
  resources.customerId = checkoutSession.customer;

  const primaryPaymentMethod = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: resources.customerId
  });
  await stripe.customers.update(resources.customerId, {
    invoice_settings: { default_payment_method: primaryPaymentMethod.id }
  });
  const subscription = await stripe.subscriptions.create({
    customer: resources.customerId,
    items: [{ price: price.id }],
    metadata: { stockpilot_plan: "pro", stockpilot_user_id: resources.userId },
    payment_behavior: "error_if_incomplete"
  });
  resources.subscriptionId = subscription.id;
  assert.equal(subscription.livemode, false);
  assert.equal(subscription.status, "active");

  await sendWebhook(subscription, "customer.subscription.created", 1);
  await waitForEntitlement(accessToken, "pro", true);

  const portal = await appRequest("/api/billing/portal", {
    method: "POST",
    token: accessToken,
    body: {}
  });
  assert.equal(typeof portal.payload?.url, "string", "Portal response did not contain a URL");
  assertStripePortalUrl(portal.payload.url);

  const pastDueSubscription = { ...subscription, status: "past_due" };
  await sendWebhook(pastDueSubscription, "customer.subscription.updated", 2);
  await waitForEntitlement(accessToken, "free", false);

  const recovery = await appRequest("/api/billing/checkout", {
    method: "POST",
    token: accessToken,
    body: { plan: "pro" },
    accepted: [200, 409]
  });
  if (recovery.status === 200) {
    assert.equal(typeof recovery.payload?.url, "string", "Recovery response did not contain a portal URL");
    assertStripePortalUrl(recovery.payload.url);
  }

  await sendWebhook(subscription, "customer.subscription.updated", 3);
  await waitForEntitlement(accessToken, "pro", true);

  const canceledSubscription = await stripe.subscriptions.cancel(subscription.id);
  await sendWebhook(canceledSubscription, "customer.subscription.deleted", 4);
  await waitForEntitlement(accessToken, "free", false);

  const duplicateEventId = `evt_stai_${runId}_duplicate`;
  await sendWebhook(canceledSubscription, "customer.subscription.deleted", 5, duplicateEventId);
  await sendWebhook(canceledSubscription, "customer.subscription.deleted", 5, duplicateEventId);
  await waitForEntitlement(accessToken, "free", false);

  const resumedCheckout = await appRequest("/api/billing/checkout", {
    method: "POST",
    token: accessToken,
    body: { plan: "pro" }
  });
  assert.equal(typeof resumedCheckout.payload?.url, "string");
  const resumedCheckoutId = extractTestCheckoutSessionId(resumedCheckout.payload.url);
  resources.checkoutSessions.push(resumedCheckoutId);

  const deletionSubscription = await stripe.subscriptions.create({
    customer: resources.customerId,
    items: [{ price: price.id }],
    metadata: { stockpilot_plan: "pro", stockpilot_user_id: resources.userId },
    payment_behavior: "error_if_incomplete"
  });
  resources.subscriptionId = deletionSubscription.id;
  assert.equal(deletionSubscription.status, "active");
  await sendWebhook(deletionSubscription, "customer.subscription.created", 6);
  await waitForEntitlement(accessToken, "pro", true);

  const deletedUserId = resources.userId;
  const deletion = await appRequest("/api/account", {
    method: "DELETE",
    token: accessToken,
    body: { confirmation: "KONTO LÖSCHEN" }
  });
  assert.equal(deletion.payload?.deleted, true, "Account deletion did not complete");
  assert.equal(typeof deletion.payload?.deletionId, "string", "Deletion response did not contain its saga ID");

  const canceledAfterDeletion = await stripe.subscriptions.retrieve(deletionSubscription.id);
  assert.equal(canceledAfterDeletion.status, "canceled", "Account deletion left an active Stripe subscription");
  const expiredAfterDeletion = await stripe.checkout.sessions.retrieve(resumedCheckoutId);
  assert.equal(expiredAfterDeletion.status, "expired", "Account deletion left an open Checkout Session");

  const { data: deletedUserLookup, error: deletedUserError } = await admin.auth.admin.getUserById(deletedUserId);
  assert.ok(deletedUserError || !deletedUserLookup.user, "Supabase identity survived completed account deletion");

  const { data: deletionJob, error: deletionJobError } = await admin
    .from("account_deletion_jobs")
    .select("id,status,user_id,stripe_customer_ids,cancelled_subscription_ids")
    .eq("id", deletion.payload.deletionId)
    .single();
  if (deletionJobError) throw deletionJobError;
  assert.equal(deletionJob.status, "completed");
  assert.equal(deletionJob.user_id, null);
  assert.ok(deletionJob.stripe_customer_ids.includes(resources.customerId));
  assert.ok(deletionJob.cancelled_subscription_ids.includes(deletionSubscription.id));

  const lateEventId = await sendWebhook(deletionSubscription, "customer.subscription.updated", 7);
  const { data: revivedEntitlements, error: revivedEntitlementsError } = await admin
    .from("entitlements")
    .select("id")
    .eq("user_id", deletedUserId);
  if (revivedEntitlementsError) throw revivedEntitlementsError;
  assert.deepEqual(revivedEntitlements, [], "Late webhook recreated an entitlement for a deleted account");

  const { data: lateEvent, error: lateEventError } = await admin
    .from("billing_events")
    .select("applied,processing_reason,user_id")
    .eq("provider", "stripe")
    .eq("event_id", lateEventId)
    .single();
  if (lateEventError) throw lateEventError;
  assert.equal(lateEvent.applied, false);
  assert.equal(lateEvent.processing_reason, "account_deleted");
  assert.equal(lateEvent.user_id, null);
  resources.userId = null;

  const recoveryEmail = `stripe-recovery-${runId}@example.invalid`;
  const { data: recoveryUser, error: recoveryUserError } = await admin.auth.admin.createUser({
    email: recoveryEmail,
    password,
    email_confirm: true,
    user_metadata: { stockpilot_test_run: runId, purpose: "stripe_dunning" }
  });
  if (recoveryUserError) throw recoveryUserError;
  assert.ok(recoveryUser.user?.id);
  resources.recoveryUserId = recoveryUser.user.id;

  const { data: recoverySession, error: recoverySignInError } = await publicClient.auth.signInWithPassword({
    email: recoveryEmail,
    password
  });
  if (recoverySignInError) throw recoverySignInError;
  const recoveryAccessToken = recoverySession.session?.access_token;
  assert.ok(recoveryAccessToken, "Supabase recovery test session was not created");

  const recoveryFrozenTime = Math.floor(Date.now() / 1000);
  const recoveryClock = await stripe.testHelpers.testClocks.create({
    frozen_time: recoveryFrozenTime,
    name: `StockPilot dunning ${runId.slice(0, 8)}`
  });
  resources.recoveryTestClockId = recoveryClock.id;
  assert.equal(recoveryClock.livemode, false);

  const recoveryCustomer = await stripe.customers.create({
    email: recoveryEmail,
    metadata: { stockpilot_test_run: runId, stockpilot_user_id: resources.recoveryUserId },
    test_clock: recoveryClock.id
  });
  resources.recoveryCustomerId = recoveryCustomer.id;
  assert.equal(recoveryCustomer.livemode, false);
  const failingPaymentMethod = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", {
    customer: recoveryCustomer.id
  });
  await stripe.customers.update(recoveryCustomer.id, {
    invoice_settings: { default_payment_method: failingPaymentMethod.id }
  });

  const recoveryTrialEnd = recoveryFrozenTime + 3_600;
  const recoverySubscription = await stripe.subscriptions.create({
    customer: recoveryCustomer.id,
    items: [{ price: price.id }],
    metadata: { stockpilot_plan: "pro", stockpilot_user_id: resources.recoveryUserId },
    trial_end: recoveryTrialEnd
  });
  resources.recoverySubscriptionId = recoverySubscription.id;
  assert.equal(recoverySubscription.status, "trialing");
  await sendWebhook(recoverySubscription, "customer.subscription.created", 8);
  await waitForEntitlement(recoveryAccessToken, "pro", true);

  await stripe.testHelpers.testClocks.advance(recoveryClock.id, { frozen_time: recoveryTrialEnd + 60 });
  await waitForTestClockReady(recoveryClock.id);
  await stripe.testHelpers.testClocks.advance(recoveryClock.id, { frozen_time: recoveryTrialEnd + 3_700 });
  await waitForTestClockReady(recoveryClock.id);
  const pastDueFromStripe = await waitForSubscriptionStatus(recoverySubscription.id, "past_due");
  await sendWebhook(pastDueFromStripe, "customer.subscription.updated", 9);
  await waitForEntitlement(recoveryAccessToken, "free", false);

  const recoveryPaymentMethod = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: recoveryCustomer.id
  });
  await stripe.customers.update(recoveryCustomer.id, {
    invoice_settings: { default_payment_method: recoveryPaymentMethod.id }
  });
  const latestInvoice = pastDueFromStripe.latest_invoice;
  const latestInvoiceId = typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id;
  assert.ok(latestInvoiceId, "Past-due subscription did not expose its latest invoice");
  await stripe.invoices.pay(latestInvoiceId, { payment_method: recoveryPaymentMethod.id });
  const recoveredFromStripe = await waitForSubscriptionStatus(recoverySubscription.id, "active");
  await sendWebhook(recoveredFromStripe, "customer.subscription.updated", 10);
  await waitForEntitlement(recoveryAccessToken, "pro", true);

  const canceledRecoverySubscription = await stripe.subscriptions.cancel(recoverySubscription.id);
  await sendWebhook(canceledRecoverySubscription, "customer.subscription.deleted", 11);
  await waitForEntitlement(recoveryAccessToken, "free", false);
} catch (error) {
  testFailure = error;
}

let cleanupFailure = null;
try {
  await cleanup();
} catch (error) {
  cleanupFailure = error;
}

if (testFailure) {
  if (serverLog.length > 0) process.stderr.write(`${serverLog.join("\n")}\n`);
  throw testFailure;
}
if (cleanupFailure) throw cleanupFailure;
process.stdout.write(
  "Stripe testmode E2E passed: checkout, entitlement, real test-clock dunning and recovery, cancellation, account deletion and late-webhook isolation.\n"
);
