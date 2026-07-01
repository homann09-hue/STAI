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
set search_path = public
as $$
declare
  current_position public.portfolio_positions%rowtype;
  normalized_symbol text := upper(trim(p_symbol));
  next_quantity numeric(28, 10);
  next_average_price numeric(28, 10);
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if normalized_symbol = '' then
    raise exception 'symbol is required';
  end if;

  if p_side not in ('buy', 'sell') then
    raise exception 'invalid portfolio trade side';
  end if;

  if p_quantity <= 0 or p_price <= 0 then
    raise exception 'quantity and price must be positive';
  end if;

  insert into public.portfolio_transactions (
    user_id,
    symbol,
    asset_type,
    side,
    quantity,
    price,
    currency,
    notes
  ) values (
    p_user_id,
    normalized_symbol,
    p_asset_type,
    p_side,
    p_quantity,
    p_price,
    upper(trim(p_currency)),
    p_name
  );

  select *
    into current_position
    from public.portfolio_positions
    where user_id = p_user_id
      and symbol = normalized_symbol
    order by created_at asc
    limit 1
    for update;

  if current_position.id is null then
    if p_side = 'sell' then
      return;
    end if;

    insert into public.portfolio_positions (
      user_id,
      symbol,
      name,
      asset_type,
      sector,
      quantity,
      average_price,
      current_price,
      currency,
      risk_score
    ) values (
      p_user_id,
      normalized_symbol,
      coalesce(nullif(trim(p_name), ''), normalized_symbol || ' Position'),
      p_asset_type,
      p_sector,
      p_quantity,
      p_price,
      p_price,
      upper(trim(p_currency)),
      p_risk_score
    );

    return;
  end if;

  if p_side = 'sell' then
    next_quantity := greatest(0, current_position.quantity - p_quantity);

    if next_quantity <= 0 then
      delete from public.portfolio_positions
      where id = current_position.id
        and user_id = p_user_id;
    else
      update public.portfolio_positions
      set
        quantity = next_quantity,
        current_price = p_price,
        updated_at = now()
      where id = current_position.id
        and user_id = p_user_id;
    end if;

    return;
  end if;

  next_quantity := current_position.quantity + p_quantity;
  next_average_price := ((current_position.average_price * current_position.quantity) + (p_price * p_quantity)) / next_quantity;

  update public.portfolio_positions
  set
    name = coalesce(nullif(trim(p_name), ''), current_position.name, normalized_symbol || ' Position'),
    asset_type = p_asset_type,
    sector = p_sector,
    quantity = next_quantity,
    average_price = next_average_price,
    current_price = p_price,
    currency = upper(trim(p_currency)),
    risk_score = p_risk_score,
    updated_at = now()
  where id = current_position.id
    and user_id = p_user_id;
end;
$$;

revoke execute on function public.apply_portfolio_trade(uuid, text, text, text, text, text, numeric, numeric, text, integer) from public;
revoke execute on function public.apply_portfolio_trade(uuid, text, text, text, text, text, numeric, numeric, text, integer) from anon;
revoke execute on function public.apply_portfolio_trade(uuid, text, text, text, text, text, numeric, numeric, text, integer) from authenticated;
grant execute on function public.apply_portfolio_trade(uuid, text, text, text, text, text, numeric, numeric, text, integer) to service_role;
