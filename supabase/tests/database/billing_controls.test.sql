begin;
select plan(21);

select ok(to_regclass('public.billing_events') is not null, 'billing event audit table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.billing_events'::regclass), 'billing events use RLS');

select is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public' and table_name = 'entitlements'
     and column_name in ('provider_subscription_id', 'provider_price_id', 'trial_ends_at', 'cancel_at_period_end', 'last_provider_event_id', 'last_synced_at')),
  6,
  'entitlements contain provider lifecycle fields'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' and table_name = 'billing_events'
  ),
  'anonymous clients have no billing event grants'
);

select ok(has_table_privilege('authenticated', 'public.billing_events', 'SELECT'), 'authenticated users may read billing evidence through RLS');
select ok(not has_table_privilege('authenticated', 'public.billing_events', 'INSERT'), 'authenticated users cannot append billing evidence');
select ok(not has_table_privilege('authenticated', 'public.billing_events', 'UPDATE'), 'authenticated users cannot modify billing evidence');
select ok(not has_table_privilege('authenticated', 'public.billing_events', 'DELETE'), 'authenticated users cannot delete billing evidence');

select ok(has_table_privilege('service_role', 'public.billing_events', 'INSERT'), 'service role may append billing events');
select has_index('public', 'entitlements', 'entitlements_provider_customer_uidx', 'provider customers are unique');
select has_index('public', 'entitlements', 'entitlements_provider_subscription_uidx', 'provider subscriptions are unique');
select has_index('public', 'billing_events', 'billing_events_user_received_idx', 'billing user lookup is indexed');

select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.billing_events'::regclass and tgname = 'billing_event_immutable' and not tgisinternal),
  'billing event evidence is immutable except FK pseudonymization'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.watchlists'::regclass and tgname = 'watchlists_plan_limit' and not tgisinternal),
  'watchlists enforce plan limits in the database'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.alert_rules'::regclass and tgname = 'alert_rules_plan_limit' and not tgisinternal),
  'alerts enforce plan limits in the database'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.portfolios'::regclass and tgname = 'portfolios_plan_limit' and not tgisinternal),
  'portfolio books enforce plan limits in the database'
);

select ok(
  not has_function_privilege('authenticated', 'private.current_plan_limit(uuid,text)', 'EXECUTE'),
  'clients cannot call the privileged plan resolver directly'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'billing_events' and policyname = 'Users read own billing events' and cmd = 'SELECT' and roles = array['authenticated']::name[]),
  1,
  'billing events have an authenticated tenant-read policy'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.entitlements'::regclass and conname = 'entitlements_status_check'),
  'entitlement status lifecycle is constrained'
);

insert into auth.users (id, email) values
  ('33333333-3333-4333-8333-333333333333', 'billing-audit-1@example.invalid'),
  ('44444444-4444-4444-8444-444444444444', 'billing-audit-2@example.invalid');

insert into public.billing_events (
  provider, event_id, event_type, status, user_id, payload_hash, livemode, provider_created_at
) values
  ('manual', 'evt_tenant_a', 'admin.plan_granted', 'processed', '33333333-3333-4333-8333-333333333333', repeat('a', 64), true, now()),
  ('manual', 'evt_tenant_b', 'admin.plan_granted', 'processed', '44444444-4444-4444-8444-444444444444', repeat('b', 64), true, now());

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select results_eq('select count(*) from public.billing_events', array[1::bigint], 'user sees only own billing event');
select results_eq($$select count(*) from public.billing_events where user_id = '44444444-4444-4444-8444-444444444444'$$, array[0::bigint], 'user cannot read another tenant billing event');
reset role;

select * from finish();
rollback;
