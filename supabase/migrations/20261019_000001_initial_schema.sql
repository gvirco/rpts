-- RPTS MVP / #4 Supabase Auth + data tables.
-- Run once in Supabase SQL Editor. Client can SELECT its own rows;
-- only watchlist permits direct INSERT/DELETE.
-- Trades, positions and cash are server-owned (#7).

create schema if not exists private;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default 'Trader'
    check (char_length(nickname) between 1 and 40),
  starting_balance numeric(18,2) not null default 10000.00
    check (starting_balance >= 0),
  cash_balance numeric(18,2) not null default 10000.00
    check (cash_balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.-]{0,14}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.-]{0,14}$'),
  side text not null check (side in ('BUY', 'SELL')),
  quantity integer not null check (quantity > 0),
  price numeric(18,4) not null check (price > 0),
  executed_at timestamptz not null default now()
);

create table if not exists public.positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z][A-Z0-9.-]{0,14}$'),
  quantity integer not null check (quantity > 0),
  average_cost numeric(18,4) not null check (average_cost >= 0),
  primary key (user_id, symbol)
);

create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  "timestamp" timestamptz not null default now(),
  cash_balance numeric(18,2) not null check (cash_balance >= 0),
  positions_value numeric(18,2) not null check (positions_value >= 0),
  total_value numeric(18,2) not null check (total_value >= 0),
  profit_loss numeric(18,2) not null
);

create index if not exists transactions_user_time_idx
  on public.transactions (user_id, executed_at desc);
create index if not exists portfolio_snapshots_user_time_idx
  on public.portfolio_snapshots (user_id, "timestamp" desc);

-- New-user initialization happens with elevated database permissions,
-- and never trusts the user's input for money amounts.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, nickname)
  values (
    new.id,
    coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'nickname'), 40), ''), 'Trader')
  );
  insert into public.portfolio_snapshots
    (user_id, cash_balance, positions_value, total_value, profit_loss)
  values (new.id, 10000.00, 0.00, 10000.00, 0.00);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Lock down the Data API grants before defining per-user policies.
alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.transactions enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_snapshots enable row level security;

revoke all on public.profiles, public.watchlist, public.transactions,
  public.positions, public.portfolio_snapshots from anon, authenticated;

grant select on public.profiles, public.watchlist, public.transactions,
  public.positions, public.portfolio_snapshots to authenticated;
grant insert, delete on public.watchlist to authenticated;

drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read own watchlist" on public.watchlist;
create policy "Read own watchlist" on public.watchlist
  for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Add own watchlist entries" on public.watchlist;
create policy "Add own watchlist entries" on public.watchlist
  for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Remove own watchlist entries" on public.watchlist;
create policy "Remove own watchlist entries" on public.watchlist
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read own trades" on public.transactions;
create policy "Read own trades" on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read own positions" on public.positions;
create policy "Read own positions" on public.positions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read own snapshots" on public.portfolio_snapshots;
create policy "Read own snapshots" on public.portfolio_snapshots
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Additional backend write privileges/routines belong to issue #7.
