-- Bind atomic portfolio mutations to the authenticated database identity.
-- The legacy overload accepted a caller-supplied user id and was invoked with
-- service_role. This overload has no tenant parameter and remains subject to
-- the authenticated user's RLS policies.

drop function if exists public.apply_portfolio_trade(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  integer
);

create or replace function public.apply_portfolio_trade(
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
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  current_position public.portfolio_positions%rowtype;
  normalized_symbol text := upper(trim(p_symbol));
  normalized_currency text := upper(trim(p_currency));
  normalized_sector text := trim(p_sector);
  normalized_name text := nullif(trim(p_name), '');
  next_quantity numeric(28, 10);
  next_average_price numeric(28, 10);
begin
  if owner_id is null then raise exception 'portfolio_auth_required' using errcode = '42501'; end if;
  if normalized_symbol is null or normalized_symbol !~ '^[A-Z0-9.-]{1,18}$' then
    raise exception 'portfolio_symbol_invalid';
  end if;
  if p_name is not null and (length(p_name) > 120 or p_name ~ '[[:cntrl:]]') then
    raise exception 'portfolio_name_invalid';
  end if;
  if p_asset_type not in ('stock', 'etf', 'crypto', 'forex', 'index') then
    raise exception 'portfolio_asset_type_invalid';
  end if;
  if normalized_sector is null or normalized_sector = '' or length(normalized_sector) > 80 or normalized_sector ~ '[[:cntrl:]]' then
    raise exception 'portfolio_sector_invalid';
  end if;
  if p_side not in ('buy', 'sell') then raise exception 'portfolio_trade_side_invalid'; end if;
  if p_quantity is null or p_quantity = 'NaN'::numeric or p_quantity <= 0 or p_quantity > 1000000 then
    raise exception 'portfolio_quantity_invalid';
  end if;
  if p_price is null or p_price = 'NaN'::numeric or p_price <= 0 or p_price > 10000000 then
    raise exception 'portfolio_price_invalid';
  end if;
  if normalized_currency is null or normalized_currency !~ '^[A-Z]{3}$' then
    raise exception 'portfolio_currency_invalid';
  end if;
  if p_risk_score is null or p_risk_score < 0 or p_risk_score > 100 then
    raise exception 'portfolio_risk_score_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(owner_id::text || ':' || normalized_symbol, 0)
  );

  select * into current_position
  from public.portfolio_positions
  where user_id = owner_id and symbol = normalized_symbol and portfolio_id is null
  order by created_at asc
  limit 1
  for update;

  if p_side = 'sell' then
    if current_position.id is null then raise exception 'portfolio_sell_position_missing'; end if;
    if p_quantity > current_position.quantity then raise exception 'portfolio_sell_exceeds_position'; end if;

    insert into public.portfolio_transactions (
      user_id, position_id, symbol, asset_type, side, quantity, price, currency, notes
    ) values (
      owner_id, current_position.id, normalized_symbol, p_asset_type, p_side, p_quantity, p_price,
      normalized_currency, normalized_name
    );

    next_quantity := current_position.quantity - p_quantity;
    if next_quantity = 0 then
      delete from public.portfolio_positions where id = current_position.id and user_id = owner_id;
    else
      update public.portfolio_positions
      set quantity = next_quantity, current_price = p_price, updated_at = now()
      where id = current_position.id and user_id = owner_id;
    end if;
    return;
  end if;

  if current_position.id is null then
    insert into public.portfolio_positions (
      user_id, symbol, name, asset_type, sector, quantity, average_price, current_price, currency, risk_score
    ) values (
      owner_id, normalized_symbol, coalesce(normalized_name, normalized_symbol || ' Position'),
      p_asset_type, normalized_sector, p_quantity, p_price, p_price, normalized_currency, p_risk_score
    ) returning * into current_position;
  else
    next_quantity := current_position.quantity + p_quantity;
    next_average_price :=
      ((current_position.average_price * current_position.quantity) + (p_price * p_quantity)) / next_quantity;
    update public.portfolio_positions
    set name = coalesce(normalized_name, current_position.name, normalized_symbol || ' Position'),
        asset_type = p_asset_type,
        sector = normalized_sector,
        quantity = next_quantity,
        average_price = next_average_price,
        current_price = p_price,
        currency = normalized_currency,
        risk_score = p_risk_score,
        updated_at = now()
    where id = current_position.id and user_id = owner_id
    returning * into current_position;
  end if;

  insert into public.portfolio_transactions (
    user_id, position_id, symbol, asset_type, side, quantity, price, currency, notes
  ) values (
    owner_id, current_position.id, normalized_symbol, p_asset_type, p_side, p_quantity, p_price,
    normalized_currency, normalized_name
  );
end;
$$;

revoke all on function public.apply_portfolio_trade(text, text, text, text, text, numeric, numeric, text, integer)
  from public, anon, service_role;
grant execute on function public.apply_portfolio_trade(text, text, text, text, text, numeric, numeric, text, integer)
  to authenticated;
