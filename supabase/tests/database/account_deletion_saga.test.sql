begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

select has_table('public', 'account_deletion_jobs', 'account deletion jobs exist');
select has_table('public', 'account_deletion_events', 'account deletion events exist');
select ok((select relrowsecurity from pg_class where oid = 'public.account_deletion_jobs'::regclass), 'jobs use RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.account_deletion_events'::regclass), 'events use RLS');
select ok(not has_table_privilege('anon', 'public.account_deletion_jobs', 'SELECT'), 'anon cannot read jobs');
select ok(not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'SELECT'), 'users cannot read jobs');
select ok(not has_table_privilege('anon', 'public.account_deletion_events', 'SELECT'), 'anon cannot read events');
select ok(not has_table_privilege('authenticated', 'public.account_deletion_events', 'SELECT'), 'users cannot read events');
select ok(has_table_privilege('service_role', 'public.account_deletion_jobs', 'SELECT'), 'service role reads jobs');
select ok(has_table_privilege('service_role', 'public.account_deletion_jobs', 'INSERT'), 'service role inserts jobs');
select ok(has_table_privilege('service_role', 'public.account_deletion_jobs', 'UPDATE'), 'service role updates jobs');
select ok(has_table_privilege('service_role', 'public.account_deletion_events', 'SELECT'), 'service role reads events');
select ok(has_table_privilege('service_role', 'public.account_deletion_events', 'INSERT'), 'service role inserts events');
select ok(has_function_privilege('service_role', 'public.claim_account_deletion(uuid,uuid)', 'EXECUTE'), 'service role claims deletion');
select ok(not has_function_privilege('authenticated', 'public.claim_account_deletion(uuid,uuid)', 'EXECUTE'), 'users cannot claim deletion');
select ok(has_function_privilege('service_role', 'public.record_account_deletion_step(uuid,uuid,text,text,jsonb,text,text[],text[])', 'EXECUTE'), 'service role records steps');
select ok(not has_function_privilege('authenticated', 'public.record_account_deletion_step(uuid,uuid,text,text,jsonb,text,text[],text[])', 'EXECUTE'), 'users cannot record steps');

set local role service_role;
select results_eq(
  $$select claimed from public.claim_account_deletion('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  array[true],
  'first worker claims the deletion'
);
select results_eq(
  $$select claimed from public.claim_account_deletion('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  array[false],
  'concurrent worker is rejected while lease is active'
);
select ok(public.record_account_deletion_step(
  (select id from public.account_deletion_jobs where user_id='11111111-1111-4111-8111-111111111111'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cancelling_subscriptions', 'billing_discovered', '{"customerCount":1}', null,
  array['cus_test_123456'], null
), 'claimed worker records a transition');
select is((select status from public.account_deletion_jobs where user_id='11111111-1111-4111-8111-111111111111'), 'cancelling_subscriptions', 'job status advances');
select is((select count(*) from public.account_deletion_events), 1::bigint, 'transition creates one audit event');
reset role;

set local role authenticated;
select throws_ok('select count(*) from public.account_deletion_jobs', '42501', null, 'authenticated cannot query jobs');
select throws_ok('select count(*) from public.account_deletion_events', '42501', null, 'authenticated cannot query events');
reset role;

set local role service_role;
select ok(public.record_account_deletion_step(
  (select id from public.account_deletion_jobs where user_id='11111111-1111-4111-8111-111111111111'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'completed', 'account_deleted', '{"completed":true}', null, null, array['sub_test_123456']
), 'claimed worker completes the saga');
select is((select user_id from public.account_deletion_jobs where status='completed'), null::uuid, 'completed tombstone removes user id');
select is((select status from public.account_deletion_jobs limit 1), 'completed', 'completed status persists');
select is((select count(*) from public.account_deletion_events), 2::bigint, 'completion appends audit evidence');
select is((select stripe_customer_ids[1] from public.account_deletion_jobs limit 1), 'cus_test_123456', 'customer tombstone remains for webhook races');
reset role;

select * from finish();
rollback;
