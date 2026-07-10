drop policy if exists "Service role only intelligence sources" on public.intelligence_sources;
create policy "Service role only intelligence sources" on public.intelligence_sources
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only raw intelligence events" on public.raw_intelligence_events;
create policy "Service role only raw intelligence events" on public.raw_intelligence_events
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only normalized intelligence events" on public.normalized_intelligence_events;
create policy "Service role only normalized intelligence events" on public.normalized_intelligence_events
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only intelligence entities" on public.intelligence_event_entities;
create policy "Service role only intelligence entities" on public.intelligence_event_entities
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only intelligence duplicates" on public.intelligence_event_duplicates;
create policy "Service role only intelligence duplicates" on public.intelligence_event_duplicates
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only intelligence analyses" on public.intelligence_analyses;
create policy "Service role only intelligence analyses" on public.intelligence_analyses
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only company intelligence state" on public.company_intelligence_state;
create policy "Service role only company intelligence state" on public.company_intelligence_state
  for all to anon, authenticated using (false) with check (false);

drop policy if exists "Service role only intelligence jobs" on public.intelligence_processing_jobs;
create policy "Service role only intelligence jobs" on public.intelligence_processing_jobs
  for all to anon, authenticated using (false) with check (false);

create index if not exists alert_events_alert_rule_id_idx
  on public.alert_events (alert_rule_id) where alert_rule_id is not null;
create index if not exists portfolio_positions_portfolio_id_idx
  on public.portfolio_positions (portfolio_id) where portfolio_id is not null;
create index if not exists portfolio_transactions_portfolio_id_idx
  on public.portfolio_transactions (portfolio_id) where portfolio_id is not null;
create index if not exists portfolio_transactions_position_id_idx
  on public.portfolio_transactions (position_id) where position_id is not null;
create index if not exists intelligence_alerts_event_id_idx
  on public.intelligence_alerts (event_id);
create index if not exists intelligence_duplicates_duplicate_event_id_idx
  on public.intelligence_event_duplicates (duplicate_event_id);
create index if not exists intelligence_jobs_event_id_idx
  on public.intelligence_processing_jobs (event_id);
