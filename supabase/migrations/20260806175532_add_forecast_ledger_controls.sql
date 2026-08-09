-- Forecast ledger and outcome evaluation controls for StockPilot AI.
-- Purpose: store probabilistic research forecasts with model/data provenance
-- and later realized outcomes without allowing client-side mutation or hidden
-- bad-forecast deletion.
--
-- Rollback strategy: disable API writes first, export forecasts/outcomes for
-- evidence retention, then drop policies/triggers/tables in reverse order.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.model_registry (
  id uuid primary key default gen_random_uuid(),
  model_key text not null check (model_key ~ '^[a-z][a-z0-9._:-]{2,120}$'),
  version text not null check (length(trim(version)) between 1 and 80),
  purpose text not null check (length(trim(purpose)) between 5 and 240),
  model_family text not null check (model_family in ('deterministic', 'statistical', 'machine_learning', 'llm_assisted', 'benchmark')),
  owner text not null check (length(trim(owner)) between 2 and 160),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'validated', 'pilot', 'active', 'suspended', 'retired')),
  promotion_gate text not null default 'restricted' check (promotion_gate in ('approved', 'restricted', 'rejected')),
  validation_evidence_url text,
  limitations text[] not null default '{}',
  prohibited_claims text[] not null default array[
    'guaranteed_return',
    'risk_free_trade',
    'personalized_investment_advice',
    'certain_price_target'
  ],
  monitoring_spec jsonb not null default '{}'::jsonb check (jsonb_typeof(monitoring_spec) = 'object' and octet_length(monitoring_spec::text) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_key, version)
);

create table if not exists public.forecasts (
  id uuid primary key default gen_random_uuid(),
  symbol text not null check (symbol ~ '^[A-Z0-9./:-]{1,32}$'),
  asset_type text not null check (asset_type in ('stock', 'etf', 'crypto', 'forex', 'index', 'commodity', 'future', 'option', 'fund', 'bond', 'unknown')),
  exchange text check (exchange is null or length(trim(exchange)) between 1 and 120),
  currency text not null default 'USD' check (currency ~ '^[A-Z0-9]{2,12}$'),
  model_registry_id uuid references public.model_registry(id) on delete restrict,
  model_key text not null check (model_key ~ '^[a-z][a-z0-9._:-]{2,120}$'),
  model_version text not null check (length(trim(model_version)) between 1 and 80),
  data_cutoff timestamptz not null,
  generated_at timestamptz not null default now(),
  provider text not null check (length(trim(provider)) between 2 and 160),
  quality text not null check (quality in ('realtime', 'near_realtime', 'delayed', 'historical', 'mock', 'unavailable')),
  forecast_status text not null check (forecast_status in ('ready', 'limited', 'blocked')),
  promotion_gate text not null check (promotion_gate in ('approved', 'restricted', 'rejected')),
  base_price numeric(28, 10) check (base_price is null or base_price > 0),
  horizon text not null check (length(trim(horizon)) between 2 and 80),
  probability_up numeric(6, 3) not null check (probability_up between 0 and 100),
  probability_down numeric(6, 3) not null check (probability_down between 0 and 100),
  probability_sideways numeric(6, 3) not null check (probability_sideways between 0 and 100),
  confidence numeric(6, 3) not null check (confidence between 0 and 100),
  quality_score numeric(6, 3) not null check (quality_score between 0 and 100),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{8,64}$'),
  source_count integer not null default 0 check (source_count >= 0),
  bands jsonb not null default '[]'::jsonb check (jsonb_typeof(bands) = 'array' and octet_length(bands::text) <= 131072),
  scenarios jsonb not null default '[]'::jsonb check (jsonb_typeof(scenarios) = 'array' and octet_length(scenarios::text) <= 131072),
  drivers jsonb not null default '[]'::jsonb check (jsonb_typeof(drivers) = 'array' and octet_length(drivers::text) <= 65536),
  risks jsonb not null default '[]'::jsonb check (jsonb_typeof(risks) = 'array' and octet_length(risks::text) <= 65536),
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array' and octet_length(blockers::text) <= 65536),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array' and octet_length(sources::text) <= 131072),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object' and octet_length(provenance::text) <= 262144),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (symbol, model_key, model_version, data_cutoff, input_hash),
  constraint forecasts_probability_total check (probability_up + probability_down + probability_sideways between 99.9 and 100.1 or forecast_status = 'blocked'),
  constraint forecasts_gate_consistency check (
    (forecast_status = 'blocked' and promotion_gate = 'rejected')
    or (forecast_status = 'limited' and promotion_gate in ('restricted', 'rejected'))
    or (forecast_status = 'ready' and promotion_gate in ('approved', 'restricted'))
  ),
  constraint forecasts_no_mock_approval check (quality <> 'mock' or promotion_gate <> 'approved')
);

