-- Ledgerline schema: accounts, transactions, forecasts, with RLS scoped to auth.uid().
-- Run this once in the Supabase SQL Editor (or via `supabase db push` if you link the CLI).

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  currency text not null default 'USD',
  minimum_buffer numeric not null default 0,
  starting_balance_override numeric,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts on delete cascade not null,
  date date not null,
  description text not null,
  amount numeric not null, -- positive = inflow, negative = outflow
  source text not null default 'csv',
  created_at timestamptz default now()
);

create table if not exists forecasts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts on delete cascade not null,
  generated_at timestamptz default now(),
  starting_balance numeric not null,
  weekly_data jsonb not null, -- array of { week_start, projected_in, projected_out, balance }
  low_point_week text,
  low_point_balance numeric,
  low_point_explanation text
);

create index if not exists transactions_account_id_date_idx on transactions (account_id, date);
create index if not exists forecasts_account_id_idx on forecasts (account_id);

alter table accounts enable row level security;
alter table transactions enable row level security;
alter table forecasts enable row level security;

drop policy if exists "Users manage their own accounts" on accounts;
create policy "Users manage their own accounts" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage transactions on their own accounts" on transactions;
create policy "Users manage transactions on their own accounts" on transactions
  for all using (
    exists (select 1 from accounts where accounts.id = transactions.account_id and accounts.user_id = auth.uid())
  ) with check (
    exists (select 1 from accounts where accounts.id = transactions.account_id and accounts.user_id = auth.uid())
  );

drop policy if exists "Users manage forecasts on their own accounts" on forecasts;
create policy "Users manage forecasts on their own accounts" on forecasts
  for all using (
    exists (select 1 from accounts where accounts.id = forecasts.account_id and accounts.user_id = auth.uid())
  ) with check (
    exists (select 1 from accounts where accounts.id = forecasts.account_id and accounts.user_id = auth.uid())
  );
