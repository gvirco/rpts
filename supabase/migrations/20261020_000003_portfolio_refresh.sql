-- Issue #8: server-controlled mark-to-market updates.
-- Apply once after 20261019_000002_trading_backend.sql.
-- Only the authenticated refresh-portfolio Edge Function may invoke this
-- service_role-only RPC with quotes it fetched server-side.
create or replace function public.refresh_paper_portfolio(
  p_user_id uuid,
  p_prices jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starting_balance numeric(18,2);
  v_cash_balance numeric(18,2);
  v_price numeric(18,4);
  v_position record;
  v_positions_count integer;
  v_quotes_count integer;
  v_positions_value numeric(18,2);
  v_total_value numeric(18,2);
  v_previous_value numeric(18,2);
  v_previous_time timestamptz;
  v_snapshot_written boolean := false;
begin
  if p_user_id is null then raise exception 'Authenticated user required'; end if;
  if p_prices is null or jsonb_typeof(p_prices) <> 'object' then
    raise exception 'Invalid server quote map';
  end if;

  -- Match the trade RPC lock ordering to serialize pricing and trades.
  select starting_balance, cash_balance
    into v_starting_balance, v_cash_balance
    from public.profiles
   where user_id = p_user_id
     for update;
  if not found then raise exception 'User profile not found'; end if;

  select count(*) into v_positions_count from public.positions where user_id = p_user_id;
  select count(*) into v_quotes_count from jsonb_object_keys(p_prices);
  if v_positions_count <> v_quotes_count then
    raise exception 'Quote map does not cover every holding';
  end if;

  for v_position in
    select symbol from public.positions where user_id = p_user_id
  loop
    if not p_prices ? v_position.symbol or
       jsonb_typeof(p_prices -> v_position.symbol) <> 'number' then
      raise exception 'Invalid quote for holding';
    end if;
    v_price := (p_prices ->> v_position.symbol)::numeric(18,4);
    if v_price <= 0 or v_price > 1000000 then
      raise exception 'Invalid quote price';
    end if;
    update public.positions
       set last_price = v_price
     where user_id = p_user_id and symbol = v_position.symbol;
  end loop;

  select coalesce(round(sum(quantity * last_price),2),0)
    into v_positions_value
    from public.positions where user_id = p_user_id;
  v_total_value := v_cash_balance + v_positions_value;

  select total_value, "timestamp"
    into v_previous_value, v_previous_time
    from public.portfolio_snapshots
   where user_id = p_user_id
   order by "timestamp" desc
   limit 1;

  -- Persist actual valuation changes; avoid duplicate rows on reload.
  if v_previous_value is distinct from v_total_value or
     v_previous_time is null or
     v_previous_time < now() - interval '1 day' then
    insert into public.portfolio_snapshots
      (user_id, cash_balance, positions_value, total_value, profit_loss)
    values (p_user_id, v_cash_balance, v_positions_value,
            v_total_value, v_total_value - v_starting_balance);
    v_snapshot_written := true;
  end if;

  return jsonb_build_object(
    'cashBalance', v_cash_balance,
    'positionsValue', v_positions_value,
    'totalValue', v_total_value,
    'profitLoss', v_total_value - v_starting_balance,
    'snapshotWritten', v_snapshot_written
  );
end;
$$;

revoke all on function public.refresh_paper_portfolio(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.refresh_paper_portfolio(uuid, jsonb)
  to service_role;
