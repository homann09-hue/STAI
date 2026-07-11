alter table public.entitlements
  add column if not exists provider_subscription_id text,
  add column if not exists provider_price_id text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists last_provider_event_id text,
  add column if not exists last_synced_at timestamptz;

alter table public.entitlements drop constraint if exists entitlements_status_check;
alter table public.entitlements add constraint entitlements_status_check
  check (status in ('demo', 'active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete', 'unpaid', 'paused'));

create unique index if not exists entitlements_provider_customer_uidx
  on public.entitlements (provider, provider_customer_id)
  where provider_customer_id is not null;
create unique index if not exists entitlements_provider_subscription_uidx
  on public.entitlements (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists entitlements_user_updated_idx
  on public.entitlements (user_id, updated_at desc);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z0-9._:-]{1,40}$'),
  event_id text not null check (length(event_id) between 4 and 160),
  event_type text not null check (length(event_type) between 3 and 120),
  status text not null check (status in ('processed', 'ignored')),
  user_id uuid references auth.users(id) on delete set null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  livemode boolean not null default false,
  provider_created_at timestamptz not null,
  processed_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists billing_events_user_received_idx
  on public.billing_events (user_id, received_at desc)
  where user_id is not null;
create index if not exists billing_events_type_received_idx
  on public.billing_events (event_type, received_at desc);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;
grant select, insert on public.billing_events to service_role;
grant select, insert, update on public.entitlements to service_role;

drop policy if exists "Server-only billing events denied" on public.billing_events;
create policy "Server-only billing events denied" on public.billing_events
  for all to anon, authenticated using (false) with check (false);

create or replace function private.protect_billing_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
    and old.user_id is not null
    and new.user_id is null
    and (to_jsonb(old) - 'user_id') = (to_jsonb(new) - 'user_id') then
    return new;
  end if;
  raise exception 'immutable_billing_event' using errcode = '55000';
end;
$$;

revoke execute on function private.protect_billing_event() from public, anon, authenticated;
grant execute on function private.protect_billing_event() to service_role;

drop trigger if exists billing_event_immutable on public.billing_events;
create trigger billing_event_immutable before update or delete on public.billing_events
for each row execute function private.protect_billing_event();

create or replace function private.current_plan_limit(p_user_id uuid, p_resource text)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  effective_plan text;
begin
  select e.plan into effective_plan
  from public.entitlements e
  where e.user_id = p_user_id
    and e.status in ('active', 'trialing')
    and e.valid_until is not null
    and e.valid_until > now()
  order by case e.plan when 'elite' then 4 when 'pro' then 3 when 'starter' then 2 else 1 end desc,
           e.updated_at desc
  limit 1;

  effective_plan := coalesce(effective_plan, 'free');

  return case p_resource
    when 'watchlistItems' then case effective_plan when 'elite' then 1000 when 'pro' then 250 when 'starter' then 50 else 10 end
    when 'alerts' then case effective_plan when 'elite' then 500 when 'pro' then 100 when 'starter' then 25 else 3 end
    when 'portfolios' then case effective_plan when 'elite' then 25 when 'pro' then 10 when 'starter' then 2 else 1 end
    else 0
  end;
end;
$$;

create or replace function private.enforce_plan_resource_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  resource_name text := tg_argv[0];
  limit_value integer;
  current_count bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || resource_name, 0));

  if tg_table_name = 'watchlists' and exists (
    select 1 from public.watchlists w where w.user_id = new.user_id and w.symbol = new.symbol
  ) then
    return new;
  end if;

  limit_value := private.current_plan_limit(new.user_id, resource_name);
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into current_count using new.user_id;

  if current_count >= limit_value then
    raise exception 'plan_limit_exceeded:%:%', resource_name, limit_value using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function private.current_plan_limit(uuid, text) from public, anon, authenticated;
revoke execute on function private.enforce_plan_resource_limit() from public, anon, authenticated;
grant execute on function private.current_plan_limit(uuid, text) to service_role;
grant execute on function private.enforce_plan_resource_limit() to service_role;

drop trigger if exists watchlists_plan_limit on public.watchlists;
create trigger watchlists_plan_limit before insert on public.watchlists
for each row execute function private.enforce_plan_resource_limit('watchlistItems');

drop trigger if exists alert_rules_plan_limit on public.alert_rules;
create trigger alert_rules_plan_limit before insert on public.alert_rules
for each row execute function private.enforce_plan_resource_limit('alerts');

drop trigger if exists portfolios_plan_limit on public.portfolios;
create trigger portfolios_plan_limit before insert on public.portfolios
for each row execute function private.enforce_plan_resource_limit('portfolios');
