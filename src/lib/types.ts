import type { Horizon } from "./forecast";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  minimum_buffer: number;
  starting_balance_override: number | null;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  source: string;
  created_at: string;
}

export interface ForecastRow {
  id: string;
  account_id: string;
  horizon: Horizon;
  generated_at: string;
  starting_balance: number;
  weekly_data: { week_start: string; projected_in: number; projected_out: number; balance: number }[];
  low_point_week: string | null;
  low_point_balance: number | null;
  low_point_explanation: string | null;
}
