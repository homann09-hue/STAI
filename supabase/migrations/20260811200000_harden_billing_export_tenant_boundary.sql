-- Billing events are immutable server-written evidence, but they are also part
-- of a user's data export. Let authenticated users read only their own rows so
-- the export can stay entirely on the token-bound RLS client.
revoke all on table public.billing_events from public, anon, authenticated;
grant select on table public.billing_events to authenticated;

drop policy if exists "Server-only billing events denied" on public.billing_events;
drop policy if exists "Users read own billing events" on public.billing_events;

create policy "Users read own billing events"
on public.billing_events
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = user_id
);

comment on policy "Users read own billing events" on public.billing_events is
  'Read-only tenant boundary for authenticated GDPR exports. Billing writes remain service-role-only and immutable.';
