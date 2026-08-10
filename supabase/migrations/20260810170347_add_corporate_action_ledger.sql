-- Corporate-Action-Ledger fuer belegte Dividenden, Splits und spaetere
-- Symbol-/Strukturereignisse.
--
-- Der Ledger speichert ausschliesslich provider- oder regulatorisch gemeldete
-- Ereignisse. Er ist kein Kursfeed und kennt deshalb bewusst keinen
-- "realtime"-Status. `as_of` bezeichnet den fachlichen Datenstand,
-- `received_at` den Eingang bei StockPilot.
--
-- Rollback: API-Ingestion deaktivieren und `public.corporate_actions` droppen.
-- Es gehen nur wiederbeschaffbare Referenzdaten verloren, keine Nutzerdaten.

create table if not exists public.corporate_actions (
  id uuid primary key default gen_random_uuid(),
  canonical_action_id text not null unique
    check (length(trim(canonical_action_id)) between 12 and 400),
  instrument_id uuid references public.instruments(id) on delete set null,
  symbol text not null check (symbol ~ '^[A-Z0-9./:-]{1,32}$'),
  action_type text not null check (action_type in (
    'cash_dividend', 'special_dividend', 'stock_dividend', 'split',
    'reverse_split', 'symbol_change', 'merger', 'spin_off',
    'rights_issue', 'delisting'
  )),
  effective_date date not null,
  announcement_date date,
  record_date date,
  payment_date date,
  old_symbol text check (old_symbol is null or old_symbol ~ '^[A-Z0-9./:-]{1,32}$'),
  new_symbol text check (new_symbol is null or new_symbol ~ '^[A-Z0-9./:-]{1,32}$'),
  cash_amount numeric(24, 8) check (cash_amount is null or cash_amount >= 0),
  adjusted_cash_amount numeric(24, 8)
    check (adjusted_cash_amount is null or adjusted_cash_amount >= 0),
  currency text check (currency is null or currency ~ '^[A-Z0-9]{2,12}$'),
  ratio_from numeric(24, 8) check (ratio_from is null or ratio_from > 0),
  ratio_to numeric(24, 8) check (ratio_to is null or ratio_to > 0),
  lifecycle_status text not null check (lifecycle_status in (
    'scheduled', 'effective', 'cancelled', 'unknown'
  )),
  provider text not null check (length(trim(provider)) between 2 and 80),
  provider_event_id text check (provider_event_id is null or length(provider_event_id) <= 240),
  source_reference text not null check (
    length(source_reference) between 12 and 500 and source_reference ~ '^https://'
  ),
  data_quality text not null check (data_quality in (
    'provider_reported', 'issuer_confirmed', 'regulatory_filing'
  )),
  as_of timestamptz not null,
  received_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint corporate_actions_required_payload check (
    (action_type not in ('cash_dividend', 'special_dividend') or cash_amount is not null)
    and (action_type not in ('split', 'reverse_split') or (ratio_from is not null and ratio_to is not null))
    and (action_type <> 'symbol_change' or (old_symbol is not null and new_symbol is not null))
  )
);

create index if not exists corporate_actions_symbol_date_idx
  on public.corporate_actions (symbol, effective_date desc);
create index if not exists corporate_actions_instrument_date_idx
  on public.corporate_actions (instrument_id, effective_date desc)
  where instrument_id is not null;
create index if not exists corporate_actions_scheduled_idx
  on public.corporate_actions (effective_date, symbol)
  where lifecycle_status = 'scheduled';

drop trigger if exists set_corporate_actions_updated_at on public.corporate_actions;
create trigger set_corporate_actions_updated_at before update on public.corporate_actions
for each row execute function public.set_updated_at();

alter table public.corporate_actions enable row level security;

revoke all on public.corporate_actions from public, anon, authenticated;
grant select on public.corporate_actions to authenticated;
grant select, insert, update, delete on public.corporate_actions to service_role;

drop policy if exists "Authenticated users read corporate actions" on public.corporate_actions;
create policy "Authenticated users read corporate actions" on public.corporate_actions
  for select to authenticated using (true);

drop policy if exists "Corporate action writes are server only" on public.corporate_actions;
create policy "Corporate action writes are server only" on public.corporate_actions
  for all to anon using (false) with check (false);
