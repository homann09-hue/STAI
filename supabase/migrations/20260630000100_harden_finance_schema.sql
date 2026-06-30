create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.watchlists add column if not exists updated_at timestamptz default now();
alter table public.alert_rules add column if not exists updated_at timestamptz default now();
alter table public.portfolio_positions add column if not exists updated_at timestamptz default now();
alter table public.analysis_snapshots add column if not exists updated_at timestamptz default now();

alter table public.watchlists drop constraint if exists watchlists_asset_type_check;
alter table public.watchlists
  add constraint watchlists_asset_type_check
  check (asset_type in ('stock', 'etf', 'crypto', 'forex', 'index', 'commodity', 'future', 'option', 'cash'));

alter table public.portfolio_positions drop constraint if exists portfolio_positions_asset_type_check;
alter table public.portfolio_positions
  add constraint portfolio_positions_asset_type_check
  check (asset_type in ('stock', 'etf', 'crypto', 'forex', 'index', 'commodity', 'future', 'option', 'cash'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watchlists_symbol_not_blank') then
    alter table public.watchlists add constraint watchlists_symbol_not_blank check (length(trim(symbol)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'alert_rules_symbol_not_blank') then
    alter table public.alert_rules add constraint alert_rules_symbol_not_blank check (length(trim(symbol)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'alert_rules_condition_object') then
    alter table public.alert_rules add constraint alert_rules_condition_object check (jsonb_typeof(condition) = 'object');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolio_positions_symbol_not_blank') then
    alter table public.portfolio_positions add constraint portfolio_positions_symbol_not_blank check (length(trim(symbol)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolio_positions_quantity_nonnegative') then
    alter table public.portfolio_positions add constraint portfolio_positions_quantity_nonnegative check (quantity >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolio_positions_average_price_nonnegative') then
    alter table public.portfolio_positions add constraint portfolio_positions_average_price_nonnegative check (average_price >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolio_positions_currency_format') then
    alter table public.portfolio_positions add constraint portfolio_positions_currency_format check (currency ~ '^[A-Z0-9]{2,12}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'analysis_snapshots_symbol_not_blank') then
    alter table public.analysis_snapshots add constraint analysis_snapshots_symbol_not_blank check (length(trim(symbol)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'analysis_snapshots_payload_object') then
    alter table public.analysis_snapshots add constraint analysis_snapshots_payload_object check (jsonb_typeof(payload) = 'object');
  end if;
end;
$$;

create table if not exists public.portfolio_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid references public.portfolio_positions(id) on delete set null,
  symbol text not null,
  asset_type text not null default 'stock' check (asset_type in ('stock', 'etf', 'crypto', 'forex', 'index', 'commodity', 'future', 'option', 'cash')),
  side text not null check (side in ('buy', 'sell', 'dividend', 'fee', 'deposit', 'withdrawal')),
  quantity numeric(28, 10) not null default 0 check (quantity >= 0),
  price numeric(28, 10) not null default 0 check (price >= 0),
  fees numeric(28, 10) not null default 0 check (fees >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z0-9]{2,12}$'),
  executed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_transactions_symbol_not_blank check (length(trim(symbol)) > 0)
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_rule_id uuid references public.alert_rules(id) on delete cascade,
  symbol text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  triggered_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_events_symbol_not_blank check (length(trim(symbol)) > 0)
);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  total_value numeric(28, 10) not null default 0 check (total_value >= 0),
  total_pnl numeric(28, 10) not null default 0,
  total_pnl_percent numeric(14, 6) not null default 0,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  allocation jsonb not null default '[]'::jsonb check (jsonb_typeof(allocation) = 'array'),
  currency text not null default 'USD' check (currency ~ '^[A-Z0-9]{2,12}$'),
  snapshot_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.data_provider_status (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  service text not null,
  status text not null default 'unknown' check (status in ('ok', 'degraded', 'down', 'rate_limited', 'missing_key', 'unknown')),
  quality text not null default 'unavailable' check (quality in ('realtime', 'near_realtime', 'delayed', 'historical', 'mock', 'unavailable')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  last_success_at timestamptz,
  last_error_at timestamptz,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, service),
  constraint data_provider_status_provider_not_blank check (length(trim(provider)) > 0),
  constraint data_provider_status_service_not_blank check (length(trim(service)) > 0)
);

create index if not exists watchlists_user_symbol_idx on public.watchlists (user_id, symbol);
create index if not exists alert_rules_user_enabled_idx on public.alert_rules (user_id, enabled);
create index if not exists portfolio_positions_user_symbol_idx on public.portfolio_positions (user_id, symbol);
create index if not exists analysis_snapshots_user_symbol_created_idx on public.analysis_snapshots (user_id, symbol, created_at desc);
create index if not exists portfolio_transactions_user_symbol_executed_idx on public.portfolio_transactions (user_id, symbol, executed_at desc);
create index if not exists alert_events_user_triggered_idx on public.alert_events (user_id, triggered_at desc);
create index if not exists portfolio_snapshots_user_snapshot_idx on public.portfolio_snapshots (user_id, snapshot_at desc);
create index if not exists data_provider_status_provider_service_idx on public.data_provider_status (provider, service);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_watchlists_updated_at on public.watchlists;
create trigger set_watchlists_updated_at before update on public.watchlists
for each row execute function public.set_updated_at();

drop trigger if exists set_alert_rules_updated_at on public.alert_rules;
create trigger set_alert_rules_updated_at before update on public.alert_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_portfolio_positions_updated_at on public.portfolio_positions;
create trigger set_portfolio_positions_updated_at before update on public.portfolio_positions
for each row execute function public.set_updated_at();

drop trigger if exists set_analysis_snapshots_updated_at on public.analysis_snapshots;
create trigger set_analysis_snapshots_updated_at before update on public.analysis_snapshots
for each row execute function public.set_updated_at();

drop trigger if exists set_portfolio_transactions_updated_at on public.portfolio_transactions;
create trigger set_portfolio_transactions_updated_at before update on public.portfolio_transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_alert_events_updated_at on public.alert_events;
create trigger set_alert_events_updated_at before update on public.alert_events
for each row execute function public.set_updated_at();

drop trigger if exists set_data_provider_status_updated_at on public.data_provider_status;
create trigger set_data_provider_status_updated_at before update on public.data_provider_status
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.alert_rules enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.analysis_snapshots enable row level security;
alter table public.portfolio_transactions enable row level security;
alter table public.alert_events enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.data_provider_status enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.watchlists to authenticated;
grant select, insert, update, delete on public.alert_rules to authenticated;
grant select, insert, update, delete on public.portfolio_positions to authenticated;
grant select, insert, update, delete on public.analysis_snapshots to authenticated;
grant select, insert, update, delete on public.portfolio_transactions to authenticated;
grant select, insert, update, delete on public.alert_events to authenticated;
grant select, insert, delete on public.portfolio_snapshots to authenticated;
grant select on public.data_provider_status to anon, authenticated;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users manage own watchlist" on public.watchlists;
drop policy if exists "Users manage own alerts" on public.alert_rules;
drop policy if exists "Users manage own portfolio" on public.portfolio_positions;
drop policy if exists "Users manage own analyses" on public.analysis_snapshots;

drop policy if exists "Users read own watchlist" on public.watchlists;
drop policy if exists "Users insert own watchlist" on public.watchlists;
drop policy if exists "Users update own watchlist" on public.watchlists;
drop policy if exists "Users delete own watchlist" on public.watchlists;
drop policy if exists "Users read own alerts" on public.alert_rules;
drop policy if exists "Users insert own alerts" on public.alert_rules;
drop policy if exists "Users update own alerts" on public.alert_rules;
drop policy if exists "Users delete own alerts" on public.alert_rules;
drop policy if exists "Users read own portfolio positions" on public.portfolio_positions;
drop policy if exists "Users insert own portfolio positions" on public.portfolio_positions;
drop policy if exists "Users update own portfolio positions" on public.portfolio_positions;
drop policy if exists "Users delete own portfolio positions" on public.portfolio_positions;
drop policy if exists "Users read own analyses" on public.analysis_snapshots;
drop policy if exists "Users insert own analyses" on public.analysis_snapshots;
drop policy if exists "Users update own analyses" on public.analysis_snapshots;
drop policy if exists "Users delete own analyses" on public.analysis_snapshots;
drop policy if exists "Users read own portfolio transactions" on public.portfolio_transactions;
drop policy if exists "Users insert own portfolio transactions" on public.portfolio_transactions;
drop policy if exists "Users update own portfolio transactions" on public.portfolio_transactions;
drop policy if exists "Users delete own portfolio transactions" on public.portfolio_transactions;
drop policy if exists "Users read own alert events" on public.alert_events;
drop policy if exists "Users insert own alert events" on public.alert_events;
drop policy if exists "Users update own alert events" on public.alert_events;
drop policy if exists "Users delete own alert events" on public.alert_events;
drop policy if exists "Users read own portfolio snapshots" on public.portfolio_snapshots;
drop policy if exists "Users insert own portfolio snapshots" on public.portfolio_snapshots;
drop policy if exists "Users delete own portfolio snapshots" on public.portfolio_snapshots;
drop policy if exists "Provider status is readable" on public.data_provider_status;

create policy "Users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy "Users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users read own watchlist" on public.watchlists
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own watchlist" on public.watchlists
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own watchlist" on public.watchlists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own watchlist" on public.watchlists
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own alerts" on public.alert_rules
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own alerts" on public.alert_rules
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own alerts" on public.alert_rules
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own alerts" on public.alert_rules
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own portfolio positions" on public.portfolio_positions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own portfolio positions" on public.portfolio_positions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own portfolio positions" on public.portfolio_positions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own portfolio positions" on public.portfolio_positions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own analyses" on public.analysis_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own analyses" on public.analysis_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own analyses" on public.analysis_snapshots
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own analyses" on public.analysis_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own portfolio transactions" on public.portfolio_transactions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own portfolio transactions" on public.portfolio_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own portfolio transactions" on public.portfolio_transactions
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own portfolio transactions" on public.portfolio_transactions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own alert events" on public.alert_events
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own alert events" on public.alert_events
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own alert events" on public.alert_events
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own alert events" on public.alert_events
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own portfolio snapshots" on public.portfolio_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own portfolio snapshots" on public.portfolio_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users delete own portfolio snapshots" on public.portfolio_snapshots
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Provider status is readable" on public.data_provider_status
  for select to anon, authenticated using (true);
