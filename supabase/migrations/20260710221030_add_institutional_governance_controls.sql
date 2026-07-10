-- Institutional governance foundation for StockPilot AI.
-- Rollback strategy: disable callers first, export audit/evidence tables, then remove
-- new policies/functions/tables in reverse dependency order. Added analysis columns
-- are intentionally retained during rollback so historical provenance is not lost.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.institutional_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  name text not null check (length(trim(name)) between 2 and 200),
  status text not null default 'pilot' check (status in ('pilot', 'active', 'suspended', 'offboarding', 'closed')),
  data_region text not null default 'eu' check (data_region in ('eu', 'us', 'custom')),
  retention_policy jsonb not null default '{}'::jsonb check (jsonb_typeof(retention_policy) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institutional_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.institutional_tenants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('end_user', 'analyst', 'reviewer', 'support', 'operations', 'security_administrator', 'tenant_administrator', 'platform_administrator', 'auditor')),
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'revoked')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  constraint institutional_membership_revocation_consistent check ((status = 'revoked') = (revoked_at is not null))
);

create table if not exists public.institutional_audit_log (
  sequence_id bigint generated always as identity unique,
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.institutional_tenants(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_identifier_hash text not null check (actor_identifier_hash ~ '^[a-f0-9]{64}$'),
  actor_role text not null check (actor_role in ('end_user', 'analyst', 'reviewer', 'support', 'operations', 'security_administrator', 'tenant_administrator', 'platform_administrator', 'service_account', 'auditor', 'unknown')),
  action text not null check (length(trim(action)) between 3 and 160),
  target_type text not null check (length(trim(target_type)) between 2 and 120),
  target_id text not null check (length(trim(target_id)) between 1 and 240),
  outcome text not null check (length(trim(outcome)) between 2 and 80),
  correlation_id uuid not null,
  previous_state jsonb not null default '{}'::jsonb check (jsonb_typeof(previous_state) = 'object' and octet_length(previous_state::text) <= 65536),
  new_state jsonb not null default '{}'::jsonb check (jsonb_typeof(new_state) = 'object' and octet_length(new_state::text) <= 65536),
  reason text check (reason is null or length(reason) <= 2000),
  session_context jsonb not null default '{}'::jsonb check (jsonb_typeof(session_context) = 'object' and octet_length(session_context::text) <= 16384),
  previous_event_hash text check (previous_event_hash is null or previous_event_hash ~ '^[a-f0-9]{64}$'),
  event_hash text not null unique check (event_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now()
);

create table if not exists public.data_quality_quarantine (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.intelligence_sources(id) on delete set null,
  tenant_id uuid references public.institutional_tenants(id) on delete restrict,
  record_type text not null,
  external_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  issues jsonb not null default '[]'::jsonb check (jsonb_typeof(issues) = 'array'),
  quality_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(quality_scores) = 'object'),
  status text not null default 'pending_review' check (status in ('pending_review', 'confirmed_invalid', 'corrected', 'released', 'rejected')),
  corrected_payload jsonb check (corrected_payload is null or jsonb_typeof(corrected_payload) = 'object'),
  reviewer_id uuid references auth.users(id) on delete set null,
  correction_reason text,
  detected_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (record_type, external_id, detected_at)
);

alter table public.intelligence_analyses
  add column if not exists input_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(input_snapshot) = 'object'),
  add column if not exists system_configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(system_configuration) = 'object'),
  add column if not exists scoring_version text not null default 'legacy_unverified',
  add column if not exists processing_version text not null default 'legacy_unverified',
  add column if not exists normalization_version text not null default 'legacy_unverified',
  add column if not exists validation_status text not null default 'legacy_unverified' check (validation_status in ('legacy_unverified', 'automated_validated', 'pending_human_review', 'human_approved', 'human_rejected', 'superseded')),
  add column if not exists supersedes_analysis_id uuid references public.intelligence_analyses(id) on delete restrict,
  add column if not exists correction_reason text;

