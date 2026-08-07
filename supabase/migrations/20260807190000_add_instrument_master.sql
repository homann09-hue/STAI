-- Persistenter Instrument Master fuer StockPilot AI.
--
-- Zweck: das Instrumentuniversum nicht laenger aus hartcodierten Seed-Symbolen
-- speisen, sondern aus echten Provider-Treffern aufbauen und dauerhaft halten.
--
-- Bewusste Einschraenkung: der aktuelle FMP-Tarif liefert kein vollstaendiges
-- Verzeichnis (v3-Legacy-Endpunkte 403, stable/company-screener und
-- stable/available-exchanges 402). Nutzbar sind stable/search-symbol und
-- stable/search-name. Das Universum waechst daher suchgetrieben statt per
-- Vollabzug. Das Schema ist so geschnitten, dass ein spaeterer Directory-Sync
-- nur eine weitere Quelle in `discovery_source` ist und keinen Umbau erfordert.
--
-- Rollback: API-Schreibpfad deaktivieren, Tabellen in umgekehrter Reihenfolge
-- droppen. Es gehen dabei nur wiederbeschaffbare Provider-Metadaten verloren,
-- keine Nutzerdaten.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  -- Kanonische Identitaet: Assetklasse + Boerse + Symbol + Waehrung.
  canonical_id text not null unique check (length(trim(canonical_id)) between 3 and 200),
  symbol text not null check (symbol ~ '^[A-Z0-9./:-]{1,32}$'),
  name text not null check (length(trim(name)) between 1 and 240),
  asset_class text not null check (asset_class in (
    'stock', 'etf', 'crypto', 'forex', 'index',
    'commodity', 'bond', 'future', 'option', 'warrant', 'fund'
  )),
  exchange text not null default 'unknown' check (length(trim(exchange)) between 1 and 120),
  exchange_full_name text check (exchange_full_name is null or length(trim(exchange_full_name)) between 1 and 240),
  country text check (country is null or country ~ '^[A-Z]{2,3}$'),
  currency text not null default 'USD' check (currency ~ '^[A-Z0-9]{2,12}$'),

  -- Provenance: ohne diese Felder darf kein Instrument angezeigt werden.
  provider text not null check (length(trim(provider)) between 2 and 60),
  discovery_source text not null default 'provider_search' check (discovery_source in (
    'provider_search', 'provider_directory', 'seed', 'manual'
  )),
  discovery_query text check (discovery_query is null or length(discovery_query) <= 120),

  -- Identitaetsgueltigkeit aus der bestehenden Resolution-Logik.
  identity_confidence numeric(5, 2) not null default 0 check (identity_confidence between 0 and 100),
  resolution_status text not null default 'provider_only' check (resolution_status in (
    'resolved', 'ambiguous', 'provider_only', 'invalid'
  )),
  resolution_warnings text[] not null default '{}',

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Zaehlt, wie oft der Provider dieses Instrument bestaetigt hat. Ein einzelner
  -- Treffer ist schwaechere Evidenz als ein wiederholt bestaetigtes Listing.
  confirmation_count integer not null default 1 check (confirmation_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instrument_identifiers (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  identifier_type text not null check (identifier_type in (
    'ticker', 'provider_symbol', 'isin', 'figi', 'cusip', 'sedol', 'lei', 'mic', 'exchange'
  )),
  value text not null check (length(trim(value)) between 1 and 120),
  provider text check (provider is null or length(trim(provider)) between 2 and 60),
  created_at timestamptz not null default now(),
  unique (instrument_id, identifier_type, value)
);

create index if not exists instruments_symbol_idx on public.instruments (symbol);
create index if not exists instruments_asset_class_idx on public.instruments (asset_class, symbol);
create index if not exists instruments_last_seen_idx on public.instruments (last_seen_at desc);
create index if not exists instruments_name_trgm_idx on public.instruments (lower(name) text_pattern_ops);
create index if not exists instrument_identifiers_value_idx
  on public.instrument_identifiers (identifier_type, value);
create index if not exists instrument_identifiers_instrument_idx
  on public.instrument_identifiers (instrument_id);

drop trigger if exists set_instruments_updated_at on public.instruments;
create trigger set_instruments_updated_at before update on public.instruments
for each row execute function public.set_updated_at();

-- Das Universum ist Referenzdatenbestand, kein Nutzerbesitz. Schreiben bleibt
-- serverseitig; Lesen ist fuer angemeldete Nutzer erlaubt, damit die Suche ohne
-- Umweg ueber eine Server-Route funktionieren kann.
alter table public.instruments enable row level security;
alter table public.instrument_identifiers enable row level security;

revoke all on public.instruments from public, anon, authenticated;
revoke all on public.instrument_identifiers from public, anon, authenticated;

grant select on public.instruments to authenticated;
grant select on public.instrument_identifiers to authenticated;
grant select, insert, update on public.instruments to service_role;
grant select, insert, update, delete on public.instrument_identifiers to service_role;

drop policy if exists "Authenticated users read instruments" on public.instruments;
create policy "Authenticated users read instruments" on public.instruments
  for select to authenticated using (true);

drop policy if exists "Authenticated users read instrument identifiers" on public.instrument_identifiers;
create policy "Authenticated users read instrument identifiers" on public.instrument_identifiers
  for select to authenticated using (true);

-- Kein Schreibrecht fuer anon/authenticated: ohne diese Policies wuerde RLS bei
-- fehlender Policy zwar ohnehin sperren, die explizite Ablehnung macht die
-- Absicht im Schema sichtbar.
drop policy if exists "Instrument writes are server only" on public.instruments;
create policy "Instrument writes are server only" on public.instruments
  for all to anon using (false) with check (false);

drop policy if exists "Instrument identifier writes are server only" on public.instrument_identifiers;
create policy "Instrument identifier writes are server only" on public.instrument_identifiers
  for all to anon using (false) with check (false);

-- Idempotenter Upsert. Ein erneuter Treffer darf Identitaet und Provenance
-- verbessern, aber niemals `first_seen_at` oder den Zaehler zuruecksetzen.
create or replace function public.upsert_instrument(
  p_canonical_id text,
  p_symbol text,
  p_name text,
  p_asset_class text,
  p_exchange text,
  p_exchange_full_name text,
  p_currency text,
  p_country text,
  p_provider text,
  p_discovery_source text,
  p_discovery_query text,
  p_identity_confidence numeric,
  p_resolution_status text,
  p_resolution_warnings text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  instrument_id uuid;
begin
  insert into public.instruments (
    canonical_id, symbol, name, asset_class, exchange, exchange_full_name,
    currency, country, provider, discovery_source, discovery_query,
    identity_confidence, resolution_status, resolution_warnings
  )
  values (
    p_canonical_id, p_symbol, p_name, p_asset_class, coalesce(nullif(trim(p_exchange), ''), 'unknown'),
    p_exchange_full_name, coalesce(nullif(trim(p_currency), ''), 'USD'), p_country, p_provider,
    coalesce(p_discovery_source, 'provider_search'), p_discovery_query,
    coalesce(p_identity_confidence, 0), coalesce(p_resolution_status, 'provider_only'),
    coalesce(p_resolution_warnings, '{}')
  )
  on conflict (canonical_id) do update set
    name = excluded.name,
    exchange = excluded.exchange,
    exchange_full_name = coalesce(excluded.exchange_full_name, public.instruments.exchange_full_name),
    currency = excluded.currency,
    country = coalesce(excluded.country, public.instruments.country),
    identity_confidence = greatest(public.instruments.identity_confidence, excluded.identity_confidence),
    resolution_status = excluded.resolution_status,
    resolution_warnings = excluded.resolution_warnings,
    last_seen_at = now(),
    confirmation_count = public.instruments.confirmation_count + 1
  returning id into instrument_id;

  return instrument_id;
end;
$$;

revoke execute on function public.upsert_instrument(
  text, text, text, text, text, text, text, text, text, text, text, numeric, text, text[]
) from public, anon, authenticated;
grant execute on function public.upsert_instrument(
  text, text, text, text, text, text, text, text, text, text, text, numeric, text, text[]
) to service_role;
