create extension if not exists pgcrypto with schema extensions;

alter table public.account_deletion_jobs
  add column if not exists user_fingerprint text
  check (user_fingerprint is null or user_fingerprint ~ '^[0-9a-f]{64}$');

update public.account_deletion_jobs
set user_fingerprint = encode(extensions.digest(lower(user_id::text), 'sha256'), 'hex')
where user_id is not null and user_fingerprint is null;

create index if not exists account_deletion_jobs_user_fingerprint_idx
  on public.account_deletion_jobs (user_fingerprint)
  where user_fingerprint is not null;

create or replace function public.claim_account_deletion(p_user_id uuid, p_operation_id uuid)
returns table(job_id uuid, job_status text, claimed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'account_deletion_claim_invalid' using errcode = '22023';
  end if;

  insert into public.account_deletion_jobs (user_id, user_fingerprint)
  values (p_user_id, encode(extensions.digest(lower(p_user_id::text), 'sha256'), 'hex'))
  on conflict (user_id) where user_id is not null do nothing;

  return query
  update public.account_deletion_jobs as job
  set operation_id = p_operation_id,
      lease_expires_at = now() + interval '5 minutes',
      attempt_count = job.attempt_count + 1,
      status = case when job.status = 'failed' then 'requested' else job.status end,
      user_fingerprint = coalesce(job.user_fingerprint, encode(extensions.digest(lower(p_user_id::text), 'sha256'), 'hex')),
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
      purge_after = case when p_status = 'completed' then now() + interval '180 days' else job.purge_after end,
      user_id = case when p_status = 'completed' then null else job.user_id end,
      lease_expires_at = case when p_status in ('completed', 'failed') then null else now() + interval '5 minutes' end,
      updated_at = now()
  where job.id = p_job_id
    and job.operation_id = p_operation_id
    and (
      (job.status = 'requested' and p_status in ('requested', 'cancelling_subscriptions', 'failed')) or
      (job.status = 'cancelling_subscriptions' and p_status in ('cancelling_subscriptions', 'deleting_identity', 'failed')) or
      (job.status = 'deleting_identity' and p_status in ('deleting_identity', 'completed')) or
      (job.status = 'failed' and p_status in ('requested', 'failed'))
    )
  returning job.id into applied_id;

  if applied_id is null then return false; end if;

  insert into public.account_deletion_events (job_id, event_type, status, error_code, details)
  values (p_job_id, p_event_type, p_status, p_error_code, coalesce(p_details, '{}'));
  return true;
end;
$$;

revoke execute on function public.claim_account_deletion(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.record_account_deletion_step(uuid, uuid, text, text, jsonb, text, text[], text[]) from public, anon, authenticated;
grant execute on function public.claim_account_deletion(uuid, uuid) to service_role;
grant execute on function public.record_account_deletion_step(uuid, uuid, text, text, jsonb, text, text[], text[]) to service_role;

comment on column public.account_deletion_jobs.user_fingerprint is
  'Pseudonymous SHA-256 lookup key retained only until purge_after so late billing events cannot recreate access or charges.';
