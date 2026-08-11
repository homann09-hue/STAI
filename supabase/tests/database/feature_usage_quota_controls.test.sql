-- Database controls for daily feature quotas.
--
-- The quota table remains read-only for users. The only write path is an
-- atomic SECURITY DEFINER function that derives ownership from auth.uid().
-- A caller can consume only their own quota and cannot provide a user UUID.

begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Structure -----------------------------------------------------------------

select ok(to_regclass('public.feature_usage') is not null, 'usage table exists');

select is(
  (select count(*)::integer from pg_class
     where oid = 'public.feature_usage'::regclass and relrowsecurity),
  1,
  'usage table has RLS enabled'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.feature_usage'::regclass and contype = 'p'),
  'usage is keyed per account, feature and day'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.feature_usage'::regclass
            and conname = 'feature_usage_used_not_negative'),
  'a negative usage count is rejected'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.feature_usage'::regclass
            and conname = 'feature_usage_feature_shape'),
  'an invented feature name is rejected'
);

select has_index('public', 'feature_usage', 'feature_usage_date_idx', 'cleanup by day is indexed');

-- Table privileges -----------------------------------------------------------

select ok(has_table_privilege('authenticated', 'public.feature_usage', 'SELECT'), 'clients may read their own usage');
select ok(not has_table_privilege('authenticated', 'public.feature_usage', 'INSERT'), 'clients cannot create usage rows');
select ok(not has_table_privilege('authenticated', 'public.feature_usage', 'UPDATE'), 'clients cannot rewrite their usage');
select ok(not has_table_privilege('authenticated', 'public.feature_usage', 'DELETE'), 'clients cannot reset their usage');
select ok(has_table_privilege('service_role', 'public.feature_usage', 'INSERT'), 'server workers retain table write access');

-- Function boundary ----------------------------------------------------------

select ok(
  (select p.prosecdef
     from pg_proc p
    where p.oid = to_regprocedure('public.consume_feature_quota(text,integer)')),
  'quota consumption runs as security definer'
);

select ok(
  (select p.proconfig::text like '%search_path%'
     from pg_proc p
    where p.oid = to_regprocedure('public.consume_feature_quota(text,integer)')),
  'quota consumption pins its search_path'
);

select ok(
  has_function_privilege('authenticated', 'public.consume_feature_quota(text,integer)', 'EXECUTE'),
  'authenticated users may invoke the tenant-bound operation'
);

select ok(
  not has_function_privilege('anon', 'public.consume_feature_quota(text,integer)', 'EXECUTE'),
  'anonymous clients cannot consume quotas'
);

select ok(
  not has_function_privilege('service_role', 'public.consume_feature_quota(text,integer)', 'EXECUTE'),
  'service role is not the application quota path'
);

select is(
  to_regprocedure('public.consume_feature_quota(uuid,text,integer)'),
  null::regprocedure,
  'the caller-selected user-id overload no longer exists'
);

-- Behaviour -----------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pgtap-quota-a@example.invalid', now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pgtap-quota-b@example.invalid', now(), now()
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is(
  (select allowed from public.consume_feature_quota('ai_analysis', 2)),
  true,
  'the first call within the limit is allowed'
);

select is(
  (select used from public.consume_feature_quota('ai_analysis', 2)),
  2,
  'the second call consumes the last unit'
);

select is(
  (select allowed from public.consume_feature_quota('ai_analysis', 2)),
  false,
  'the call beyond the limit is refused'
);

select results_eq(
  $$select used from public.feature_usage where feature = 'ai_analysis'$$,
  $$values (2)$$,
  'RLS exposes the authenticated users own counter at two'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select is(
  (select allowed from public.consume_feature_quota('ai_analysis', 2)),
  true,
  'a second tenant starts with an independent quota'
);

select results_eq(
  $$select used from public.feature_usage where feature = 'ai_analysis'$$,
  $$values (1)$$,
  'RLS exposes only the second tenants counter'
);

select is(
  (select allowed from public.consume_feature_quota('api_request', 0)),
  false,
  'a plan without the feature grants nothing'
);

select results_eq(
  $$select count(*)::integer from public.feature_usage where feature = 'api_request'$$,
  $$values (0)$$,
  'a zero limit creates no usage row'
);

select throws_ok(
  $$select * from public.consume_feature_quota('arbitrary_feature', 2)$$,
  '22023',
  'Unknown quota feature.',
  'unknown feature names are rejected'
);

select throws_ok(
  $$select * from public.consume_feature_quota('ai_analysis', 100001)$$,
  '22023',
  'Invalid quota limit.',
  'unbounded caller limits are rejected'
);

reset role;

select is(
  (select used from public.feature_usage
    where user_id = '11111111-1111-4111-8111-111111111111'
      and feature = 'ai_analysis'),
  2,
  'the first tenants counter was not changed by the second tenant'
);

select is(
  (select used from public.feature_usage
    where user_id = '22222222-2222-4222-8222-222222222222'
      and feature = 'ai_analysis'),
  1,
  'the second tenants counter belongs to the JWT identity'
);

select * from finish();
rollback;
