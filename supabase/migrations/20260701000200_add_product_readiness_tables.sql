create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z0-9]{2,12}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolios_name_not_blank check (length(trim(name)) > 0)
);

alter table public.portfolio_positions add column if not exists portfolio_id uuid references public.portfolios(id) on delete cascade;
alter table public.portfolio_transactions add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'system' check (category in ('alert', 'provider', 'portfolio', 'system', 'billing', 'data')),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  title text not null,
  message text not null,
  href text,
  source text not null default 'StockPilot AI',
  status text not null default 'new' check (status in ('new', 'read', 'blocked', 'action_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_title_not_blank check (length(trim(title)) > 0),
  constraint notifications_message_not_blank check (length(trim(message)) > 0)
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'elite')),
  status text not null default 'demo' check (status in ('demo', 'active', 'past_due', 'canceled', 'trialing')),
  provider text not null default 'manual',
  provider_customer_id text,
  valid_until timestamptz,
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists portfolios_user_default_idx on public.portfolios (user_id, is_default desc, created_at desc);
create index if not exists portfolio_positions_user_portfolio_idx on public.portfolio_positions (user_id, portfolio_id, symbol);
create index if not exists portfolio_transactions_user_portfolio_idx on public.portfolio_transactions (user_id, portfolio_id, executed_at desc);
create index if not exists notifications_user_status_idx on public.notifications (user_id, status, created_at desc);
create index if not exists entitlements_user_status_idx on public.entitlements (user_id, status, plan);

drop trigger if exists set_portfolios_updated_at on public.portfolios;
create trigger set_portfolios_updated_at before update on public.portfolios
for each row execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists set_entitlements_updated_at on public.entitlements;
create trigger set_entitlements_updated_at before update on public.entitlements
for each row execute function public.set_updated_at();

alter table public.portfolios enable row level security;
alter table public.notifications enable row level security;
alter table public.entitlements enable row level security;

grant select, insert, update, delete on public.portfolios to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select on public.entitlements to authenticated;

drop policy if exists "Users read own portfolios" on public.portfolios;
drop policy if exists "Users insert own portfolios" on public.portfolios;
drop policy if exists "Users update own portfolios" on public.portfolios;
drop policy if exists "Users delete own portfolios" on public.portfolios;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users insert own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Users delete own notifications" on public.notifications;
drop policy if exists "Users read own entitlements" on public.entitlements;

create policy "Users read own portfolios" on public.portfolios
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own portfolios" on public.portfolios
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own portfolios" on public.portfolios
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own portfolios" on public.portfolios
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users insert own notifications" on public.notifications
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users update own notifications" on public.notifications
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own notifications" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own entitlements" on public.entitlements
  for select to authenticated using ((select auth.uid()) = user_id);
