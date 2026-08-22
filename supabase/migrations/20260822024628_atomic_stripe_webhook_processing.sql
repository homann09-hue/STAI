-- Phase 1.4: Stripe event evidence and entitlement state must commit together.
-- The function remains SECURITY INVOKER and is executable only by service_role.

alter table public.entitlements
  add column if not exists last_provider_event_created_at timestamptz;

alter table public.billing_events
  add column if not exists provider_object_id text,
  add column if not exists applied boolean,
  add column if not exists processing_reason text;

update public.billing_events
set applied = (status = 'processed')
where applied is null and provider = 'stripe';

alter table public.billing_events
  drop constraint if exists billing_events_provider_object_id_check,
  add constraint billing_events_provider_object_id_check
    check (provider_object_id is null or (length(provider_object_id) between 4 and 160 and provider_object_id ~ '^[A-Za-z0-9_:-]+$')),
  drop constraint if exists billing_events_processing_reason_check,
  add constraint billing_events_processing_reason_check
    check (processing_reason is null or (length(processing_reason) between 3 and 160 and processing_reason ~ '^[a-z0-9_:-]+$'));

update public.entitlements e
set last_provider_event_created_at = b.provider_created_at
from public.billing_events b
where e.provider = 'stripe'
  and e.last_provider_event_id = b.event_id
  and b.provider = 'stripe'
  and e.last_provider_event_created_at is null;

create index if not exists billing_events_object_created_idx
  on public.billing_events (provider, provider_object_id, provider_created_at desc)
  where provider_object_id is not null;

create or replace function public.apply_stripe_billing_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_payload_hash text,
  p_livemode boolean,
  p_provider_created_at timestamptz,
  p_provider_object_id text,
  p_apply_entitlement boolean,
  p_ignore_reason text,
  p_plan text,
  p_status text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_valid_until timestamptz,
  p_trial_ends_at timestamptz,
  p_cancel_at_period_end boolean,
  p_last_synced_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '3s'
as $$
declare
  v_applied boolean := false;
  v_entitlement_exists boolean := false;
  v_entitlement_id uuid;
  v_last_event_created_at timestamptz;
  v_last_event_id text;
  v_ledger_id uuid;
  v_reason text := null;
  v_stale boolean := false;
