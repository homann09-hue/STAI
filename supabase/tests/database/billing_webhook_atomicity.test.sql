begin;
select plan(27);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'entitlements'
      and column_name = 'last_provider_event_created_at'
  ),
  'entitlements retain the provider ordering timestamp'
);
select is(
  (
    select count(*)::integer from information_schema.columns
    where table_schema = 'public' and table_name = 'billing_events'
      and column_name in ('provider_object_id', 'applied', 'processing_reason')
  ),
  3,
  'billing evidence records object, application outcome and reason'
);
select has_index(
  'public',
  'billing_events',
  'billing_events_object_created_idx',
  'billing object chronology is indexed'
);
select ok(
  to_regprocedure('public.apply_stripe_billing_event(text,text,uuid,text,boolean,timestamptz,text,boolean,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)') is not null,
  'atomic Stripe billing function exists'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.apply_stripe_billing_event(text,text,uuid,text,boolean,timestamptz,text,boolean,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)',
    'EXECUTE'
  ),
  'service role may execute the atomic billing function'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.apply_stripe_billing_event(text,text,uuid,text,boolean,timestamptz,text,boolean,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)',
    'EXECUTE'
  ),
  'anonymous clients cannot execute the atomic billing function'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_stripe_billing_event(text,text,uuid,text,boolean,timestamptz,text,boolean,text,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)',
    'EXECUTE'
  ),
  'authenticated clients cannot execute the atomic billing function'
);

insert into auth.users (id, email) values
  ('55555555-5555-4555-8555-555555555555', 'webhook-atomic-a@example.invalid'),
  ('66666666-6666-4666-8666-666666666666', 'webhook-atomic-b@example.invalid');

insert into public.billing_events (
  provider, event_id, event_type, status, user_id, payload_hash, livemode, provider_created_at
) values (
  'manual', 'manual_atomicity_unspecified', 'admin.plan_granted', 'processed',
  '55555555-5555-4555-8555-555555555555', repeat('d', 64), true, now()
);
select results_eq(
  $$select applied from public.billing_events where provider = 'manual' and event_id = 'manual_atomicity_unspecified'$$,
  $$values (null::boolean)$$,
  'legacy manual evidence does not claim Stripe transaction semantics'
);

create function pg_temp.apply_test_event(
  p_event_id text,
  p_user_id uuid,
  p_created_at timestamptz,
  p_status text,
  p_plan text default 'pro',
  p_customer_id text default 'cus_atomic_a',
  p_subscription_id text default 'sub_atomic_a',
  p_price_id text default 'price_atomic_pro'
)
returns jsonb
language sql
as $$
  select public.apply_stripe_billing_event(
    p_event_id,
    'customer.subscription.updated',
    p_user_id,
    repeat('a', 64),
    false,
    p_created_at,
    p_subscription_id,
    true,
    null,
    p_plan,
    p_status,
    p_customer_id,
    p_subscription_id,
    p_price_id,
    '2027-08-22T00:00:00Z'::timestamptz,
    null,
    false,
    p_created_at
  );
$$;

select is(
  (pg_temp.apply_test_event(
    'evt_atomic_initial',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T10:00:00Z',
    'active'
  )->>'applied')::boolean,
  true,
  'first verified event applies'
);
select results_eq(
  $$select plan, status, last_provider_event_id, last_provider_event_created_at
    from public.entitlements
    where user_id = '55555555-5555-4555-8555-555555555555' and provider = 'stripe'$$,
  $$values ('pro'::text, 'active'::text, 'evt_atomic_initial'::text, '2026-08-22T10:00:00Z'::timestamptz)$$,
  'first event creates the ordered entitlement state'
);
select results_eq(
  $$select status, applied, processing_reason
    from public.billing_events
    where provider = 'stripe' and event_id = 'evt_atomic_initial'$$,
  $$values ('processed'::text, true, null::text)$$,
  'first event and its applied outcome are immutable evidence'
);

