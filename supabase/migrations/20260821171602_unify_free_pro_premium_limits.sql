-- Canonical FREE / PRO / PREMIUM quantity contract.
--
-- `src/lib/feature-gates.ts#planLimitContract` is the authoring source for
-- application, admin and UI limits. This private table is the versioned
-- PostgreSQL snapshot used by insert triggers. A Vitest contract test and
-- pgTAP behaviour suite make drift between both runtimes a release failure.

create schema if not exists private;

create table if not exists private.plan_limit_contract (
  plan text primary key check (plan in ('free', 'pro', 'premium')),
  plan_rank smallint not null unique check (plan_rank between 1 and 3),
  max_watchlist_items integer not null check (max_watchlist_items between 1 and 10000),
  max_alerts integer not null check (max_alerts between 1 and 10000),
  portfolios integer not null check (portfolios between 1 and 1000),
  historical_data_years integer not null check (historical_data_years between 1 and 100),
  ai_analyses_per_day integer not null check (ai_analyses_per_day between 0 and 100000),
  api_requests_per_day integer not null check (api_requests_per_day between 0 and 100000)
);

insert into private.plan_limit_contract (
  plan,
  plan_rank,
  max_watchlist_items,
  max_alerts,
  portfolios,
  historical_data_years,
  ai_analyses_per_day,
  api_requests_per_day
) values
  ('free', 1, 15, 3, 1, 1, 3, 0),
  ('pro', 2, 250, 100, 10, 10, 100, 1000),
  ('premium', 3, 1000, 500, 25, 20, 500, 10000)
on conflict (plan) do update set
  plan_rank = excluded.plan_rank,
  max_watchlist_items = excluded.max_watchlist_items,
  max_alerts = excluded.max_alerts,
  portfolios = excluded.portfolios,
  historical_data_years = excluded.historical_data_years,
  ai_analyses_per_day = excluded.ai_analyses_per_day,
  api_requests_per_day = excluded.api_requests_per_day;

delete from private.plan_limit_contract where plan not in ('free', 'pro', 'premium');

revoke all on private.plan_limit_contract from public, anon, authenticated;
grant select on private.plan_limit_contract to service_role;

create or replace function private.current_plan_limit(p_user_id uuid, p_resource text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  effective_plan text := 'free';
  resolved_limit integer;
begin
  if p_user_id is null then
    raise exception 'Plan owner is required.' using errcode = '22023';
  end if;

  if p_resource not in ('watchlistItems', 'alerts', 'portfolios') then
    raise exception 'Unknown plan resource.' using errcode = '22023';
  end if;

  select entitlement.plan
    into effective_plan
    from public.entitlements as entitlement
    join private.plan_limit_contract as contract on contract.plan = entitlement.plan
   where entitlement.user_id = p_user_id
     and entitlement.status in ('active', 'trialing')
     and entitlement.valid_until is not null
     and entitlement.valid_until > pg_catalog.now()
   order by contract.plan_rank desc, entitlement.updated_at desc
   limit 1;

  effective_plan := coalesce(effective_plan, 'free');

  select case p_resource
           when 'watchlistItems' then contract.max_watchlist_items
           when 'alerts' then contract.max_alerts
           when 'portfolios' then contract.portfolios
         end
    into resolved_limit
    from private.plan_limit_contract as contract
   where contract.plan = effective_plan;

  if resolved_limit is null then
    raise exception 'Plan limit contract is incomplete.' using errcode = '55000';
  end if;

  return resolved_limit;
end;
$$;

revoke all on function private.current_plan_limit(uuid, text) from public, anon, authenticated;
grant execute on function private.current_plan_limit(uuid, text) to service_role;

-- Keep table-specific record access inside a nested branch. PostgreSQL may
-- resolve NEW fields before boolean short-circuiting, and portfolios do not
-- have the watchlist-only `symbol` column.
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

  if tg_table_name = 'watchlists' then
    if exists (
      select 1
      from public.watchlists w
      where w.user_id = new.user_id
        and w.symbol = new.symbol
    ) then
      return new;
    end if;
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

revoke execute on function private.enforce_plan_resource_limit() from public, anon, authenticated;
grant execute on function private.enforce_plan_resource_limit() to service_role;

comment on table private.plan_limit_contract is
  'Versioned PostgreSQL enforcement snapshot of the canonical FREE/PRO/PREMIUM limit contract.';
comment on function private.current_plan_limit(uuid, text) is
  'Resolves one database-enforced resource limit from the canonical plan contract; obsolete plan names have no active branch.';