begin
  if p_event_id is null
    or p_event_id !~ '^evt_[A-Za-z0-9_:-]+$'
    or length(p_event_id) > 160
    or p_event_type is null
    or length(p_event_type) not between 3 and 120
    or p_payload_hash is null
    or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_provider_created_at is null
    or p_livemode is null
    or p_apply_entitlement is null
    or p_cancel_at_period_end is null
    or p_last_synced_at is null then
    raise exception 'stripe_webhook_invalid_event' using errcode = '22023';
  end if;

  if p_provider_object_id is not null and (
    length(p_provider_object_id) not between 4 and 160
    or p_provider_object_id !~ '^[A-Za-z0-9_:-]+$'
  ) then
    raise exception 'stripe_webhook_invalid_object_id' using errcode = '22023';
  end if;

  if p_ignore_reason is not null and (
    length(p_ignore_reason) not between 3 and 160
    or p_ignore_reason !~ '^[a-z0-9_:-]+$'
  ) then
    raise exception 'stripe_webhook_invalid_ignore_reason' using errcode = '22023';
  end if;

  if p_apply_entitlement and (
    p_user_id is null
    or p_plan not in ('pro', 'premium')
    or p_status not in ('active', 'trialing', 'past_due', 'canceled', 'expired', 'incomplete', 'unpaid', 'paused')
    or p_provider_customer_id is null
    or p_provider_customer_id !~ '^cus_[A-Za-z0-9_:-]+$'
    or p_provider_subscription_id is null
    or p_provider_subscription_id !~ '^sub_[A-Za-z0-9_:-]+$'
    or p_provider_price_id is null
    or p_provider_price_id !~ '^price_[A-Za-z0-9_:-]+$'
  ) then
    raise exception 'stripe_webhook_invalid_entitlement' using errcode = '22023';
  end if;

  -- All events for one account share a short transaction-scoped lock. Events
  -- without an account use their immutable event ID as the lock key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('stripe:' || coalesce(p_user_id::text, p_event_id), 0)
  );

  if exists (
    select 1
    from public.billing_events b
    where b.provider = 'stripe' and b.event_id = p_event_id
  ) then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'reason', 'duplicate_event',
      'stale', false
    );
  end if;

  if p_apply_entitlement then
    select e.last_provider_event_created_at, e.last_provider_event_id
      into v_last_event_created_at, v_last_event_id
    from public.entitlements e
    where e.user_id = p_user_id and e.provider = 'stripe'
    for update;
    v_entitlement_exists := found;

    v_stale := v_entitlement_exists
      and v_last_event_created_at is not null
      and (
        v_last_event_created_at > p_provider_created_at
        or (
          v_last_event_created_at = p_provider_created_at
          and coalesce(v_last_event_id, '') >= p_event_id
        )
      );
    if v_stale then
      v_reason := 'stale_event';
    end if;
  else
    v_reason := coalesce(p_ignore_reason, 'event_not_applied');
  end if;

  insert into public.billing_events (
    provider,
    event_id,
    event_type,
    status,
    user_id,
    payload_hash,
    livemode,
    provider_created_at,
    provider_object_id,
    applied,
    processing_reason,
    processed_at
  ) values (
    'stripe',
    p_event_id,
    p_event_type,
    case when p_apply_entitlement and not v_stale then 'processed' else 'ignored' end,
    p_user_id,
    p_payload_hash,
    p_livemode,
    p_provider_created_at,
    p_provider_object_id,
    p_apply_entitlement and not v_stale,
    v_reason,
    pg_catalog.clock_timestamp()
  )
  on conflict (provider, event_id) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'reason', 'duplicate_event',
      'stale', false
    );
  end if;

  if p_apply_entitlement and not v_stale then
    insert into public.entitlements (
      user_id,
      plan,
      status,
      provider,
      provider_customer_id,
      provider_subscription_id,
      provider_price_id,
      valid_until,
      trial_ends_at,
      cancel_at_period_end,
      last_provider_event_id,
      last_provider_event_created_at,
      last_synced_at
    ) values (
      p_user_id,
      p_plan,
      p_status,
      'stripe',
      p_provider_customer_id,
      p_provider_subscription_id,
      p_provider_price_id,
      p_valid_until,
      p_trial_ends_at,
      p_cancel_at_period_end,
      p_event_id,
      p_provider_created_at,
      p_last_synced_at
    )
    on conflict (user_id, provider) do update set
      plan = excluded.plan,
      status = excluded.status,
      provider_customer_id = excluded.provider_customer_id,
      provider_subscription_id = excluded.provider_subscription_id,
      provider_price_id = excluded.provider_price_id,
      valid_until = excluded.valid_until,
      trial_ends_at = excluded.trial_ends_at,
      cancel_at_period_end = excluded.cancel_at_period_end,
      last_provider_event_id = excluded.last_provider_event_id,
      last_provider_event_created_at = excluded.last_provider_event_created_at,
      last_synced_at = excluded.last_synced_at
    where public.entitlements.last_provider_event_created_at is null
       or (excluded.last_provider_event_created_at, excluded.last_provider_event_id)
          > (public.entitlements.last_provider_event_created_at, coalesce(public.entitlements.last_provider_event_id, ''))
    returning id into v_entitlement_id;

    if v_entitlement_id is null then
      raise exception 'stripe_webhook_ordering_conflict' using errcode = '40001';
    end if;
    v_applied := true;
  end if;

  return pg_catalog.jsonb_build_object(
    'applied', v_applied,
    'duplicate', false,
    'reason', v_reason,
    'stale', v_stale
  );
end;
$$;

revoke execute on function public.apply_stripe_billing_event(
  text, text, uuid, text, boolean, timestamptz, text, boolean, text, text,
  text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) from public, anon, authenticated;

grant execute on function public.apply_stripe_billing_event(
  text, text, uuid, text, boolean, timestamptz, text, boolean, text, text,
  text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) to service_role;

comment on function public.apply_stripe_billing_event(
  text, text, uuid, text, boolean, timestamptz, text, boolean, text, text,
  text, text, text, text, timestamptz, timestamptz, boolean, timestamptz
) is 'Atomically records a verified Stripe event and applies only the newest entitlement mutation. Service-role only.';
