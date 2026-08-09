-- Tarifstruktur auf FREE / PRO / PREMIUM.
--
-- Zum Zeitpunkt dieser Migration enthielt public.entitlements null Zeilen. Die
-- Umbenennung trifft also keinen zahlenden Kunden. Die UPDATE-Anweisungen sind
-- trotzdem da: sie ordnen nach oben zu, damit ein Konto durch eine Umbenennung
-- niemals weniger bekommt, als es bezahlt hat.
update public.entitlements set plan = 'pro' where plan = 'starter';
update public.entitlements set plan = 'premium' where plan = 'elite';

alter table public.entitlements drop constraint if exists entitlements_plan_check;
alter table public.entitlements
  add constraint entitlements_plan_check
  check (plan = any (array['free'::text, 'pro'::text, 'premium'::text]));
