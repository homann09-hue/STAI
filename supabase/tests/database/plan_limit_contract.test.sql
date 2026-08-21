begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

select has_table('private', 'plan_limit_contract', 'canonical plan limit contract exists');
select results_eq(
  $$select plan, plan_rank::integer, max_watchlist_items, max_alerts, portfolios,
           historical_data_years, ai_analyses_per_day, api_requests_per_day
      from private.plan_limit_contract order by plan_rank$$,
  $$values
      ('free'::text, 1, 15, 3, 1, 1, 3, 0),
      ('pro'::text, 2, 250, 100, 10, 10, 100, 1000),
      ('premium'::text, 3, 1000, 500, 25, 20, 500, 10000)$$,
  'database contract exactly matches TypeScript, admin and UI limits'
);
select ok(not has_table_privilege('authenticated', 'private.plan_limit_contract', 'SELECT'), 'users cannot read private limits directly');
select ok(not has_table_privilege('anon', 'private.plan_limit_contract', 'SELECT'), 'anonymous clients cannot read private limits');
select ok(has_table_privilege('service_role', 'private.plan_limit_contract', 'SELECT'), 'service role can audit limit contract');
select ok(not has_function_privilege('authenticated', 'private.current_plan_limit(uuid,text)', 'EXECUTE'), 'users cannot call privileged limit resolver');
select ok(not has_function_privilege('anon', 'private.current_plan_limit(uuid,text)', 'EXECUTE'), 'anonymous clients cannot call privileged limit resolver');
select ok(has_function_privilege('service_role', 'private.current_plan_limit(uuid,text)', 'EXECUTE'), 'service role can audit effective limits');

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'limits-free@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'limits-pro@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'limits-premium@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'limits-expired@example.invalid'),
  ('10000000-0000-4000-8000-000000000005', 'limits-upgrade@example.invalid');

select throws_ok(
  $$insert into public.entitlements (user_id, plan, status, provider, valid_until)
    values ('10000000-0000-4000-8000-000000000001', 'starter', 'active', 'legacy', now() + interval '1 day')$$,
  '23514', null, 'obsolete plan identifiers cannot be inserted'
);

insert into public.entitlements (user_id, plan, status, provider, valid_until) values
  ('10000000-0000-4000-8000-000000000002', 'pro', 'trialing', 'manual', now() + interval '30 days'),
  ('10000000-0000-4000-8000-000000000003', 'premium', 'active', 'manual', now() + interval '30 days'),
  ('10000000-0000-4000-8000-000000000004', 'premium', 'active', 'manual', now() - interval '1 day');

select is(private.current_plan_limit('10000000-0000-4000-8000-000000000001', 'watchlistItems'), 15, 'free watchlist limit is 15');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000001', 'alerts'), 3, 'free alert limit is 3');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000001', 'portfolios'), 1, 'free portfolio limit is 1');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000002', 'watchlistItems'), 250, 'pro watchlist limit is 250');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000002', 'alerts'), 100, 'pro alert limit is 100');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000002', 'portfolios'), 10, 'pro portfolio limit is 10');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000003', 'watchlistItems'), 1000, 'premium watchlist limit is 1000');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000003', 'alerts'), 500, 'premium alert limit is 500');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000003', 'portfolios'), 25, 'premium portfolio limit is 25');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000002', 'alerts'), 100, 'trialing uses the paid plan limit');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000004', 'watchlistItems'), 15, 'expired paid entitlement falls back to free');
select throws_ok(
  $$select private.current_plan_limit('10000000-0000-4000-8000-000000000001', 'unknown')$$,
  '22023', 'Unknown plan resource.', 'unknown resources fail closed'
);

insert into public.watchlists (user_id, symbol, asset_type)
select '10000000-0000-4000-8000-000000000001', 'FREE-' || value, 'stock'
from generate_series(1, 14) as value;
select is((select count(*) from public.watchlists where user_id = '10000000-0000-4000-8000-000000000001'), 14::bigint, 'free limit minus one is allowed');
select lives_ok(
  $$insert into public.watchlists (user_id, symbol, asset_type) values ('10000000-0000-4000-8000-000000000001', 'FREE-15', 'stock')$$,
  'free limit itself is allowed'
);
select is((select count(*) from public.watchlists where user_id = '10000000-0000-4000-8000-000000000001'), 15::bigint, 'free count reaches exactly the limit');
select throws_ok(
  $$insert into public.watchlists (user_id, symbol, asset_type) values ('10000000-0000-4000-8000-000000000001', 'FREE-16', 'stock')$$,
  'P0001', 'plan_limit_exceeded:watchlistItems:15', 'free limit plus one is rejected'
);

