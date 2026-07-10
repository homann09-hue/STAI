create index if not exists analysis_reproduction_runs_requested_by_idx
  on public.analysis_reproduction_runs (requested_by)
  where requested_by is not null;

create index if not exists analysis_reviews_reviewer_id_idx
  on public.analysis_reviews (reviewer_id)
  where reviewer_id is not null;

create index if not exists analysis_reviews_tenant_id_idx
  on public.analysis_reviews (tenant_id)
  where tenant_id is not null;

create index if not exists data_quality_quarantine_reviewer_id_idx
  on public.data_quality_quarantine (reviewer_id)
  where reviewer_id is not null;

create index if not exists data_quality_quarantine_tenant_id_idx
  on public.data_quality_quarantine (tenant_id)
  where tenant_id is not null;

create index if not exists institutional_memberships_granted_by_idx
  on public.institutional_memberships (granted_by)
  where granted_by is not null;

create index if not exists intelligence_analyses_supersedes_analysis_id_idx
  on public.intelligence_analyses (supersedes_analysis_id)
  where supersedes_analysis_id is not null;

create index if not exists model_inventory_approved_by_idx
  on public.model_inventory (approved_by)
  where approved_by is not null;

create index if not exists prompt_versions_approved_by_idx
  on public.prompt_versions (approved_by)
  where approved_by is not null;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'analysis_reproduction_runs',
    'analysis_reviews',
    'change_records',
    'control_evidence',
    'data_quality_quarantine',
    'institutional_audit_log',
    'institutional_feature_flags',
    'model_inventory',
    'prompt_versions'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Server-only institutional access denied',
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      'Server-only institutional access denied',
      table_name
    );
  end loop;
end;
$$;
