create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_type text not null,
  name text not null,
  base_url text not null,
  enabled boolean not null default true,
  priority smallint not null default 100 check (priority between 0 and 1000),
  trust_score numeric(5,4) not null default 0.5 check (trust_score between 0 and 1),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_sources_provider_not_blank check (length(trim(provider)) > 0),
  constraint intelligence_sources_type_not_blank check (length(trim(source_type)) > 0),
  constraint intelligence_sources_base_url_https check (base_url ~ '^https://'),
  unique (provider, source_type)
);

create table if not exists public.raw_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.intelligence_sources(id) on delete restrict,
  external_id text not null,
  source_url text not null,
  published_at timestamptz not null,
  received_at timestamptz not null default now(),
  title text not null,
  raw_text text not null default '',
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  language text not null default 'und',
  processing_status text not null default 'received' check (processing_status in ('received', 'normalized', 'analyzed', 'duplicate', 'failed', 'dead_letter')),
  processing_attempts smallint not null default 0 check (processing_attempts between 0 and 50),
  last_processing_error text,
  retention_until timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now(),
  constraint raw_intelligence_external_id_not_blank check (length(trim(external_id)) > 0),
  constraint raw_intelligence_source_url_https check (source_url ~ '^https://'),
  unique (source_id, external_id)
);

create table if not exists public.normalized_intelligence_events (
  id uuid primary key default gen_random_uuid(),
  raw_event_id uuid not null unique references public.raw_intelligence_events(id) on delete cascade,
  canonical_event_type text not null,
  normalized_title text not null,
  normalized_text text not null default '',
  primary_symbol text,
  company_id text,
  event_time timestamptz not null,
  confirmation_status text not null default 'unconfirmed' check (confirmation_status in ('confirmed', 'partially_confirmed', 'unconfirmed', 'ambiguous')),
  source_credibility_score numeric(5,4) not null check (source_credibility_score between 0 and 1),
  entity_confidence numeric(5,4) not null default 0 check (entity_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint normalized_intelligence_event_type_not_blank check (length(trim(canonical_event_type)) > 0),
  constraint normalized_intelligence_title_not_blank check (length(trim(normalized_title)) > 0)
);

create table if not exists public.intelligence_event_entities (
  event_id uuid not null references public.normalized_intelligence_events(id) on delete cascade,
  entity_type text not null check (entity_type in ('company', 'security', 'brand', 'subsidiary')),
  entity_id text,
  symbol text,
  company_name text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  relationship_type text not null check (relationship_type in ('direct', 'indirect', 'mentioned')),
  created_at timestamptz not null default now(),
  primary key (event_id, entity_type, relationship_type, symbol)
);

create table if not exists public.intelligence_event_duplicates (
  canonical_event_id uuid not null references public.normalized_intelligence_events(id) on delete cascade,
  duplicate_event_id uuid not null references public.normalized_intelligence_events(id) on delete cascade,
  similarity_score numeric(5,4) not null check (similarity_score between 0 and 1),
  duplicate_reason text not null check (duplicate_reason in ('provider_id', 'source_url', 'content_hash', 'title_similarity', 'semantic_window')),
  independent_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (canonical_event_id, duplicate_event_id),
  constraint intelligence_duplicate_not_self check (canonical_event_id <> duplicate_event_id)
);

create table if not exists public.intelligence_analyses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.normalized_intelligence_events(id) on delete cascade,
  model_provider text not null,
  model_name text not null,
  model_version text not null,
  prompt_version text not null,
  summary text not null,
  extracted_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(extracted_facts) = 'array'),
  uncertainties jsonb not null default '[]'::jsonb check (jsonb_typeof(uncertainties) = 'array'),
  bullish_factors jsonb not null default '[]'::jsonb check (jsonb_typeof(bullish_factors) = 'array'),
  bearish_factors jsonb not null default '[]'::jsonb check (jsonb_typeof(bearish_factors) = 'array'),
  neutral_factors jsonb not null default '[]'::jsonb check (jsonb_typeof(neutral_factors) = 'array'),
  affected_time_horizon text[] not null default '{}',
  sentiment_score numeric(6,5) not null check (sentiment_score between -1 and 1),
  relevance_score numeric(6,2) not null check (relevance_score between 0 and 100),
  novelty_score numeric(6,2) not null check (novelty_score between 0 and 100),
  credibility_score numeric(6,2) not null check (credibility_score between 0 and 100),
  impact_score numeric(6,2) not null check (impact_score between 0 and 100),
  positive_impact_score numeric(6,2) not null default 0 check (positive_impact_score between 0 and 100),
  negative_impact_score numeric(6,2) not null default 0 check (negative_impact_score between 0 and 100),
  direction text not null check (direction in ('positive', 'negative', 'mixed', 'unclear')),
  confidence_score numeric(6,2) not null check (confidence_score between 0 and 100),
  reasoning_summary text not null,
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  score_components jsonb not null default '{}'::jsonb check (jsonb_typeof(score_components) = 'object'),
  independent_source_count smallint not null default 1 check (independent_source_count between 1 and 100),
  requires_human_review boolean not null default false,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(14,8) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  fallback_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, model_provider, model_name, model_version, prompt_version, input_hash)
);

