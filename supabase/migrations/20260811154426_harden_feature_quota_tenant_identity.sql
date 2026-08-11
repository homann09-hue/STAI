-- Bind quota consumption to the authenticated database identity.
--
-- The previous function accepted a user UUID and was callable only through the
-- service role. Although the API supplied a verified UUID, that moved tenant
-- separation back into application code. This replacement derives the owner
-- from auth.uid(), keeps the table itself read-only for authenticated clients,
-- and exposes only the atomic operation required by the API.

drop function if exists public.consume_feature_quota(uuid, text, integer);

create function public.consume_feature_quota(
  p_feature text,
  p_limit integer
)
returns table (allowed boolean, used integer, quota_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_used integer;
  v_today date := (pg_catalog.now() at time zone 'utc')::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_feature not in ('ai_analysis', 'api_request') then
    raise exception 'Unknown quota feature.' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 0 or p_limit > 100000 then
    raise exception 'Invalid quota limit.' using errcode = '22023';
  end if;

  if p_limit = 0 then
    select coalesce(fu.used, 0) into v_used
      from public.feature_usage fu
     where fu.user_id = v_user_id
       and fu.feature = p_feature
       and fu.usage_date = v_today;

    return query select false, coalesce(v_used, 0), p_limit;
    return;
  end if;

  insert into public.feature_usage as fu (user_id, feature, usage_date, used)
  values (v_user_id, p_feature, v_today, 1)
  on conflict (user_id, feature, usage_date)
  do update
    set used = fu.used + 1,
        updated_at = pg_catalog.now()
    where fu.used < p_limit
  returning fu.used into v_used;

  if v_used is not null then
    return query select true, v_used, p_limit;
    return;
  end if;

  select fu.used into v_used
    from public.feature_usage fu
   where fu.user_id = v_user_id
     and fu.feature = p_feature
     and fu.usage_date = v_today;

  return query select false, coalesce(v_used, p_limit), p_limit;
end;
$$;

revoke all on function public.consume_feature_quota(text, integer) from public, anon, service_role;
grant execute on function public.consume_feature_quota(text, integer) to authenticated;

comment on function public.consume_feature_quota(text, integer) is
  'Atomically consumes a daily feature quota for auth.uid(); callers cannot select another tenant.';
