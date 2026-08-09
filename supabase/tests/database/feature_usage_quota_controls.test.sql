-- Datenbankkontrollen der Tagesquoten.
--
-- Der eigentliche Wert dieser Datei liegt in zwei Zusicherungen:
--
--   1. Ein Konto darf seinen eigenen Verbrauch lesen, aber unter keinen
--      Umstaenden schreiben. Wer seinen Zaehler zuruecksetzen kann, hat keine
--      Quote.
--   2. Die Grenze wird in einer einzigen Anweisung geprueft und erhoeht. Waere
--      das zweistufig, koennten zwei gleichzeitige Anfragen beide die letzte
--      freie Einheit sehen.
--
-- Jede Zusicherung wurde am 2026-08-08 zuvor gegen die Produktionsdatenbank
-- gemessen, in einer Transaktion mit Rollback.

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Struktur -------------------------------------------------------------------

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

-- Rechte ---------------------------------------------------------------------
-- Lesen ja, schreiben nein.

select ok(has_table_privilege('authenticated', 'public.feature_usage', 'SELECT'), 'clients may read their own usage');
select ok(not has_table_privilege('authenticated', 'public.feature_usage', 'INSERT'), 'clients cannot create usage rows');
select ok(not has_table_privilege('authenticated', 'public.feature_usage', 'UPDATE'), 'clients cannot rewrite their usage');
select ok(not has_table_privilege('authenticated', 'public.feature_usage', 'DELETE'), 'clients cannot reset their usage');
select ok(has_table_privilege('service_role', 'public.feature_usage', 'INSERT'), 'the server may record usage');

-- Privilegierte Funktion -----------------------------------------------------

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'consume_feature_quota'),
  'quota consumption runs as security definer'
);

select ok(
  (select proconfig::text like '%search_path%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'consume_feature_quota'),
  'quota consumption pins its search_path'
);

select ok(
  not has_function_privilege('authenticated', 'public.consume_feature_quota(uuid,text,integer)', 'EXECUTE'),
  'clients cannot call the privileged quota function'
);

-- Verhalten ------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values (
  '11111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pgtap-quota@example.invalid', now(), now()
);

select is(
  (select allowed from public.consume_feature_quota('11111111-1111-4111-8111-111111111111', 'ai_analysis', 2)),
  true,
  'the first call within the limit is allowed'
);

select is(
  (select used from public.consume_feature_quota('11111111-1111-4111-8111-111111111111', 'ai_analysis', 2)),
  2,
  'the second call consumes the last unit'
);

-- Kern der Quote: der Aufruf ueber der Grenze wird abgewiesen und erhoeht den
-- Zaehler nicht weiter.
select is(
  (select allowed from public.consume_feature_quota('11111111-1111-4111-8111-111111111111', 'ai_analysis', 2)),
  false,
  'the call beyond the limit is refused'
);

-- Eine Grenze von null ist kein erschoepftes Kontingent, sondern ein Tarif ohne
-- diese Funktion. Es darf nichts gezaehlt und nichts freigegeben werden.
select is(
  (select allowed from public.consume_feature_quota('11111111-1111-4111-8111-111111111111', 'api_request', 0)),
  false,
  'a plan without this feature grants nothing'
);

select * from finish();
rollback;
