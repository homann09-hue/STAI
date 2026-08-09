-- Kursverfuegbarkeit ist im aktuellen FMP-Tarif nicht ableitbar: gemessen am
-- 2026-08-07 liefert SPY einen Kurs, QQQ nicht; AAPL liefert, BTCS nicht.
-- Weder Assetklasse noch Handelsplatz erlauben eine Vorhersage. Der Status wird
-- deshalb pro Instrument gemessen und gespeichert statt geraten.
--
-- Rollback: Spalten droppen, Funktion droppen. Es gehen nur Messwerte verloren,
-- die beim naechsten Kursabruf neu entstehen.

alter table public.instruments
  add column if not exists quote_status text not null default 'unknown'
    check (quote_status in ('unknown', 'available', 'restricted', 'error')),
  add column if not exists quote_checked_at timestamptz;

create index if not exists instruments_quote_status_idx
  on public.instruments (quote_status, last_seen_at desc);

create or replace function public.record_instrument_quote_status(
  p_canonical_id text,
  p_quote_status text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated integer;
begin
  if p_quote_status not in ('unknown', 'available', 'restricted', 'error') then
    raise exception 'invalid_quote_status' using errcode = '22023';
  end if;

  update public.instruments
     set quote_status = p_quote_status,
         quote_checked_at = now()
   where canonical_id = p_canonical_id;

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke execute on function public.record_instrument_quote_status(text, text)
  from public, anon, authenticated;
grant execute on function public.record_instrument_quote_status(text, text) to service_role;
