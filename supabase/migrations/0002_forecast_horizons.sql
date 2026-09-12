-- Adds multi-horizon forecasting support: each forecast run now records
-- which horizon (month / quarter / year) it was generated for.
-- Run this once in the Supabase SQL Editor, after 0001_init.sql.

alter table forecasts add column if not exists horizon text not null default 'quarter';

alter table forecasts drop constraint if exists forecasts_horizon_check;
alter table forecasts add constraint forecasts_horizon_check check (horizon in ('month', 'quarter', 'year'));

create index if not exists forecasts_account_id_horizon_idx on forecasts (account_id, horizon, generated_at desc);
