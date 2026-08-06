begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select ok(to_regclass('public.model_registry') is not null, 'model registry exists');
select ok(to_regclass('public.forecasts') is not null, 'forecast ledger exists');
select ok(to_regclass('public.forecast_outcomes') is not null, 'forecast outcomes exist');
select ok(to_regclass('public.model_evaluations') is not null, 'model evaluations exist');

select is(
  (select count(*)::integer from pg_class where relnamespace = 'public'::regnamespace and relname in (
    'model_registry', 'forecasts', 'forecast_outcomes', 'model_evaluations'
  ) and relrowsecurity),
  4,
  'forecast ledger tables have RLS enabled'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name in ('model_registry', 'forecasts', 'forecast_outcomes', 'model_evaluations')
  ),
  'forecast ledger tables have no anon/authenticated grants'
);

select has_table_privilege('service_role', 'public.model_registry', 'INSERT', 'service role can insert model registry rows');
select has_table_privilege('service_role', 'public.forecasts', 'INSERT', 'service role can insert forecasts');
select has_table_privilege('service_role', 'public.forecast_outcomes', 'UPDATE', 'service role can update forecast outcomes');
select has_table_privilege('service_role', 'public.model_evaluations', 'INSERT', 'service role can insert model evaluations');

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and policyname = 'Server-only forecast ledger access denied'
      and tablename in ('model_registry', 'forecasts', 'forecast_outcomes', 'model_evaluations')
  ),
  4,
  'forecast ledger tables have explicit deny policies for client roles'
);

select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.forecasts'::regclass and tgname = 'forecasts_immutable' and not tgisinternal),
  'forecasts are immutable after insert'
);

select lives_ok($$
  insert into public.model_registry (
    model_key, version, purpose, model_family, owner, lifecycle_status, promotion_gate
  ) values (
    'stockpilot.test_forecast', '1.0.0', 'Test forecast model registry row.', 'deterministic', 'QA', 'pilot', 'restricted'
  )
$$, 'valid model registry row can be inserted');

select lives_ok($$
  insert into public.forecasts (
    symbol, asset_type, currency, model_key, model_version, data_cutoff, provider, quality,
    forecast_status, promotion_gate, base_price, horizon, probability_up, probability_down,
    probability_sideways, confidence, quality_score, input_hash, source_count
  ) values (
    'AAPL', 'stock', 'USD', 'stockpilot.test_forecast', '1.0.0',
    '2026-08-06T12:00:00Z', 'Unit Test Provider', 'delayed',
    'limited', 'restricted', 190.12, '1M', 45, 30, 25, 62, 70,
    'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 3
  )
$$, 'valid forecast can be inserted');

select throws_ok($$
  insert into public.forecasts (
    symbol, asset_type, currency, model_key, model_version, data_cutoff, provider, quality,
    forecast_status, promotion_gate, base_price, horizon, probability_up, probability_down,
    probability_sideways, confidence, quality_score, input_hash, source_count
  ) values (
    'NVDA', 'stock', 'USD', 'stockpilot.test_forecast', '1.0.0',
    '2026-08-06T12:00:00Z', 'Unit Test Provider', 'mock',
    'ready', 'approved', 120.00, '1M', 50, 30, 20, 80, 80,
    'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567891', 2
  )
$$, '23514', null, 'mock forecasts cannot be approved');

select throws_ok($$
  insert into public.forecasts (
    symbol, asset_type, currency, model_key, model_version, data_cutoff, provider, quality,
    forecast_status, promotion_gate, base_price, horizon, probability_up, probability_down,
    probability_sideways, confidence, quality_score, input_hash, source_count
  ) values (
    'MSFT', 'stock', 'USD', 'stockpilot.test_forecast', '1.0.0',
    '2026-08-06T12:00:00Z', 'Unit Test Provider', 'delayed',
    'ready', 'approved', 120.00, '1M', 90, 30, 20, 80, 80,
    'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567892', 2
  )
$$, '23514', null, 'non-blocked forecasts need probabilities around 100 percent');

select throws_ok($$
  update public.forecasts set confidence = 1 where symbol = 'AAPL'
$$, '55000', 'immutable_forecast_record', 'forecast records cannot be rewritten');

select lives_ok($$
  insert into public.forecast_outcomes (
    forecast_id, symbol, evaluation_due_at
  )
  select id, symbol, '2026-09-10T12:00:00Z'
  from public.forecasts
  where symbol = 'AAPL'
$$, 'outcome placeholder can be inserted');

select lives_ok($$
  update public.forecast_outcomes
  set outcome_status = 'matured',
      evaluated_at = '2026-09-10T12:00:00Z',
      realized_price = 197.50,
      realized_return_percent = 3.88,
      inside_forecast_band = true,
      direction_hit = true
  where symbol = 'AAPL'
$$, 'outcome can be matured by server workflow');

select throws_ok($$
  insert into public.forecast_outcomes (
    forecast_id, symbol, evaluation_due_at
  )
  select id, symbol, '2026-09-11T12:00:00Z'
  from public.forecasts
  where symbol = 'AAPL'
$$, '23505', null, 'only one outcome row is allowed per forecast');

select lives_ok($$
  insert into public.model_evaluations (
    model_key, model_version, window_start, window_end, forecast_count, matured_count,
    interval_coverage, direction_accuracy, calibration_bucket
  ) values (
    'stockpilot.test_forecast', '1.0.0', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z',
    10, 8, 75, 62.5, 'confidence_55_74'
  )
$$, 'model evaluation summary can be inserted');

select has_index('public', 'forecasts', 'forecasts_symbol_cutoff_idx', 'forecast symbol/cutoff index exists');
select has_index('public', 'forecasts', 'forecasts_model_cutoff_idx', 'forecast model/cutoff index exists');
select has_index('public', 'forecast_outcomes', 'forecast_outcomes_due_idx', 'outcome due queue index exists');
select has_index('public', 'model_evaluations', 'model_evaluations_model_window_idx', 'model evaluation window index exists');

select ok(
  exists (
    select 1
    from public.model_registry
    where model_key = 'stockpilot.forecast'
      and version = '1.0.0-deterministic'
      and promotion_gate = 'restricted'
  ),
  'default deterministic forecast model is registered as restricted pilot'
);

select * from finish();
rollback;
