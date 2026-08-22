import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = randomUUID().replaceAll("-", "");
const customerId = `cus_concurrency_${suffix}`;
const subscriptionId = `sub_concurrency_${suffix}`;
const priceId = `price_concurrency_${suffix}`;

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

async function apply(args) {
  const { data, error } = await supabase.rpc("apply_stripe_billing_event", args);
  if (error) throw new Error(`${error.code ?? "rpc_error"}:${error.message}`);
  return data;
}

const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
  email: `webhook-concurrency-${suffix}@example.invalid`,
  email_confirm: true
});
if (createError || !createdUser.user) {
  throw new Error(`test_user_create_failed:${createError?.message ?? "missing_user"}`);
}
const userId = createdUser.user.id;

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

  const { data: entitlement, error: entitlementError } = await supabase
    .from("entitlements")
    .select("status,last_provider_event_id,last_provider_event_created_at")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .single();
  if (entitlementError) throw entitlementError;
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

  const { count, error: countError } = await supabase
    .from("billing_events")
    .select("id", { count: "exact", head: true })
    .eq("provider", "stripe")
    .eq("event_id", duplicateArgs.p_event_id);
  if (countError) throw countError;
  assert.equal(count, 1);

} catch (error) {
  testError = error;
}

const { error: cleanupError } = await supabase.auth.admin.deleteUser(userId);
if (testError) throw testError;
if (cleanupError) throw new Error(`test_user_cleanup_failed:${cleanupError.message}`);
process.stdout.write("Atomic Stripe webhook concurrency test passed: 64 out-of-order events, 100 parallel duplicates.\n");
