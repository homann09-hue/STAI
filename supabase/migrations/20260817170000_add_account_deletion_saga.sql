create table if not exists public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  status text not null default 'requested'
    check (status in ('requested', 'cancelling_subscriptions', 'deleting_identity', 'completed', 'failed')),
  operation_id uuid,
  lease_expires_at timestamptz,
  stripe_customer_ids text[] not null default '{}',
  cancelled_subscription_ids text[] not null default '{}',
  attempt_count integer not null default 0 check (attempt_count between 0 and 10000),
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Za-z0-9_:-]{1,80}$'),
  last_error_at timestamptz,
  completed_at timestamptz,
  purge_after timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(stripe_customer_ids) <= 1000),
  check (cardinality(cancelled_subscription_ids) <= 1000),
  check ((status = 'completed' and completed_at is not null and user_id is null) or status <> 'completed')
);

create unique index if not exists account_deletion_jobs_active_user_uidx
  on public.account_deletion_jobs (user_id)
  where user_id is not null;
create index if not exists account_deletion_jobs_recovery_idx
  on public.account_deletion_jobs (status, lease_expires_at, updated_at)
  where status = 'deleting_identity';
create index if not exists account_deletion_jobs_customer_ids_gin
  on public.account_deletion_jobs using gin (stripe_customer_ids);

create table if not exists public.account_deletion_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.account_deletion_jobs(id) on delete cascade,
  event_type text not null check (event_type ~ '^[a-z0-9_:-]{3,80}$'),
  status text not null check (status in ('requested', 'cancelling_subscriptions', 'deleting_identity', 'completed', 'failed')),
  error_code text check (error_code is null or error_code ~ '^[A-Za-z0-9_:-]{1,80}$'),
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (jsonb_typeof(details) = 'object'),
  check (pg_column_size(details) <= 16384)
);

create index if not exists account_deletion_events_job_created_idx
  on public.account_deletion_events (job_id, created_at);

alter table public.account_deletion_jobs enable row level security;
alter table public.account_deletion_events enable row level security;
revoke all on public.account_deletion_jobs, public.account_deletion_events from public, anon, authenticated;
grant select, insert, update, delete on public.account_deletion_jobs to service_role;
grant select, insert on public.account_deletion_events to service_role;
grant usage, select on sequence public.account_deletion_events_id_seq to service_role;

create or replace function public.claim_account_deletion(p_user_id uuid, p_operation_id uuid)
returns table(job_id uuid, job_status text, claimed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'account_deletion_claim_invalid' using errcode = '22023';
  end if;

  insert into public.account_deletion_jobs (user_id)
  values (p_user_id)
  on conflict (user_id) where user_id is not null do nothing;

  return query
  update public.account_deletion_jobs as job
  set operation_id = p_operation_id,
      lease_expires_at = now() + interval '5 minutes',
      attempt_count = job.attempt_count + 1,
      status = case when job.status = 'failed' then 'requested' else job.status end,
      last_error_code = null,
      last_error_at = null,
      updated_at = now()
  where job.user_id = p_user_id
    and (job.operation_id = p_operation_id or job.lease_expires_at is null or job.lease_expires_at <= now())
  returning job.id, job.status, true;

  if found then return; end if;

  return query
  select job.id, job.status, false
  from public.account_deletion_jobs as job
  where job.user_id = p_user_id
  limit 1;
end;
$$;

create or replace function public.claim_account_deletion_recovery(p_job_id uuid, p_operation_id uuid)
returns table(job_id uuid, subject_user_id uuid, claimed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  update public.account_deletion_jobs as job
  set operation_id = p_operation_id,
      lease_expires_at = now() + interval '5 minutes',
      attempt_count = job.attempt_count + 1,
      updated_at = now()
  where job.id = p_job_id
    and job.status = 'deleting_identity'
    and job.user_id is not null
    and (job.lease_expires_at is null or job.lease_expires_at <= now())
  returning job.id, job.user_id, true;

  if found then return; end if;

  return query select p_job_id, null::uuid, false;
end;
$$;

create or replace function public.record_account_deletion_step(
  p_job_id uuid,
  p_operation_id uuid,
  p_status text,
  p_event_type text,
  p_details jsonb default '{}',
  p_error_code text default null,
  p_stripe_customer_ids text[] default null,
  p_cancelled_subscription_ids text[] default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  applied_id uuid;
begin
  if p_status not in ('requested', 'cancelling_subscriptions', 'deleting_identity', 'completed', 'failed')
    or p_event_type !~ '^[a-z0-9_:-]{3,80}$'
    or jsonb_typeof(coalesce(p_details, '{}')) <> 'object'
    or pg_column_size(coalesce(p_details, '{}')) > 16384 then
    raise exception 'account_deletion_step_invalid' using errcode = '22023';
  end if;

  update public.account_deletion_jobs as job
  set status = p_status,
      stripe_customer_ids = coalesce(p_stripe_customer_ids, job.stripe_customer_ids),
      cancelled_subscription_ids = coalesce(p_cancelled_subscription_ids, job.cancelled_subscription_ids),
      last_error_code = p_error_code,
      last_error_at = case when p_error_code is null then null else now() end,
      completed_at = case when p_status = 'completed' then now() else null end,
      user_id = case when p_status = 'completed' then null else job.user_id end,
      lease_expires_at = case when p_status in ('completed', 'failed') then null else now() + interval '5 minutes' end,
      updated_at = now()
  where job.id = p_job_id and job.operation_id = p_operation_id
  returning job.id into applied_id;

  if applied_id is null then return false; end if;

  insert into public.account_deletion_events (job_id, event_type, status, error_code, details)
  values (p_job_id, p_event_type, p_status, p_error_code, coalesce(p_details, '{}'));
  return true;
end;
$$;

revoke execute on function public.claim_account_deletion(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.claim_account_deletion_recovery(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_account_deletion_step(uuid, uuid, text, text, jsonb, text, text[], text[]) from public, anon, authenticated;
grant execute on function public.claim_account_deletion(uuid, uuid) to service_role;
grant execute on function public.claim_account_deletion_recovery(uuid, uuid) to service_role;
grant execute on function public.record_account_deletion_step(uuid, uuid, text, text, jsonb, text, text[], text[]) to service_role;

comment on table public.account_deletion_jobs is
  'Server-only, resumable account-deletion saga. Completed rows retain only Stripe tombstones and operational evidence until purge_after.';
comment on table public.account_deletion_events is
  'Append-only audit events for account deletion without email addresses or request tokens.';
