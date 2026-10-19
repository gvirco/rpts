-- RPTS / Issue #7: server-only, atomic BUY/SELL and portfolio snapshots.
-- Apply AFTER 20261019_000001_initial_schema.sql.
-- Trust boundary: ONLY backend (service_role) may call this RPC.
-- Backend MUST authenticate the user and fetch market price server-side.
-- Never accept the user ID or execution price from the browser as trusted values.

-- Keep the most recently OBSERVED price per position. This lets snapshots
-- include unrealized P/L. Until #5/#8 refresh prices, values may be stale.
alter table public.positions
  add column if not exists last_price numeric(18,4);

update public.positions
set last_price = average_cost
where last_price is null;

alter table public.positions
  alter column last_price set not null;

alter table public.positions
  drop constraint if exists positions_last_price_positive;

alter table public.positions
  add constraint positions_last_price_positive check (last_price > 0);

create or replace function public.execute_paper_trade(
  p_user_id uuid,
  p_symbol text,
  p_side text,
  p_quantity integer,
  p_execution_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_symbol text := upper(btrim(p_symbol));
  v_side text := upper(btrim(p_side));
  v_price numeric(18,4);
  v_order_total numeric(18,2);
  v_starting_balance numeric(18,2);
  v_cash_balance numeric(18,2);
  v_existing_quantity integer;
  v_existing_cost numeric(18,4);
  v_new_quantity integer;
  v_new_average_cost numeric(18,4);
  v_trade_id uuid;
  v_positions_value numeric(18,2);
  v_total_value numeric(18,2);
begin
  if p_user_id is null then
    raise exception 'Authenticated user required';
  end if;

  if v_symbol is null or v_symbol !~ '^[A-Z][A-Z0-9.-]{0,14}$' then
    raise exception 'Invalid stock symbol';
  end if;

  if v_side is null or v_side not in ('BUY', 'SELL') then
    raise exception 'Trade side must be BUY or SELL';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive whole number';
  end if;

  if p_execution_price is null or p_execution_price <= 0 or p_execution_price > 1000000 then
    raise exception 'Invalid execution price';
  end if;

  v_price := round(p_execution_price, 4);
  v_order_total := round(v_price * p_quantity, 2);

  if v_order_total <= 0 then
    raise exception 'Trade value must be at least $0.01';
  end if;

  -- Serializes trades for this user; ensures no overspending or double-selling.
  select starting_balance, cash_balance
    into v_starting_balance, v_cash_balance
    from public.profiles
   where user_id = p_user_id
     for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  select quantity, average_cost
    into v_existing_quantity, v_existing_cost
    from public.positions
   where user_id = p_user_id and symbol = v_symbol;

  if v_side = 'BUY' then
    if v_cash_balance < v_order_total then
      raise exception 'Insufficient cash';
    end if;

    v_cash_balance := v_cash_balance - v_order_total;
    update public.profiles
       set cash_balance = v_cash_balance
     where user_id = p_user_id;

    if v_existing_quantity is null then
      insert into public.positions
        (user_id, symbol, quantity, average_cost, last_price)
      values (p_user_id, v_symbol, p_quantity, v_price, v_price);
    else
      v_new_quantity := v_existing_quantity + p_quantity;
      v_new_average_cost := round(
        (v_existing_quantity * v_existing_cost + p_quantity * v_price)
        / v_new_quantity, 4
      );
      update public.positions
         set quantity = v_new_quantity,
             average_cost = v_new_average_cost,
             last_price = v_price
       where user_id = p_user_id and symbol = v_symbol;
    end if;
  else
    if v_existing_quantity is null or v_existing_quantity < p_quantity then
      raise exception 'Insufficient shares';
    end if;

    v_cash_balance := v_cash_balance + v_order_total;
    update public.profiles
       set cash_balance = v_cash_balance
     where user_id = p_user_id;

    if v_existing_quantity = p_quantity then
      delete from public.positions
       where user_id = p_user_id and symbol = v_symbol;
    else
      update public.positions
         set quantity = quantity - p_quantity,
             last_price = v_price
       where user_id = p_user_id and symbol = v_symbol;
    end if;
  end if;

  insert into public.transactions (user_id, symbol, side, quantity, price)
  values (p_user_id, v_symbol, v_side, p_quantity, v_price)
  returning id into v_trade_id;

  -- Last-observed-price valuation; #8 will add market-price refresh snapshots.
  select coalesce(round(sum(quantity * last_price), 2), 0)
    into v_positions_value
    from public.positions
   where user_id = p_user_id;

  v_total_value := v_cash_balance + v_positions_value;

  insert into public.portfolio_snapshots
    (user_id, cash_balance, positions_value, total_value, profit_loss)
  values (
    p_user_id, v_cash_balance, v_positions_value,
    v_total_value, v_total_value - v_starting_balance
  );

  return jsonb_build_object(
    'tradeId', v_trade_id,
    'symbol', v_symbol,
    'side', v_side,
    'quantity', p_quantity,
    'executionPrice', v_price,
    'cashBalance', v_cash_balance,
    'positionsValue', v_positions_value,
    'totalValue', v_total_value,
    'profitLoss', v_total_value - v_starting_balance
  );
end;
$$;

-- PostgreSQL gives new functions PUBLIC execution by default.
-- This RPC is intentionally NOT callable by browser (anon/authenticated).
revoke all on function public.execute_paper_trade(uuid, text, text, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.execute_paper_trade(uuid, text, text, integer, numeric)
  to service_role;

-- Reminder: the server endpoint in #7 must verify the user's bearer JWT
-- before invoking this privileged RPC with the verified uid and trusted price.
