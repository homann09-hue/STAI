create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  asset_type text not null check (asset_type in ('stock', 'etf', 'crypto')),
  created_at timestamptz default now(),
  unique (user_id, symbol)
);

create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  alert_type text not null check (
    alert_type in ('price', 'rsi', 'news', 'volume', 'earnings', 'ai-risk', 'ai-shift', 'portfolio-risk')
  ),
  condition jsonb not null,
  enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  asset_type text not null default 'stock' check (asset_type in ('stock', 'etf', 'crypto')),
  sector text not null default 'Unclassified',
  quantity numeric not null,
  average_price numeric not null,
  currency text default 'USD',
  purchased_at date,
  created_at timestamptz default now()
);

create table if not exists public.analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  provider text default 'mock',
  payload jsonb not null,
  created_at timestamptz default now()
);

create index if not exists watchlists_user_symbol_idx on public.watchlists (user_id, symbol);
create index if not exists alert_rules_user_enabled_idx on public.alert_rules (user_id, enabled);
create index if not exists portfolio_positions_user_symbol_idx on public.portfolio_positions (user_id, symbol);
create index if not exists analysis_snapshots_user_symbol_created_idx on public.analysis_snapshots (user_id, symbol, created_at desc);

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.alert_rules enable row level security;
alter table public.portfolio_positions enable row level security;
alter table public.analysis_snapshots enable row level security;

create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users manage own watchlist" on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own alerts" on public.alert_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own portfolio" on public.portfolio_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own analyses" on public.analysis_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
