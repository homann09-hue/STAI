alter table public.portfolio_positions add column if not exists name text;
alter table public.portfolio_positions add column if not exists current_price numeric(28, 10) default 0;
alter table public.portfolio_positions add column if not exists risk_score integer default 55;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portfolio_positions_current_price_nonnegative') then
    alter table public.portfolio_positions add constraint portfolio_positions_current_price_nonnegative check (current_price is null or current_price >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'portfolio_positions_risk_score_range') then
    alter table public.portfolio_positions add constraint portfolio_positions_risk_score_range check (risk_score is null or risk_score between 0 and 100);
  end if;
end;
$$;
