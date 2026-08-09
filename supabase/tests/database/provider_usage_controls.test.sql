-- Datenbankkontrollen der Kostenzaehlung.
--
-- Zwei Zusicherungen tragen diese Datei:
--   1. Die Zahlen gehoeren dem Betreiber, nicht den Konten. `authenticated`
--      darf sie weder lesen noch schreiben -- ein Nutzer soll nicht sehen, was
--      andere kosten.
--   2. Abrufe ohne Konto duerfen nicht verschwinden. Sie sind Teil der
--      Gesamtkosten, nur keinem Tarif zurechenbar.
--
-- Jede Zusicherung wurde am 2026-08-08 zuvor gegen die Produktionsdatenbank
-- gemessen, in einer Transaktion mit Rollback.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select ok(to_regclass('public.provider_usage') is not null, 'usage table exists');

select is(
  (select count(*)::integer from pg_class
     where oid = 'public.provider_usage'::regclass and relrowsecurity),
  1,
  'usage table has RLS enabled'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.provider_usage'::regclass
            and conname = 'provider_usage_provider_shape'),
  'an invented provider name is rejected'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.provider_usage'::regclass
            and conname = 'provider_usage_plan_check'),
  'an invented plan name is rejected'
);

select has_index('public', 'provider_usage', 'provider_usage_user_key', 'per-account counting is deduplicated');
select has_index('public', 'provider_usage', 'provider_usage_shared_key', 'anonymous counting is deduplicated');
select has_index('public', 'provider_usage', 'provider_usage_date_idx', 'cleanup by day is indexed');

-- Rechte: die Zahlen gehoeren dem Betreiber.
select ok(not has_table_privilege('authenticated', 'public.provider_usage', 'SELECT'), 'clients cannot read cost data');
select ok(not has_table_privilege('authenticated', 'public.provider_usage', 'INSERT'), 'clients cannot write cost data');
select ok(has_table_privilege('service_role', 'public.provider_usage', 'INSERT'), 'the server may record usage');

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'record_provider_usage'),
  'usage recording runs as security definer'
);

select ok(
  (select proconfig::text like '%search_path%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'record_provider_usage'),
  'usage recording pins its search_path'
);

-- Verhalten -------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values (
  '22222222-2222-4222-8222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pgtap-cost@example.invalid', now(), now()
);

select lives_ok($$
  select public.record_provider_usage('22222222-2222-4222-8222-222222222222', 'pro', 'fmp', false),
         public.record_provider_usage('22222222-2222-4222-8222-222222222222', 'pro', 'fmp', true),
         public.record_provider_usage('22222222-2222-4222-8222-222222222222', 'pro', 'fmp', true)
$$, 'repeated calls accumulate instead of failing');

select is(
  (select fetches || '/' || cache_hits from public.provider_usage
    where user_id = '22222222-2222-4222-8222-222222222222' and provider = 'fmp'),
  '1/2',
  'fetches and cache hits are counted separately'
);

select * from finish();
rollback;