create table if not exists public.company_intelligence_state (
  company_id text primary key,
  symbol text not null,
  short_term_score smallint not null default 0 check (short_term_score between -100 and 100),
  medium_term_score smallint not null default 0 check (medium_term_score between -100 and 100),
  long_term_score smallint not null default 0 check (long_term_score between -100 and 100),
  positive_event_count integer not null default 0 check (positive_event_count >= 0),
  negative_event_count integer not null default 0 check (negative_event_count >= 0),
  unresolved_risk_count integer not null default 0 check (unresolved_risk_count >= 0),
  last_event_at timestamptz,
  last_recalculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intelligence_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id text,
  symbol text not null,
  event_id uuid not null references public.normalized_intelligence_events(id) on delete cascade,
  alert_type text not null,
  severity text not null check (severity in ('info', 'relevant', 'high', 'critical')),
  title text not null,
  message text not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed', 'suppressed')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_id, alert_type)
);

create table if not exists public.intelligence_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.normalized_intelligence_events(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'dead_letter')),
  priority smallint not null default 100 check (priority between 0 and 1000),
  attempts smallint not null default 0 check (attempts between 0 and 50),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists intelligence_sources_enabled_priority_idx on public.intelligence_sources (enabled, priority, provider);
create index if not exists raw_intelligence_events_external_id_idx on public.raw_intelligence_events (external_id);
create index if not exists raw_intelligence_events_content_hash_idx on public.raw_intelligence_events (content_hash);
create index if not exists raw_intelligence_events_published_idx on public.raw_intelligence_events (published_at desc);
create index if not exists raw_intelligence_events_status_idx on public.raw_intelligence_events (processing_status, received_at);
create index if not exists raw_intelligence_events_retention_idx on public.raw_intelligence_events (retention_until);
create index if not exists normalized_intelligence_company_idx on public.normalized_intelligence_events (company_id, event_time desc);
create index if not exists normalized_intelligence_symbol_idx on public.normalized_intelligence_events (primary_symbol, event_time desc);
create index if not exists normalized_intelligence_type_idx on public.normalized_intelligence_events (canonical_event_type, event_time desc);
create index if not exists intelligence_entities_symbol_idx on public.intelligence_event_entities (symbol, confidence desc);
create index if not exists intelligence_analyses_impact_idx on public.intelligence_analyses (impact_score desc, created_at desc);
create index if not exists intelligence_analyses_event_created_idx on public.intelligence_analyses (event_id, created_at desc);
create index if not exists company_intelligence_symbol_idx on public.company_intelligence_state (symbol);
create index if not exists intelligence_alerts_user_created_idx on public.intelligence_alerts (user_id, created_at desc);
create index if not exists intelligence_alerts_delivery_idx on public.intelligence_alerts (delivery_status, severity, created_at);
create index if not exists intelligence_jobs_status_idx on public.intelligence_processing_jobs (status, available_at, priority);

