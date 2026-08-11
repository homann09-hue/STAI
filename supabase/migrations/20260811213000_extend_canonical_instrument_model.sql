-- Erweitert den Instrument Master um die kanonischen Listing-Felder aus Phase 2.
-- Unbekannte Providerdaten bleiben NULL; insbesondere MIC, Zeitzone,
-- Präzision und Listingstatus werden nicht aus Symbolen geraten.

alter table public.instruments
  add column if not exists display_symbol text,
  add column if not exists instrument_type text,
  add column if not exists exchange_code text,
  add column if not exists mic text,
  add column if not exists trading_timezone text,
  add column if not exists price_precision smallint,
  add column if not exists quantity_precision smallint,
  add column if not exists is_active boolean,
  add column if not exists is_delisted boolean;

update public.instruments
set display_symbol = coalesce(display_symbol, symbol),
    instrument_type = coalesce(instrument_type, asset_class),
    exchange_code = coalesce(exchange_code, exchange)
where display_symbol is null
   or instrument_type is null
   or exchange_code is null;

alter table public.instruments
  alter column display_symbol set not null,
  alter column instrument_type set not null,
  alter column exchange_code set not null;

alter table public.instruments
  add constraint instruments_display_symbol_check
    check (display_symbol ~ '^[A-Z0-9 ./:^-]{1,48}$'),
  add constraint instruments_instrument_type_check
    check (instrument_type in (
      'stock', 'etf', 'crypto', 'forex', 'index',
      'commodity', 'bond', 'future', 'option', 'warrant', 'fund'
    )),
  add constraint instruments_exchange_code_check
    check (length(trim(exchange_code)) between 1 and 32),
  add constraint instruments_mic_check
    check (mic is null or mic ~ '^[A-Z0-9]{4}$'),
  add constraint instruments_trading_timezone_check
    check (trading_timezone is null or length(trim(trading_timezone)) between 1 and 64),
  add constraint instruments_price_precision_check
    check (price_precision is null or price_precision between 0 and 18),
  add constraint instruments_quantity_precision_check
    check (quantity_precision is null or quantity_precision between 0 and 18),
  add constraint instruments_listing_status_check
    check (not (is_active is true and is_delisted is true));

create index if not exists instruments_mic_idx
  on public.instruments (mic)
  where mic is not null;

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
    canonical_id, symbol, display_symbol, name, asset_class, instrument_type,
    exchange, exchange_full_name, exchange_code, currency, country, provider,
    discovery_source, discovery_query, identity_confidence, resolution_status,
    resolution_warnings
  )
  values (
    p_canonical_id, p_symbol, p_symbol, p_name, p_asset_class, p_asset_class,
    coalesce(nullif(trim(p_exchange), ''), 'unknown'), p_exchange_full_name,
    coalesce(nullif(trim(p_exchange), ''), 'unknown'),
    coalesce(nullif(trim(p_currency), ''), 'USD'), p_country, p_provider,
    coalesce(p_discovery_source, 'provider_search'), p_discovery_query,
    coalesce(p_identity_confidence, 0), coalesce(p_resolution_status, 'provider_only'),
    coalesce(p_resolution_warnings, '{}')
  )
  on conflict (canonical_id) do update set
    name = excluded.name,
    display_symbol = excluded.display_symbol,
    instrument_type = excluded.instrument_type,
    exchange = excluded.exchange,
    exchange_full_name = coalesce(excluded.exchange_full_name, public.instruments.exchange_full_name),
    exchange_code = excluded.exchange_code,
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