create table if not exists public.forecast_outcomes (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid not null references public.forecasts(id) on delete restrict,
  symbol text not null check (symbol ~ '^[A-Z0-9./:-]{1,32}$'),
  evaluation_due_at timestamptz not null,
  evaluated_at timestamptz,
  outcome_status text not null default 'pending' check (outcome_status in ('pending', 'matured', 'blocked', 'insufficient_data')),
  realized_price numeric(28, 10) check (realized_price is null or realized_price > 0),
  realized_return_percent numeric(12, 6),
  inside_forecast_band boolean,
  direction_hit boolean,
  baseline_return_percent numeric(12, 6),
  baseline_error_percent numeric(12, 6),
  model_error_percent numeric(12, 6),
  data_quality_at_evaluation jsonb not null default '{}'::jsonb check (jsonb_typeof(data_quality_at_evaluation) = 'object' and octet_length(data_quality_at_evaluation::text) <= 65536),
  notes text check (notes is null or length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (forecast_id)
);

create table if not exists public.model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_registry_id uuid references public.model_registry(id) on delete restrict,
  model_key text not null check (model_key ~ '^[a-z][a-z0-9._:-]{2,120}$'),
  model_version text not null check (length(trim(model_version)) between 1 and 80),
  window_start timestamptz not null,
  window_end timestamptz not null,
  forecast_count integer not null check (forecast_count >= 0),
  matured_count integer not null check (matured_count >= 0),
  interval_coverage numeric(6, 3) check (interval_coverage is null or interval_coverage between 0 and 100),
  direction_accuracy numeric(6, 3) check (direction_accuracy is null or direction_accuracy between 0 and 100),
  average_model_error_percent numeric(12, 6),
  average_baseline_error_percent numeric(12, 6),
  calibration_bucket text not null default 'unbucketed',
  evaluation_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(evaluation_payload) = 'object' and octet_length(evaluation_payload::text) <= 262144),
  created_at timestamptz not null default now(),
  constraint model_evaluations_window_order check (window_end > window_start),
  constraint model_evaluations_matured_count check (matured_count <= forecast_count)
);

create index if not exists model_registry_status_idx on public.model_registry (lifecycle_status, promotion_gate, model_key);
create index if not exists forecasts_symbol_cutoff_idx on public.forecasts (symbol, data_cutoff desc);
create index if not exists forecasts_model_cutoff_idx on public.forecasts (model_key, model_version, data_cutoff desc);
create index if not exists forecasts_gate_status_idx on public.forecasts (promotion_gate, forecast_status, generated_at desc);
create index if not exists forecasts_created_by_idx on public.forecasts (created_by, created_at desc) where created_by is not null;
create index if not exists forecast_outcomes_due_idx on public.forecast_outcomes (outcome_status, evaluation_due_at);
create index if not exists forecast_outcomes_symbol_due_idx on public.forecast_outcomes (symbol, evaluation_due_at desc);
create index if not exists model_evaluations_model_window_idx on public.model_evaluations (model_key, model_version, window_end desc);

drop trigger if exists set_model_registry_updated_at on public.model_registry;
create trigger set_model_registry_updated_at before update on public.model_registry
for each row execute function public.set_updated_at();

drop trigger if exists set_forecast_outcomes_updated_at on public.forecast_outcomes;
create trigger set_forecast_outcomes_updated_at before update on public.forecast_outcomes
for each row execute function public.set_updated_at();

alter table public.model_registry enable row level security;
alter table public.forecasts enable row level security;
alter table public.forecast_outcomes enable row level security;
alter table public.model_evaluations enable row level security;

revoke all on public.model_registry from public, anon, authenticated;
revoke all on public.forecasts from public, anon, authenticated;
revoke all on public.forecast_outcomes from public, anon, authenticated;
revoke all on public.model_evaluations from public, anon, authenticated;

grant select, insert, update on public.model_registry to service_role;
grant select, insert on public.forecasts to service_role;
grant select, insert, update on public.forecast_outcomes to service_role;
grant select, insert on public.model_evaluations to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'model_registry',
    'forecasts',
    'forecast_outcomes',
    'model_evaluations'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Server-only forecast ledger access denied',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'Server-only forecast ledger access denied',
      table_name
    );
  end loop;
end;
$$;

create or replace function private.reject_forecast_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  raise exception 'immutable_forecast_record' using errcode = '55000';
end;
$$;

revoke execute on function private.reject_forecast_mutation() from public, anon, authenticated;
grant execute on function private.reject_forecast_mutation() to service_role;

drop trigger if exists forecasts_immutable on public.forecasts;
create trigger forecasts_immutable before update or delete on public.forecasts
for each row execute function private.reject_forecast_mutation();

insert into public.model_registry (
  model_key,
  version,
  purpose,
  model_family,
  owner,
  lifecycle_status,
  promotion_gate,
  validation_evidence_url,
  limitations,
  monitoring_spec
)
values (
  'stockpilot.forecast',
  '1.0.0-deterministic',
  'Deterministic probabilistic forecast passport and ledger baseline.',
  'deterministic',
  'StockPilot AI',
  'pilot',
  'restricted',
  'docs/FORECASTING_METHODOLOGY.md',
  array[
    'Requires provider-quality market data and sufficient candles.',
    'Does not produce guaranteed returns or personal investment advice.',
    'Outcome evaluation depends on persisted future market data.'
  ],
  '{"primaryMetric":"interval_coverage","baseline":"naive_last_price_plus_historical_volatility","reviewCadenceDays":30}'::jsonb
)
on conflict (model_key, version) do nothing;
