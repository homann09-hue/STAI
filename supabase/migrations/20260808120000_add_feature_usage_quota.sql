-- Tagesquoten je Konto und Funktion.
--
-- Die Tarife versprechen seit Beginn `aiAnalysesPerDay` und
-- `apiRequestsPerDay`. Geprueft wurde bisher nichts: ein Free-Konto konnte
-- beliebig viele kostenpflichtige Analysen ausloesen. Das ist zugleich ein
-- Kostenproblem (§7) und eine unwahre Zusage im Tarif (§4).
--
-- Warum eine Tabelle und kein Zaehler im Prozessspeicher: Vercel startet
-- Funktionen kalt und parallel. Ein Zaehler im Arbeitsspeicher wuerde bei jedem
-- Kaltstart auf null springen und waere damit eine Scheinkontrolle.
--
-- Der Schluessel ist bewusst (Konto, Funktion, Tag) in UTC. Eine Quote, die von
-- der Zeitzone des Aufrufers abhaengt, laesst sich durch Reisen umgehen.

create table if not exists public.feature_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  usage_date date not null default (now() at time zone 'utc')::date,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint feature_usage_pkey primary key (user_id, feature, usage_date),
  constraint feature_usage_used_not_negative check (used >= 0),
  constraint feature_usage_feature_shape check (feature ~ '^[a-z][a-z0-9_]{1,60}$')
);

-- Aufraeumen alter Zeitraeume soll einen Index haben; sonst wird die
-- Loeschung mit wachsender Tabelle zum Tabellenscan.
create index if not exists feature_usage_date_idx on public.feature_usage (usage_date);

alter table public.feature_usage enable row level security;

revoke all on public.feature_usage from public, anon, authenticated;

-- Lesen ja, schreiben nein. Ein Konto, das seinen eigenen Zaehler
-- zuruecksetzen koennte, haette keine Quote.
grant select on public.feature_usage to authenticated;
grant select, insert, update, delete on public.feature_usage to service_role;

drop policy if exists "Users read their own usage" on public.feature_usage;
create policy "Users read their own usage" on public.feature_usage
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Usage writes are server only" on public.feature_usage;
create policy "Usage writes are server only" on public.feature_usage
  for all to service_role
  using (true) with check (true);

-- Verbrauch zaehlen und Grenze pruefen in einer einzigen Anweisung.
--
-- Der entscheidende Punkt ist die Atomaritaet: waeren Lesen und Erhoehen zwei
-- Schritte, koennten zwei gleichzeitige Anfragen beide die letzte freie
-- Einheit sehen und beide zugreifen. Die Bedingung sitzt deshalb im
-- `on conflict ... where`, nicht im Anwendungscode.
create or replace function public.consume_feature_quota(
  p_user_id uuid,
  p_feature text,
  p_limit integer
)
returns table (allowed boolean, used integer, quota_limit integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_used integer;
  v_today date := (now() at time zone 'utc')::date;
begin
  if p_limit is null or p_limit <= 0 then
    -- Eine Grenze von null ist kein Fehler, sondern ein Tarif ohne diese
    -- Funktion. Es wird nichts gezaehlt und nichts freigegeben.
    select coalesce(fu.used, 0) into v_used
      from public.feature_usage fu
     where fu.user_id = p_user_id and fu.feature = p_feature and fu.usage_date = v_today;
    return query select false, coalesce(v_used, 0), coalesce(p_limit, 0);
    return;
  end if;

  insert into public.feature_usage as fu (user_id, feature, usage_date, used)
  values (p_user_id, p_feature, v_today, 1)
  on conflict (user_id, feature, usage_date)
  do update set used = fu.used + 1, updated_at = now()
    where fu.used < p_limit
  returning fu.used into v_used;

  if v_used is not null then
    return query select true, v_used, p_limit;
    return;
  end if;

  -- Kein Rueckgabewert heisst: die Bedingung hat gegriffen, die Quote ist
  -- ausgeschoepft. Der Stand wird gelesen, damit die Antwort ihn nennen kann.
  select fu.used into v_used
    from public.feature_usage fu
   where fu.user_id = p_user_id and fu.feature = p_feature and fu.usage_date = v_today;

  return query select false, coalesce(v_used, p_limit), p_limit;
end;
$$;

revoke execute on function public.consume_feature_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_feature_quota(uuid, text, integer) to service_role;

comment on table public.feature_usage is
  'Tagesverbrauch je Konto und Funktion in UTC. Schreibzugriff ausschliesslich serverseitig.';
comment on function public.consume_feature_quota(uuid, text, integer) is
  'Zaehlt eine Nutzung und prueft die Tagesgrenze in einer atomaren Anweisung.';