create table if not exists public.analysis_reviews (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.intelligence_analyses(id) on delete restrict,
  tenant_id uuid references public.institutional_tenants(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'needs_information', 'superseded')),
  reason text not null check (length(trim(reason)) between 5 and 4000),
  review_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(review_snapshot) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_reproduction_runs (
  id uuid primary key default gen_random_uuid(),
  original_analysis_id uuid not null references public.intelligence_analyses(id) on delete restrict,
  requested_by uuid references auth.users(id) on delete set null,
  original_input_hash text not null check (original_input_hash ~ '^[a-f0-9]{64}$'),
  reproduced_input_hash text not null check (reproduced_input_hash ~ '^[a-f0-9]{64}$'),
  original_output_hash text not null check (original_output_hash ~ '^[a-f0-9]{64}$'),
  reproduced_output_hash text not null check (reproduced_output_hash ~ '^[a-f0-9]{64}$'),
  executed_model_provider text not null,
  executed_model_name text not null,
  executed_model_version text not null,
  executed_prompt_version text not null,
  result text not null check (result in ('exact', 'drift', 'failed')),
  difference jsonb not null default '{}'::jsonb check (jsonb_typeof(difference) = 'object'),
  parameters jsonb not null default '{}'::jsonb check (jsonb_typeof(parameters) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.model_inventory (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version text not null,
  purpose text not null,
  owner text not null,
  provider text not null,
  model_name text not null,
  input_classes text[] not null default '{}',
  output_classes text[] not null default '{}',
  known_limitations text[] not null default '{}',
  prohibited_uses text[] not null default '{}',
  fallback text not null,
  validation_evidence text,
  monitoring_spec jsonb not null default '{}'::jsonb check (jsonb_typeof(monitoring_spec) = 'object'),
  kill_switch text not null,
  review_cycle_days integer not null check (review_cycle_days between 1 and 730),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'validated', 'pilot', 'active', 'suspended', 'retired')),
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (model_key, version)
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  version text not null,
  template_body text not null check (length(template_body) between 20 and 100000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  owner text not null,
  status text not null default 'draft' check (status in ('draft', 'validated', 'active', 'retired')),
  approved_by uuid references auth.users(id) on delete set null,
  validation_evidence text,
  created_at timestamptz not null default now(),
  unique (prompt_key, version),
  unique (prompt_key, content_hash)
);

create table if not exists public.institutional_feature_flags (
  id uuid primary key default gen_random_uuid(),
  flag_key text not null unique check (flag_key ~ '^[a-z][a-z0-9_]{2,100}$'),
  owner text not null,
  description text not null,
  enabled boolean not null default false,
  target text not null default 'internal' check (target in ('all', 'internal', 'tenant_allowlist')),
  tenant_allowlist uuid[] not null default '{}',
  expires_at timestamptz not null,
  rollback_behavior text not null check (rollback_behavior in ('disable', 'read_only', 'fallback')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_records (
  id uuid primary key default gen_random_uuid(),
  change_key text not null unique,
  title text not null,
  risk_class text not null check (risk_class in ('standard', 'normal', 'high_risk', 'emergency')),
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'deployed', 'verified', 'rolled_back', 'rejected')),
  owner text not null,
  reviewer text,
  issue_url text,
  test_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(test_evidence) = 'array'),
  rollback_plan text not null,
  monitoring_plan text not null,
  approved_at timestamptz,
  deployed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.control_evidence (
  id uuid primary key default gen_random_uuid(),
  control_id text not null,
  evidence_type text not null,
  evidence_location text not null,
  evidence_hash text check (evidence_hash is null or evidence_hash ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz not null default now(),
  valid_until timestamptz,
  status text not null default 'generated' check (status in ('generated', 'verified', 'expired', 'rejected')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists institutional_memberships_user_idx on public.institutional_memberships (user_id, status, tenant_id);
create index if not exists institutional_memberships_tenant_role_idx on public.institutional_memberships (tenant_id, role, status);
create index if not exists institutional_audit_tenant_time_idx on public.institutional_audit_log (tenant_id, occurred_at desc);
create index if not exists institutional_audit_actor_time_idx on public.institutional_audit_log (actor_user_id, occurred_at desc) where actor_user_id is not null;
create index if not exists institutional_audit_correlation_idx on public.institutional_audit_log (correlation_id);
create index if not exists data_quality_quarantine_status_idx on public.data_quality_quarantine (status, detected_at);
create index if not exists data_quality_quarantine_source_idx on public.data_quality_quarantine (source_id, detected_at) where source_id is not null;
create index if not exists analysis_reviews_analysis_idx on public.analysis_reviews (analysis_id, created_at desc);
create index if not exists analysis_reproduction_analysis_idx on public.analysis_reproduction_runs (original_analysis_id, created_at desc);
create index if not exists control_evidence_control_idx on public.control_evidence (control_id, generated_at desc);

alter table public.institutional_tenants enable row level security;
alter table public.institutional_memberships enable row level security;
alter table public.institutional_audit_log enable row level security;
alter table public.data_quality_quarantine enable row level security;
alter table public.analysis_reviews enable row level security;
alter table public.analysis_reproduction_runs enable row level security;
alter table public.model_inventory enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.institutional_feature_flags enable row level security;
alter table public.change_records enable row level security;
alter table public.control_evidence enable row level security;

revoke all on public.institutional_tenants from public, anon, authenticated;
revoke all on public.institutional_memberships from public, anon, authenticated;
revoke all on public.institutional_audit_log from public, anon, authenticated;
revoke all on public.data_quality_quarantine from public, anon, authenticated;
revoke all on public.analysis_reviews from public, anon, authenticated;
revoke all on public.analysis_reproduction_runs from public, anon, authenticated;
revoke all on public.model_inventory from public, anon, authenticated;
revoke all on public.prompt_versions from public, anon, authenticated;
revoke all on public.institutional_feature_flags from public, anon, authenticated;
revoke all on public.change_records from public, anon, authenticated;
revoke all on public.control_evidence from public, anon, authenticated;

grant select on public.institutional_tenants, public.institutional_memberships to authenticated;

drop policy if exists "Members read own tenants" on public.institutional_tenants;
create policy "Members read own tenants" on public.institutional_tenants
  for select to authenticated using (
    exists (
      select 1 from public.institutional_memberships membership
      where membership.tenant_id = institutional_tenants.id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  );

drop policy if exists "Users read own memberships" on public.institutional_memberships;
create policy "Users read own memberships" on public.institutional_memberships
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'immutable_record' using errcode = '55000';
end;
$$;

revoke execute on function private.reject_immutable_change() from public, anon, authenticated;
grant execute on function private.reject_immutable_change() to service_role;

drop trigger if exists institutional_audit_immutable on public.institutional_audit_log;
create trigger institutional_audit_immutable before update or delete on public.institutional_audit_log
for each row execute function private.reject_immutable_change();

drop trigger if exists intelligence_analysis_immutable on public.intelligence_analyses;
create trigger intelligence_analysis_immutable before update or delete on public.intelligence_analyses
for each row execute function private.reject_immutable_change();

drop trigger if exists analysis_review_immutable on public.analysis_reviews;
create trigger analysis_review_immutable before update or delete on public.analysis_reviews
for each row execute function private.reject_immutable_change();

drop trigger if exists analysis_reproduction_immutable on public.analysis_reproduction_runs;
create trigger analysis_reproduction_immutable before update or delete on public.analysis_reproduction_runs
for each row execute function private.reject_immutable_change();

drop trigger if exists model_inventory_immutable on public.model_inventory;
create trigger model_inventory_immutable before update or delete on public.model_inventory
for each row execute function private.reject_immutable_change();

drop trigger if exists prompt_version_immutable on public.prompt_versions;
create trigger prompt_version_immutable before update or delete on public.prompt_versions
for each row execute function private.reject_immutable_change();

create or replace function public.append_institutional_audit_event(
  p_actor_user_id uuid,
  p_actor_role text,
  p_tenant_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_outcome text,
  p_correlation_id uuid,
  p_previous_state jsonb default '{}'::jsonb,
  p_new_state jsonb default '{}'::jsonb,
  p_reason text default null,
  p_session_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions, pg_catalog
as $$
declare
  new_id uuid := gen_random_uuid();
  prior_hash text;
  actor_hash text;
  calculated_hash text;
begin
  if p_actor_role not in ('end_user', 'analyst', 'reviewer', 'support', 'operations', 'security_administrator', 'tenant_administrator', 'platform_administrator', 'service_account', 'auditor', 'unknown') then
    raise exception 'invalid_actor_role' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tenant_id::text, 'platform'), 0));
  select event_hash into prior_hash
  from public.institutional_audit_log
  where tenant_id is not distinct from p_tenant_id
  order by sequence_id desc
  limit 1;

  actor_hash := encode(extensions.digest(convert_to(coalesce(p_actor_user_id::text, p_actor_role), 'UTF8'), 'sha256'), 'hex');
  calculated_hash := encode(extensions.digest(convert_to(concat_ws('|',
    new_id::text,
    coalesce(p_tenant_id::text, ''),
    actor_hash,
    p_actor_role,
    p_action,
    p_target_type,
    p_target_id,
    p_outcome,
    p_correlation_id::text,
    coalesce(p_previous_state, '{}'::jsonb)::text,
    coalesce(p_new_state, '{}'::jsonb)::text,
    coalesce(p_reason, ''),
    coalesce(prior_hash, '')
  ), 'UTF8'), 'sha256'), 'hex');

  insert into public.institutional_audit_log (
    id, tenant_id, actor_user_id, actor_identifier_hash, actor_role, action,
    target_type, target_id, outcome, correlation_id, previous_state,
    new_state, reason, session_context, previous_event_hash, event_hash
  ) values (
    new_id, p_tenant_id, p_actor_user_id, actor_hash, p_actor_role, p_action,
    p_target_type, p_target_id, p_outcome, p_correlation_id,
    coalesce(p_previous_state, '{}'::jsonb), coalesce(p_new_state, '{}'::jsonb),
    p_reason, coalesce(p_session_context, '{}'::jsonb), prior_hash, calculated_hash
  );

  return new_id;
end;
$$;

revoke execute on function public.append_institutional_audit_event(uuid,text,uuid,text,text,text,text,uuid,jsonb,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.append_institutional_audit_event(uuid,text,uuid,text,text,text,text,uuid,jsonb,jsonb,text,jsonb) to service_role;

comment on table public.institutional_tenants is 'Enterprise tenant boundary. Mutation is server-only until SSO/SCIM and administrative approval workflows are implemented.';
comment on table public.institutional_audit_log is 'Append-only, hash-chained control log. No secrets or complete provider payloads may be written.';
comment on table public.data_quality_quarantine is 'Server-only quarantine for invalid or untrusted records. Release requires documented review.';
comment on table public.analysis_reproduction_runs is 'Append-only evidence of controlled historical analysis reproduction and drift.';

create or replace view public.intelligence_feed
with (security_invoker = true)
as
select
  n.id,
  n.normalized_title as title,
  n.normalized_title,
  n.primary_symbol,
  n.company_id,
  n.canonical_event_type,
  n.event_time,
  n.confirmation_status,
  n.source_credibility_score,
  n.entity_confidence,
  r.external_id,
  r.source_url,
  r.content_hash,
  s.provider,
  coalesce(r.raw_payload ->> 'site', s.name) as publisher,
  coalesce(s.configuration ->> 'latency_class', 'periodic') as latency_class,
  a.summary,
  a.extracted_facts,
  a.uncertainties,
  a.bullish_factors,
  a.bearish_factors,
  a.neutral_factors,
  a.affected_time_horizon,
  a.sentiment_score,
  a.relevance_score,
  a.novelty_score,
  a.credibility_score,
  a.impact_score,
  a.positive_impact_score,
  a.negative_impact_score,
  a.direction,
  a.confidence_score,
  a.reasoning_summary,
  a.citations,
  a.model_provider,
  a.model_name,
  a.requires_human_review,
  a.score_components,
  a.independent_source_count,
  a.created_at as analyzed_at,
  a.id as analysis_id,
  a.model_version,
  a.prompt_version,
  a.input_hash,
  a.scoring_version,
  a.processing_version,
  a.normalization_version,
  a.validation_status
from public.normalized_intelligence_events n
join public.raw_intelligence_events r on r.id = n.raw_event_id
join public.intelligence_sources s on s.id = r.source_id
join lateral (
  select analysis.*
  from public.intelligence_analyses analysis
  where analysis.event_id = n.id
  order by analysis.created_at desc
  limit 1
) a on true
where not exists (
  select 1 from public.intelligence_event_duplicates d where d.duplicate_event_id = n.id
);

revoke all on public.intelligence_feed from anon, authenticated;
grant select on public.intelligence_feed to service_role;