insert into public.alert_rules (user_id, symbol, alert_type, condition)
select '10000000-0000-4000-8000-000000000002', 'PRO-' || value, 'price', '{}'::jsonb
from generate_series(1, 99) as value;
select is((select count(*) from public.alert_rules where user_id = '10000000-0000-4000-8000-000000000002'), 99::bigint, 'pro limit minus one is allowed');
select lives_ok(
  $$insert into public.alert_rules (user_id, symbol, alert_type, condition) values ('10000000-0000-4000-8000-000000000002', 'PRO-100', 'price', '{}')$$,
  'pro limit itself is allowed'
);
select is((select count(*) from public.alert_rules where user_id = '10000000-0000-4000-8000-000000000002'), 100::bigint, 'pro count reaches exactly the limit');
select throws_ok(
  $$insert into public.alert_rules (user_id, symbol, alert_type, condition) values ('10000000-0000-4000-8000-000000000002', 'PRO-101', 'price', '{}')$$,
  'P0001', 'plan_limit_exceeded:alerts:100', 'pro limit plus one is rejected'
);

insert into public.portfolios (user_id, name)
select '10000000-0000-4000-8000-000000000003', 'Premium ' || value
from generate_series(1, 24) as value;
select is((select count(*) from public.portfolios where user_id = '10000000-0000-4000-8000-000000000003'), 24::bigint, 'premium limit minus one is allowed');
select lives_ok(
  $$insert into public.portfolios (user_id, name) values ('10000000-0000-4000-8000-000000000003', 'Premium 25')$$,
  'premium limit itself is allowed'
);
select is((select count(*) from public.portfolios where user_id = '10000000-0000-4000-8000-000000000003'), 25::bigint, 'premium count reaches exactly the limit');
select throws_ok(
  $$insert into public.portfolios (user_id, name) values ('10000000-0000-4000-8000-000000000003', 'Premium 26')$$,
  'P0001', 'plan_limit_exceeded:portfolios:25', 'premium limit plus one is rejected'
);

select is(private.current_plan_limit('10000000-0000-4000-8000-000000000005', 'watchlistItems'), 15, 'upgrade account starts on free');
insert into public.watchlists (user_id, symbol, asset_type)
select '10000000-0000-4000-8000-000000000005', 'UP-' || value, 'stock'
from generate_series(1, 15) as value;
select throws_ok(
  $$insert into public.watchlists (user_id, symbol, asset_type) values ('10000000-0000-4000-8000-000000000005', 'UP-16', 'stock')$$,
  'P0001', 'plan_limit_exceeded:watchlistItems:15', 'free account is blocked before upgrade'
);
insert into public.entitlements (user_id, plan, status, provider, valid_until)
values ('10000000-0000-4000-8000-000000000005', 'pro', 'active', 'manual', now() + interval '30 days');
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000005', 'watchlistItems'), 250, 'upgrade applies pro limit immediately');
select lives_ok(
  $$insert into public.watchlists (user_id, symbol, asset_type) values ('10000000-0000-4000-8000-000000000005', 'UP-16', 'stock')$$,
  'upgrade allows the next resource without deleting existing data'
);
update public.entitlements set plan = 'premium' where user_id = '10000000-0000-4000-8000-000000000005';
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000005', 'watchlistItems'), 1000, 'premium upgrade applies immediately');
update public.entitlements set plan = 'free' where user_id = '10000000-0000-4000-8000-000000000005';
select is(private.current_plan_limit('10000000-0000-4000-8000-000000000005', 'watchlistItems'), 15, 'downgrade applies free limit immediately');
select throws_ok(
  $$insert into public.watchlists (user_id, symbol, asset_type) values ('10000000-0000-4000-8000-000000000005', 'UP-17', 'stock')$$,
  'P0001', 'plan_limit_exceeded:watchlistItems:15', 'downgrade preserves existing data but blocks new over-limit resources'
);

select * from finish();
rollback;
