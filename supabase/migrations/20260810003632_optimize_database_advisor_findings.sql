-- Behebt ausschliesslich reproduzierbare Hinweise des Supabase Performance
-- Advisors. Bestehende fachliche Eindeutigkeitsregeln bleiben unveraendert.

drop policy if exists "Users read their own usage" on public.feature_usage;
create policy "Users read their own usage" on public.feature_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists forecasts_model_registry_id_idx
  on public.forecasts (model_registry_id);

create index if not exists model_evaluations_model_registry_id_idx
  on public.model_evaluations (model_registry_id);

create index if not exists provider_usage_user_id_idx
  on public.provider_usage (user_id) where user_id is not null;

alter table public.provider_usage
  add column if not exists id bigint generated always as identity;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.provider_usage'::regclass
       and contype = 'p'
  ) then
    alter table public.provider_usage
      add constraint provider_usage_pkey primary key (id);
  end if;
end;
$$;