select is(
  (pg_temp.apply_test_event(
    'evt_atomic_initial',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T10:00:00Z',
    'canceled',
    'premium'
  )->>'duplicate')::boolean,
  true,
  'replay of the same provider event is idempotent'
);
select results_eq(
  $$select count(*) from public.billing_events where provider = 'stripe' and event_id = 'evt_atomic_initial'$$,
  array[1::bigint],
  'replay creates exactly one ledger row'
);
select results_eq(
  $$select plan, status from public.entitlements
    where user_id = '55555555-5555-4555-8555-555555555555' and provider = 'stripe'$$,
  $$values ('pro'::text, 'active'::text)$$,
  'replay cannot mutate entitlement state'
);

select is(
  (pg_temp.apply_test_event(
    'evt_newer',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T12:00:00Z',
    'canceled'
  )->>'applied')::boolean,
  true,
  'newer provider event applies'
);
select results_eq(
  $$select status, last_provider_event_id from public.entitlements
    where user_id = '55555555-5555-4555-8555-555555555555' and provider = 'stripe'$$,
  $$values ('canceled'::text, 'evt_newer'::text)$$,
  'newer event becomes authoritative'
);

select is(
  (pg_temp.apply_test_event(
    'evt_older',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T11:00:00Z',
    'active'
  )->>'stale')::boolean,
  true,
  'late arrival of an older event is classified stale'
);
select results_eq(
  $$select status, last_provider_event_id from public.entitlements
    where user_id = '55555555-5555-4555-8555-555555555555' and provider = 'stripe'$$,
  $$values ('canceled'::text, 'evt_newer'::text)$$,
  'older event cannot overwrite newer entitlement state'
);
select results_eq(
  $$select status, applied, processing_reason from public.billing_events
    where provider = 'stripe' and event_id = 'evt_older'$$,
  $$values ('ignored'::text, false, 'stale_event'::text)$$,
  'stale event remains visible as non-applied evidence'
);

select is(
  (pg_temp.apply_test_event(
    'evt_z_tie',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T12:00:00Z',
    'past_due'
  )->>'applied')::boolean,
  true,
  'event ID provides a deterministic tie-break at equal provider time'
);
select is(
  (pg_temp.apply_test_event(
    'evt_a_tie',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T12:00:00Z',
    'active'
  )->>'stale')::boolean,
  true,
  'lower tie-break event cannot overwrite equal-time state'
);
select results_eq(
  $$select status, last_provider_event_id from public.entitlements
    where user_id = '55555555-5555-4555-8555-555555555555' and provider = 'stripe'$$,
  $$values ('past_due'::text, 'evt_z_tie'::text)$$,
  'equal-time ordering remains deterministic'
);

select throws_ok(
  $$select pg_temp.apply_test_event(
    'evt_unknown_price',
    '55555555-5555-4555-8555-555555555555',
    '2026-08-22T13:00:00Z',
    'active',
    'pro',
    'cus_atomic_a',
    'sub_atomic_a',
    null
  )$$,
  '22023',
  'stripe_webhook_invalid_entitlement',
  'missing or unknown price input fails closed'
);
select results_eq(
  $$select count(*) from public.billing_events where provider = 'stripe' and event_id = 'evt_unknown_price'$$,
  array[0::bigint],
  'rejected price input creates no misleading evidence'
);

create temp table webhook_atomic_result (caught boolean not null);
do $$
begin
  perform pg_temp.apply_test_event(
    'evt_atomic_rollback',
    '66666666-6666-4666-8666-666666666666',
    '2026-08-22T14:00:00Z',
    'active',
    'pro',
    'cus_atomic_a',
    'sub_atomic_b',
    'price_atomic_pro'
  );
  insert into webhook_atomic_result values (false);
exception when unique_violation then
  insert into webhook_atomic_result values (true);
end;
$$;
select results_eq(
  'select caught from webhook_atomic_result',
  array[true],
  'entitlement constraint failure is surfaced'
);
select results_eq(
  $$select count(*) from public.billing_events where provider = 'stripe' and event_id = 'evt_atomic_rollback'$$,
  array[0::bigint],
  'ledger insert rolls back when entitlement mutation fails'
);
select results_eq(
  $$select count(*) from public.entitlements
    where user_id = '66666666-6666-4666-8666-666666666666' and provider = 'stripe'$$,
  array[0::bigint],
  'failed atomic event leaves no partial entitlement'
);

select * from finish();
rollback;
