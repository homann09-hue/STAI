begin;
select plan(25);

select ok(to_regclass('public.institutional_tenants') is not null, 'institutional tenants table exists');
select ok(to_regclass('public.institutional_memberships') is not null, 'institutional memberships table exists');
select ok(to_regclass('public.institutional_audit_log') is not null, 'institutional audit log exists');
select ok(to_regclass('public.data_quality_quarantine') is not null, 'data quality quarantine exists');
select ok(to_regclass('public.analysis_reproduction_runs') is not null, 'analysis reproduction history exists');
select ok(to_regclass('public.model_inventory') is not null, 'model inventory exists');
select ok(to_regclass('public.prompt_versions') is not null, 'prompt version registry exists');
select ok(to_regclass('public.institutional_feature_flags') is not null, 'controlled feature flags exist');

select is(
  (select count(*)::integer from pg_class where relnamespace = 'public'::regnamespace and relname in (
    'institutional_tenants', 'institutional_memberships', 'institutional_audit_log',
    'data_quality_quarantine', 'analysis_reviews', 'analysis_reproduction_runs',
    'model_inventory', 'prompt_versions', 'institutional_feature_flags',
    'change_records', 'control_evidence'
  ) and relrowsecurity),
  11,
  'all institutional tables have RLS enabled'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated')
      and table_schema = 'public'
      and table_name in ('institutional_audit_log', 'data_quality_quarantine', 'analysis_reviews', 'analysis_reproduction_runs', 'model_inventory', 'prompt_versions', 'institutional_feature_flags', 'change_records', 'control_evidence')
  ),
  'server-only institutional tables have no anon/authenticated grants'
);

select ok(
  has_function_privilege('service_role', 'public.append_institutional_audit_event(uuid,text,uuid,text,text,text,text,uuid,jsonb,jsonb,text,jsonb)', 'EXECUTE'),
  'service role may append audit events'
);
select ok(
  not has_function_privilege('authenticated', 'public.append_institutional_audit_event(uuid,text,uuid,text,text,text,text,uuid,jsonb,jsonb,text,jsonb)', 'EXECUTE'),
  'authenticated clients cannot append fabricated audit events'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.institutional_audit_log'::regclass and tgname = 'institutional_audit_immutable' and not tgisinternal),
  'audit log has immutable trigger'
);
select ok(
  exists (select 1 from pg_trigger where tgrelid = 'public.intelligence_analyses'::regclass and tgname = 'intelligence_analysis_immutable' and not tgisinternal),
  'analysis history has immutable trigger'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'intelligence_analyses' and column_name = 'input_snapshot'),
  'analysis input snapshots are part of the schema'
);

select has_index('public', 'analysis_reproduction_runs', 'analysis_reproduction_runs_requested_by_idx', 'reproduction requesters are indexed');
select has_index('public', 'analysis_reviews', 'analysis_reviews_reviewer_id_idx', 'analysis reviewers are indexed');
select has_index('public', 'analysis_reviews', 'analysis_reviews_tenant_id_idx', 'analysis review tenants are indexed');
select has_index('public', 'data_quality_quarantine', 'data_quality_quarantine_reviewer_id_idx', 'quarantine reviewers are indexed');
select has_index('public', 'data_quality_quarantine', 'data_quality_quarantine_tenant_id_idx', 'quarantine tenants are indexed');
select has_index('public', 'institutional_memberships', 'institutional_memberships_granted_by_idx', 'membership grantors are indexed');
select has_index('public', 'intelligence_analyses', 'intelligence_analyses_supersedes_analysis_id_idx', 'superseded analyses are indexed');
select has_index('public', 'model_inventory', 'model_inventory_approved_by_idx', 'model approvers are indexed');
select has_index('public', 'prompt_versions', 'prompt_versions_approved_by_idx', 'prompt approvers are indexed');

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and policyname = 'Server-only institutional access denied'
      and tablename in (
        'analysis_reproduction_runs', 'analysis_reviews', 'change_records',
        'control_evidence', 'data_quality_quarantine', 'institutional_audit_log',
        'institutional_feature_flags', 'model_inventory', 'prompt_versions'
      )
  ),
  9,
  'server-only institutional tables have explicit deny policies'
);

select * from finish();
rollback;
