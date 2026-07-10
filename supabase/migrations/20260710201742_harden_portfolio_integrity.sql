alter table public.portfolios
  add constraint portfolios_id_user_id_key unique (id, user_id);

alter table public.portfolio_positions
  add constraint portfolio_positions_id_user_id_key unique (id, user_id);

create unique index portfolio_positions_unassigned_user_symbol_key
  on public.portfolio_positions (user_id, symbol)
  where portfolio_id is null;

create unique index portfolio_positions_portfolio_symbol_key
  on public.portfolio_positions (portfolio_id, symbol)
  where portfolio_id is not null;

alter table public.portfolio_positions drop constraint portfolio_positions_portfolio_id_fkey;
alter table public.portfolio_positions
  add constraint portfolio_positions_portfolio_owner_fkey
  foreign key (portfolio_id, user_id)
  references public.portfolios (id, user_id)
  on delete cascade;

alter table public.portfolio_transactions drop constraint portfolio_transactions_portfolio_id_fkey;
alter table public.portfolio_transactions
  add constraint portfolio_transactions_portfolio_owner_fkey
  foreign key (portfolio_id, user_id)
  references public.portfolios (id, user_id)
  on delete set null (portfolio_id);

alter table public.portfolio_transactions drop constraint portfolio_transactions_position_id_fkey;
alter table public.portfolio_transactions
  add constraint portfolio_transactions_position_owner_fkey
  foreign key (position_id, user_id)
  references public.portfolio_positions (id, user_id)
  on delete set null (position_id);

create or replace function public.apply_portfolio_trade(
  p_user_id uuid,
  p_symbol text,
  p_name text,
  p_asset_type text,
  p_sector text,
  p_side text,
  p_quantity numeric,
  p_price numeric,
  p_currency text,
  p_risk_score integer
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_position public.portfolio_positions%rowtype;
  normalized_symbol text := upper(trim(p_symbol));
  next_quantity numeric(28, 10);
  next_average_price numeric(28, 10);
begin
  if p_user_id is null then raise exception 'portfolio_user_id_required'; end if;
  if normalized_symbol is null or normalized_symbol = '' then raise exception 'portfolio_symbol_required'; end if;
  if p_side not in ('buy', 'sell') then raise exception 'portfolio_trade_side_invalid'; end if;
  if p_quantity is null or p_price is null or p_quantity <= 0 or p_price <= 0 then
    raise exception 'portfolio_trade_values_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || normalized_symbol, 0));

  select * into current_position
  from public.portfolio_positions
  where user_id = p_user_id and symbol = normalized_symbol and portfolio_id is null
  order by created_at asc
  limit 1
  for update;

  if p_side = 'sell' then
    if current_position.id is null then raise exception 'portfolio_sell_position_missing'; end if;
    if p_quantity > current_position.quantity then raise exception 'portfolio_sell_exceeds_position'; end if;

    insert into public.portfolio_transactions (
      user_id, position_id, symbol, asset_type, side, quantity, price, currency, notes
    ) values (
      p_user_id, current_position.id, normalized_symbol, p_asset_type, p_side, p_quantity, p_price,
      upper(trim(p_currency)), p_name
    );

    next_quantity := current_position.quantity - p_quantity;
    if next_quantity = 0 then
      delete from public.portfolio_positions where id = current_position.id and user_id = p_user_id;
    else
      update public.portfolio_positions
      set quantity = next_quantity, current_price = p_price, updated_at = now()
      where id = current_position.id and user_id = p_user_id;
    end if;
    return;
  end if;

  if current_position.id is null then
    insert into public.portfolio_positions (
      user_id, symbol, name, asset_type, sector, quantity, average_price, current_price, currency, risk_score
    ) values (
      p_user_id, normalized_symbol, coalesce(nullif(trim(p_name), ''), normalized_symbol || ' Position'),
      p_asset_type, p_sector, p_quantity, p_price, p_price, upper(trim(p_currency)), p_risk_score
    ) returning * into current_position;
  else
    next_quantity := current_position.quantity + p_quantity;
    next_average_price := ((current_position.average_price * current_position.quantity) + (p_price * p_quantity)) / next_quantity;
    update public.portfolio_positions
    set name = coalesce(nullif(trim(p_name), ''), current_position.name, normalized_symbol || ' Position'),
        asset_type = p_asset_type,
        sector = p_sector,
        quantity = next_quantity,
        average_price = next_average_price,
        current_price = p_price,
        currency = upper(trim(p_currency)),
        risk_score = p_risk_score,
        updated_at = now()
    where id = current_position.id and user_id = p_user_id
    returning * into current_position;
  end if;

  insert into public.portfolio_transactions (
    user_id, position_id, symbol, asset_type, side, quantity, price, currency, notes
  ) values (
    p_user_id, current_position.id, normalized_symbol, p_asset_type, p_side, p_quantity, p_price,
    upper(trim(p_currency)), p_name
  );
end;
$$;

revoke execute on function public.apply_portfolio_trade(uuid, text, text, text, text, text, numeric, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.apply_portfolio_trade(uuid, text, text, text, text, text, numeric, numeric, text, integer)
  to service_role;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;
