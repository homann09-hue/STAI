begin;

select plan(5);

select has_index(
  'public',
  'forecasts',
  'forecasts_model_registry_id_idx',
  'Forecasts index the model registry foreign key'
);

select has_index(
  'public',
  'model_evaluations',
  'model_evaluations_model_registry_id_idx',
  'Model evaluations index the model registry foreign key'
);

select has_index(
  'public',
  'provider_usage',
  'provider_usage_user_id_idx',
  'Provider usage indexes its user foreign key'
);

select has_column(
  'public',
  'provider_usage',
  'id',
  'Provider usage exposes a stable row identifier'
);

select ok(
  exists (
    select 1
      from pg_constraint
     where conrelid = 'public.provider_usage'::regclass
       and contype = 'p'
  ),
  'Provider usage has a primary key'
);

select * from finish();
rollback;
