-- Sicherheits- und Integritätskontrollen des Corporate-Action-Ledgers.

begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select ok(to_regclass('public.corporate_actions') is not null, 'corporate action ledger exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.corporate_actions'::regclass),
  'corporate action ledger has RLS enabled'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.corporate_actions'::regclass and contype = 'u'),
  'canonical action identity is unique'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.corporate_actions'::regclass and conname = 'corporate_actions_action_type_check'),
  'action types are constrained'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.corporate_actions'::regclass and conname = 'corporate_actions_required_payload'),
  'type-specific required payload is constrained'
);
select has_index('public', 'corporate_actions', 'corporate_actions_symbol_date_idx', 'symbol timeline is indexed');
select has_index('public', 'corporate_actions', 'corporate_actions_instrument_date_idx', 'instrument timeline is indexed');
select has_index('public', 'corporate_actions', 'corporate_actions_scheduled_idx', 'scheduled action queue is indexed');

select ok(has_table_privilege('authenticated', 'public.corporate_actions', 'SELECT'), 'clients may read reference events');
select ok(not has_table_privilege('authenticated', 'public.corporate_actions', 'INSERT'), 'clients cannot insert reference events');
select ok(not has_table_privilege('authenticated', 'public.corporate_actions', 'UPDATE'), 'clients cannot alter reference events');
select ok(not has_table_privilege('authenticated', 'public.corporate_actions', 'DELETE'), 'clients cannot delete reference events');
select ok(has_table_privilege('service_role', 'public.corporate_actions', 'INSERT'), 'server may ingest reference events');

select lives_ok($$
  insert into public.corporate_actions (
    canonical_action_id, symbol, action_type, effective_date, cash_amount,
    lifecycle_status, provider, source_reference, data_quality, as_of, received_at
  ) values (
    'pgtap:cash_dividend:TST:2026-08-10:1', 'TST', 'cash_dividend', '2026-08-10', 1,
    'effective', 'PgTAP Provider', 'https://example.test/dividend', 'provider_reported', now(), now()
  )
$$, 'a source-backed cash dividend can be stored');

select lives_ok($$
  insert into public.corporate_actions (
    canonical_action_id, symbol, action_type, effective_date, ratio_from, ratio_to,
    lifecycle_status, provider, source_reference, data_quality, as_of, received_at
  ) values (
    'pgtap:split:TST:2026-08-10:4:1', 'TST', 'split', '2026-08-10', 4, 1,
    'effective', 'PgTAP Provider', 'https://example.test/split', 'provider_reported', now(), now()
  )
$$, 'a source-backed split can be stored');

select throws_ok($$
  insert into public.corporate_actions (
    canonical_action_id, symbol, action_type, effective_date, lifecycle_status,
    provider, source_reference, data_quality, as_of, received_at
  ) values (
    'pgtap:split:TST:missing-ratio', 'TST', 'split', '2026-08-10', 'effective',
    'PgTAP Provider', 'https://example.test/split', 'provider_reported', now(), now()
  )
$$, '23514', null, 'a split without a ratio is rejected');

select throws_ok($$
  insert into public.corporate_actions (
    canonical_action_id, symbol, action_type, effective_date, lifecycle_status,
    provider, source_reference, data_quality, as_of, received_at
  ) values (
    'pgtap:symbol-change:TST:missing-target', 'TST', 'symbol_change', '2026-08-10', 'effective',
    'PgTAP Provider', 'https://example.test/symbol', 'provider_reported', now(), now()
  )
$$, '23514', null, 'a symbol change without both symbols is rejected');

select throws_ok($$
  insert into public.corporate_actions (
    canonical_action_id, symbol, action_type, effective_date, cash_amount,
    lifecycle_status, provider, source_reference, data_quality, as_of, received_at
  ) values (
    'pgtap:cash_dividend:TST:bad-quality', 'TST', 'cash_dividend', '2026-08-11', 1,
    'scheduled', 'PgTAP Provider', 'https://example.test/dividend', 'realtime', now(), now()
  )
$$, '23514', null, 'corporate actions cannot claim realtime quality');

select throws_ok($$
  insert into public.corporate_actions (
    canonical_action_id, symbol, action_type, effective_date, cash_amount,
    lifecycle_status, provider, source_reference, data_quality, as_of, received_at
  ) values (
    'pgtap:cash_dividend:TST:2026-08-10:1', 'TST', 'cash_dividend', '2026-08-10', 1,
    'effective', 'PgTAP Provider', 'https://example.test/dividend', 'provider_reported', now(), now()
  )
$$, '23505', null, 'duplicate canonical actions are rejected');

select * from finish();
rollback;