drop trigger if exists set_intelligence_sources_updated_at on public.intelligence_sources;
create trigger set_intelligence_sources_updated_at before update on public.intelligence_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_normalized_intelligence_events_updated_at on public.normalized_intelligence_events;
create trigger set_normalized_intelligence_events_updated_at before update on public.normalized_intelligence_events
for each row execute function public.set_updated_at();

drop trigger if exists set_company_intelligence_state_updated_at on public.company_intelligence_state;
create trigger set_company_intelligence_state_updated_at before update on public.company_intelligence_state
for each row execute function public.set_updated_at();

alter table public.intelligence_sources enable row level security;
alter table public.raw_intelligence_events enable row level security;
alter table public.normalized_intelligence_events enable row level security;
alter table public.intelligence_event_entities enable row level security;
alter table public.intelligence_event_duplicates enable row level security;
alter table public.intelligence_analyses enable row level security;
alter table public.company_intelligence_state enable row level security;
alter table public.intelligence_alerts enable row level security;
alter table public.intelligence_processing_jobs enable row level security;

revoke all on public.intelligence_sources from anon, authenticated;
revoke all on public.raw_intelligence_events from anon, authenticated;
revoke all on public.normalized_intelligence_events from anon, authenticated;
revoke all on public.intelligence_event_entities from anon, authenticated;
revoke all on public.intelligence_event_duplicates from anon, authenticated;
revoke all on public.intelligence_analyses from anon, authenticated;
revoke all on public.company_intelligence_state from anon, authenticated;
revoke all on public.intelligence_processing_jobs from anon, authenticated;
revoke all on public.intelligence_alerts from anon;

grant all on public.intelligence_sources to service_role;
grant all on public.raw_intelligence_events to service_role;
grant all on public.normalized_intelligence_events to service_role;
grant all on public.intelligence_event_entities to service_role;
grant all on public.intelligence_event_duplicates to service_role;
grant all on public.intelligence_analyses to service_role;
grant all on public.company_intelligence_state to service_role;
grant all on public.intelligence_processing_jobs to service_role;
grant all on public.intelligence_alerts to service_role;
grant select, update, delete on public.intelligence_alerts to authenticated;

drop policy if exists "Users read own intelligence alerts" on public.intelligence_alerts;
drop policy if exists "Users update own intelligence alerts" on public.intelligence_alerts;
drop policy if exists "Users delete own intelligence alerts" on public.intelligence_alerts;

create policy "Users read own intelligence alerts" on public.intelligence_alerts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users update own intelligence alerts" on public.intelligence_alerts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Users delete own intelligence alerts" on public.intelligence_alerts
  for delete to authenticated using ((select auth.uid()) = user_id);

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
  a.created_at as analyzed_at
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

create or replace function private.purge_expired_intelligence_events(p_limit integer default 1000)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  deleted_count integer;
begin
  with expired as (
    select id
    from public.raw_intelligence_events
    where retention_until < now()
    order by retention_until
    limit greatest(1, least(p_limit, 10000))
    for update skip locked
  )
  delete from public.raw_intelligence_events raw
  using expired
  where raw.id = expired.id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function private.purge_expired_intelligence_events(integer) from public, anon, authenticated;
grant execute on function private.purge_expired_intelligence_events(integer) to service_role;

comment on table public.raw_intelligence_events is 'Server-only source evidence. Default retention is 90 days and must be reviewed against provider licences.';
comment on view public.intelligence_feed is 'Sanitized server-side feed. Never expose raw provider payloads directly to clients.';
