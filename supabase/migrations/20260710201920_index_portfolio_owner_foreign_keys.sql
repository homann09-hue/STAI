create index portfolio_positions_portfolio_owner_idx
  on public.portfolio_positions (portfolio_id, user_id)
  where portfolio_id is not null;

create index portfolio_transactions_portfolio_owner_idx
  on public.portfolio_transactions (portfolio_id, user_id)
  where portfolio_id is not null;

create index portfolio_transactions_position_owner_idx
  on public.portfolio_transactions (position_id, user_id)
  where position_id is not null;
