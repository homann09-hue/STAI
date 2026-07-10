begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity), 0::bigint, 'all public tables use RLS');
select is((select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated') and table_name in ('intelligence_sources','raw_intelligence_events','normalized_intelligence_events','intelligence_analyses')), 0::bigint, 'server-only intelligence tables have no public grants');
select ok(not has_function_privilege('anon', 'public.set_updated_at()', 'execute'), 'anon cannot execute trigger helper');
select ok(not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'), 'authenticated cannot execute trigger helper');
select has_index('public', 'portfolio_positions', 'portfolio_positions_unassigned_user_symbol_key', 'unassigned positions are unique per user and symbol');
select has_index('public', 'portfolio_positions', 'portfolio_positions_portfolio_symbol_key', 'book positions are unique per portfolio and symbol');

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'audit-user-1@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'audit-user-2@example.invalid');
insert into public.watchlists (user_id, symbol, asset_type) values
  ('11111111-1111-4111-8111-111111111111', 'AAPL', 'stock'),
  ('22222222-2222-4222-8222-222222222222', 'MSFT', 'stock');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select results_eq('select count(*) from public.watchlists', array[1::bigint], 'user sees only own watchlist row');
select results_eq($$update public.watchlists set symbol='HACKED' where user_id='22222222-2222-4222-8222-222222222222' returning id$$, $$select null::uuid where false$$, 'user cannot update another tenant row');
reset role;

select lives_ok($$select public.apply_portfolio_trade('11111111-1111-4111-8111-111111111111','NVDA','NVIDIA','stock','Technology','buy',2,100,'USD',60)$$, 'valid buy is atomic');
select throws_ok($$select public.apply_portfolio_trade('11111111-1111-4111-8111-111111111111','NVDA','NVIDIA','stock','Technology','sell',3,110,'USD',60)$$, 'P0001', 'portfolio_sell_exceeds_position', 'oversell is rejected');
select is((select quantity from public.portfolio_positions where user_id='11111111-1111-4111-8111-111111111111' and symbol='NVDA'), 2::numeric, 'rejected sell leaves quantity unchanged');
select is((select count(*) from public.portfolio_transactions where user_id='11111111-1111-4111-8111-111111111111' and symbol='NVDA'), 1::bigint, 'rejected sell creates no transaction');
select ok(has_function_privilege('service_role', 'public.apply_portfolio_trade(uuid,text,text,text,text,text,numeric,numeric,text,integer)', 'execute'), 'service role can execute trade RPC');

select * from finish();
rollback;
