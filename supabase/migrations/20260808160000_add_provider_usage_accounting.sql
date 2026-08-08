-- Zaehlung der Anbieterabrufe je Tag, Konto, Tarif und Anbieter.
--
-- Ohne sie war das Kostenmodell aus §7 Theorie: es konnte rechnen, hatte aber
-- keine Zahlen. Hier entsteht die Bruecke von einem Abruf zu Konto und Tarif.
--
-- `user_id` darf NULL sein. Abrufe ohne angemeldetes Konto sind Teil der
-- Gesamtkosten und duerfen nicht verschwinden -- sie sind nur keinem Tarif
-- zurechenbar. Ein normaler Primaerschluessel wuerde NULL nicht deduplizieren,
-- deshalb zwei partielle eindeutige Indizes statt eines Schluessels.

create table if not exists public.provider_usage (
  usage_date date not null default (now() at time zone 'utc')::date,
  user_id uuid references auth.users (id) on delete set null,
  plan text not null default 'free',
  provider text not null,
  fetches integer not null default 0,
  cache_hits integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint provider_usage_used_not_negative check (fetches >= 0 and cache_hits >= 0),
  constraint provider_usage_provider_shape check (provider ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint provider_usage_plan_check check (plan = any (array['free','pro','premium']))
);

create unique index if not exists provider_usage_user_key
  on public.provider_usage (usage_date, user_id, provider) where user_id is not null;
create unique index if not exists provider_usage_shared_key
  on public.provider_usage (usage_date, provider) where user_id is null;
create index if not exists provider_usage_date_idx on public.provider_usage (usage_date);

alter table public.provider_usage enable row level security;
revoke all on public.provider_usage from public, anon, authenticated;
grant select, insert, update, delete on public.provider_usage to service_role;

drop policy if exists "Provider usage is server only" on public.provider_usage;
create policy "Provider usage is server only" on public.provider_usage
  for all to service_role using (true) with check (true);

create or replace function public.record_provider_usage(
  p_user_id uuid,
  p_plan text,
  p_provider text,
  p_from_cache boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_plan text := coalesce(nullif(p_plan, ''), 'free');
begin
  if p_user_id is null then
    insert into public.provider_usage as pu (usage_date, user_id, plan, provider, fetches, cache_hits)
    values (v_today, null, v_plan, p_provider,
            case when p_from_cache then 0 else 1 end,
            case when p_from_cache then 1 else 0 end)
    on conflict (usage_date, provider) where user_id is null
    do update set
      fetches = pu.fetches + case when p_from_cache then 0 else 1 end,
      cache_hits = pu.cache_hits + case when p_from_cache then 1 else 0 end,
      updated_at = now();
  else
    insert into public.provider_usage as pu (usage_date, user_id, plan, provider, fetches, cache_hits)
    values (v_today, p_user_id, v_plan, p_provider,
            case when p_from_cache then 0 else 1 end,
            case when p_from_cache then 1 else 0 end)
    on conflict (usage_date, user_id, provider) where user_id is not null
    do update set
      fetches = pu.fetches + case when p_from_cache then 0 else 1 end,
      cache_hits = pu.cache_hits + case when p_from_cache then 1 else 0 end,
      plan = v_plan,
      updated_at = now();
  end if;
end;
$$;

revoke execute on function public.record_provider_usage(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_provider_usage(uuid, text, text, boolean) to service_role;

comment on table public.provider_usage is
  'Abrufe je Tag, Konto, Tarif und Anbieter. user_id NULL bedeutet: Abruf ohne angemeldetes Konto.';
