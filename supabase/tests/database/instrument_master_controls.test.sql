-- Datenbankkontrollen des Instrument Masters.
--
-- Jede Zusicherung hier wurde am 2026-08-08 zuvor einzeln gegen die
-- Produktionsdatenbank gemessen, nicht aus der Migration abgeschrieben.
--
-- Zwei Dinge sind der eigentliche Grund fuer diese Datei:
--   1. `instruments` ist Referenzdatenbestand, kein Nutzerbesitz. `authenticated`
--      darf lesen, aber unter keinen Umstaenden schreiben.
--   2. `upsert_instrument` und `record_instrument_quote_status` sind
--      SECURITY DEFINER und umgehen damit RLS. Genau deshalb muessen ihr
--      `search_path` gepinnt und ihr Ausfuehrungsrecht eng sein.

begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- Struktur -------------------------------------------------------------------

select ok(to_regclass('public.instruments') is not null, 'instrument master exists');
select ok(to_regclass('public.instrument_identifiers') is not null, 'instrument identifiers exist');

select is(
  (select count(*)::integer from pg_class
     where oid in ('public.instruments'::regclass, 'public.instrument_identifiers'::regclass)
       and relrowsecurity),
  2,
  'instrument master tables have RLS enabled'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.instruments'::regclass and contype = 'u'),
  'canonical identity is unique'
);

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.instruments'::regclass
            and conname = 'instruments_quote_status_check'),
  'quote status is constrained to the four measured values'
);

select has_index('public', 'instruments', 'instruments_symbol_idx', 'symbol lookup is indexed');
select has_index('public', 'instruments', 'instruments_asset_class_idx', 'asset class lookup is indexed');
select has_index('public', 'instruments', 'instruments_quote_status_idx', 'quote status queue is indexed');
select has_index('public', 'instrument_identifiers', 'instrument_identifiers_value_idx', 'identifier lookup is indexed');
select has_column('public', 'instruments', 'display_symbol', 'canonical display symbol is stored');
select has_column('public', 'instruments', 'instrument_type', 'instrument type is stored separately');
select has_column('public', 'instruments', 'exchange_code', 'exchange code is stored separately');
select has_column('public', 'instruments', 'mic', 'MIC can be stored when verified');
select has_column('public', 'instruments', 'trading_timezone', 'trading timezone can be stored when verified');
select has_column('public', 'instruments', 'price_precision', 'price precision can be stored when verified');
select has_column('public', 'instruments', 'quantity_precision', 'quantity precision can be stored when verified');
select has_column('public', 'instruments', 'is_active', 'active status can be stored when verified');
select has_column('public', 'instruments', 'is_delisted', 'delisting status can be stored when verified');
select has_index('public', 'instruments', 'instruments_mic_idx', 'MIC lookup is indexed');
select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.instruments'::regclass
            and conname = 'instruments_listing_status_check'),
  'contradictory active and delisted states are constrained'
);

-- Rechte ---------------------------------------------------------------------
-- Lesen ja, schreiben nein. Das Universum ist Referenzdatenbestand.

select ok(has_table_privilege('authenticated', 'public.instruments', 'SELECT'), 'clients may read the instrument master');
select ok(has_table_privilege('authenticated', 'public.instrument_identifiers', 'SELECT'), 'clients may read instrument identifiers');
select ok(not has_table_privilege('authenticated', 'public.instruments', 'INSERT'), 'clients cannot insert instruments');
select ok(not has_table_privilege('authenticated', 'public.instruments', 'UPDATE'), 'clients cannot update instruments');
select ok(not has_table_privilege('authenticated', 'public.instruments', 'DELETE'), 'clients cannot delete instruments');
select ok(has_table_privilege('service_role', 'public.instruments', 'INSERT'), 'server may write the instrument master');

-- Privilegierte Funktionen ---------------------------------------------------
-- SECURITY DEFINER ist hier noetig, weil `upsert_instrument` die
-- Eigentuemerlogik selbst haelt. Genau deshalb muss der search_path gepinnt und
-- das Ausfuehrungsrecht eng sein.

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'upsert_instrument'),
  'instrument upsert runs as security definer'
);

select ok(
  (select proconfig::text like '%search_path%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'upsert_instrument'),
  'instrument upsert pins its search_path'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.upsert_instrument(text,text,text,text,text,text,text,text,text,text,text,numeric,text,text[])',
    'EXECUTE'),
  'clients cannot call the privileged instrument upsert'
);

select ok(
  not has_function_privilege('authenticated', 'public.record_instrument_quote_status(text,text)', 'EXECUTE'),
  'clients cannot rewrite measured quote entitlement'
);

-- Verhalten ------------------------------------------------------------------

select lives_ok($$
  select public.upsert_instrument(
    'stock:pgtap:tst:usd', 'TST', 'PgTAP Test AG', 'stock', 'TESTX', null, 'USD', null,
    'FMP', 'provider_search', 'TST', 60, 'provider_only', array[]::text[]
  )
$$, 'a discovered instrument can be stored');

-- Kern der Idempotenz: ein zweiter Treffer darf die Identitaet bestaetigen,
-- aber niemals einen Doppeleintrag erzeugen oder first_seen_at zuruecksetzen.
select is(
  (
    select public.upsert_instrument(
      'stock:pgtap:tst:usd', 'TST', 'PgTAP Test AG', 'stock', 'TESTX', null, 'USD', null,
      'FMP', 'provider_search', 'test', 75, 'resolved', array[]::text[]
    )
  ),
  (select id from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  're-discovery returns the same instrument instead of duplicating it'
);

select is(
  (select confirmation_count from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  2,
  're-discovery counts as a confirmation'
);

select is(
  (select display_symbol from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  'TST',
  'instrument upsert persists the canonical display symbol'
);

select is(
  (select instrument_type from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  'stock',
  'instrument upsert persists the instrument type'
);

select is(
  (select exchange_code from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  'TESTX',
  'instrument upsert persists the exchange code'
);

select ok(
  (select is_active is null from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  'unknown active status remains null'
);

select ok(
  (select is_delisted is null from public.instruments where canonical_id = 'stock:pgtap:tst:usd'),
  'unknown delisting status remains null'
);

select throws_ok($$
  insert into public.instruments (
    canonical_id, symbol, display_symbol, name, asset_class, instrument_type,
    exchange, exchange_code, currency, provider, is_active, is_delisted
  ) values (
    'stock:pgtap:bad:usd', 'BAD', 'BAD', 'Contradictory Listing', 'stock', 'stock',
    'TESTX', 'TESTX', 'USD', 'FMP', true, true
  )
$$, '23514', null, 'an instrument cannot be active and delisted at the same time');

select throws_ok($$
  select public.record_instrument_quote_status('stock:pgtap:tst:usd', 'erfunden')
$$, '22023', null, 'an invented quote status is rejected');

select ok(
  not public.record_instrument_quote_status('gibt:es:nicht:x', 'available'),
  'recording a status for an unknown instrument reports no match instead of failing silently'
);

select * from finish();
rollback;
