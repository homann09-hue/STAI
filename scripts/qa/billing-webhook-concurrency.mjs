import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const serviceHeaders = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json"
};
const suffix = randomUUID().replaceAll("-", "");
const customerId = `cus_concurrency_${suffix}`;
const subscriptionId = `sub_concurrency_${suffix}`;
const priceId = `price_concurrency_${suffix}`;
let userId;

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...serviceHeaders, ...options.headers }
  });
  if (!response.ok) {
    throw new Error(`supabase_request_failed:${response.status}:${path.split("?")[0]}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function eventArguments({ eventId, createdAt, status }) {
  return {
    p_event_id: eventId,
    p_event_type: "customer.subscription.updated",
    p_user_id: userId,
    p_payload_hash: "c".repeat(64),
    p_livemode: false,
    p_provider_created_at: createdAt,
    p_provider_object_id: subscriptionId,
    p_apply_entitlement: true,
    p_ignore_reason: null,
    p_plan: "pro",
    p_status: status,
    p_provider_customer_id: customerId,
    p_provider_subscription_id: subscriptionId,
    p_provider_price_id: priceId,
    p_valid_until: "2027-08-22T00:00:00.000Z",
    p_trial_ends_at: null,
    p_cancel_at_period_end: false,
    p_last_synced_at: createdAt
  };
}

function apply(args) {
  return request("/rest/v1/rpc/apply_stripe_billing_event", {
    method: "POST",
    body: JSON.stringify(args)
  });
}

const createdUserResponse = await request("/auth/v1/admin/users", {
  method: "POST",
  body: JSON.stringify({
    email: `webhook-concurrency-${suffix}@example.invalid`,
    email_confirm: true
  })
});
const createdUser = createdUserResponse?.user ?? createdUserResponse;
if (!createdUser || typeof createdUser.id !== "string") {
  throw new Error("test_user_create_failed");
}
userId = createdUser.id;

let testError = null;
try {
  const events = Array.from({ length: 64 }, (_, index) => {
    const ordinal = String(index).padStart(3, "0");
    return eventArguments({
      eventId: `evt_concurrency_${suffix}_${ordinal}`,
      createdAt: new Date(Date.UTC(2026, 7, 22, 10, 0, index)).toISOString(),
      status: index === 63 ? "past_due" : index % 2 === 0 ? "active" : "trialing"
    });
  });

  const deliberatelyOutOfOrder = [...events].sort((left, right) =>
    String(right.p_event_id).localeCompare(String(left.p_event_id))
  );
  const orderedResults = await Promise.all(deliberatelyOutOfOrder.map(apply));
  assert.equal(orderedResults.length, 64);
  assert.ok(orderedResults.some((result) => result.applied === true));
  assert.ok(orderedResults.some((result) => result.stale === true));

  const entitlement = await request(
    `/rest/v1/entitlements?select=status,last_provider_event_id,last_provider_event_created_at&user_id=eq.${encodeURIComponent(userId)}&provider=eq.stripe`,
    { headers: { accept: "application/vnd.pgrst.object+json" } }
  );
  assert.equal(entitlement.status, "past_due");
  assert.equal(entitlement.last_provider_event_id, events.at(-1).p_event_id);
  assert.equal(
    new Date(entitlement.last_provider_event_created_at).getTime(),
    new Date(events.at(-1).p_provider_created_at).getTime()
  );

  const duplicateArgs = eventArguments({
    eventId: `evt_duplicate_${suffix}`,
    createdAt: "2026-08-22T11:00:00.000Z",
    status: "active"
  });
  const duplicateResults = await Promise.all(Array.from({ length: 100 }, () => apply(duplicateArgs)));
  assert.equal(duplicateResults.filter((result) => result.duplicate === false).length, 1);
  assert.equal(duplicateResults.filter((result) => result.duplicate === true).length, 99);

  const duplicateRows = await request(
    `/rest/v1/billing_events?select=id&provider=eq.stripe&event_id=eq.${encodeURIComponent(duplicateArgs.p_event_id)}`
  );
  assert.equal(duplicateRows.length, 1);
} catch (error) {
  testError = error;
}

let cleanupError = null;
try {
  await request(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
} catch (error) {
  cleanupError = error;
}
if (testError) throw testError;
if (cleanupError) throw cleanupError;
process.stdout.write("Atomic Stripe webhook concurrency test passed: 64 out-of-order events, 100 parallel duplicates.\n");
