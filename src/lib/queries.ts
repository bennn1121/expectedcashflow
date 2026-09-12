import type { SupabaseClient } from "@supabase/supabase-js";
import type { Horizon } from "./forecast";
import type { Account, ForecastRow, TransactionRow } from "./types";

export const TRANSACTIONS_PAGE_SIZE = 25;

export async function listAccounts(supabase: SupabaseClient): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Account[];
}

export async function getAccount(supabase: SupabaseClient, accountId: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).maybeSingle();
  if (error) throw error;
  return data as Account | null;
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  input: { name: string; currency: string }
): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: input.name, currency: input.currency })
    .select()
    .single();
  if (error) throw error;
  return data as Account;
}

export async function updateAccount(
  supabase: SupabaseClient,
  accountId: string,
  input: { name: string; minimum_buffer: number; starting_balance_override: number | null }
): Promise<void> {
  const { error } = await supabase.from("accounts").update(input).eq("id", accountId);
  if (error) throw error;
}

export async function deleteAccount(supabase: SupabaseClient, accountId: string): Promise<void> {
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) throw error;
}

export type TransactionSort = "date_desc" | "date_asc";

export async function listTransactions(
  supabase: SupabaseClient,
  accountId: string,
  options: { page: number; sort: TransactionSort }
): Promise<{ rows: TransactionRow[]; total: number }> {
  const from = (options.page - 1) * TRANSACTIONS_PAGE_SIZE;
  const to = from + TRANSACTIONS_PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("account_id", accountId)
    .order("date", { ascending: options.sort === "date_asc" })
    .range(from, to);

  if (error) throw error;
  return { rows: data as TransactionRow[], total: count ?? 0 };
}

export async function insertTransactions(
  supabase: SupabaseClient,
  accountId: string,
  rows: { date: string; description: string; amount: number }[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from("transactions")
    .insert(rows.map((r) => ({ ...r, account_id: accountId, source: "csv" })));
  if (error) throw error;
}

export async function listAllTransactionsForForecast(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ date: string; description: string; amount: number }[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("date, description, amount")
    .eq("account_id", accountId)
    .order("date", { ascending: true });
  if (error) throw error;
  return data as { date: string; description: string; amount: number }[];
}

/** Most recent forecast for one specific horizon (used by the forecasts overview). */
export async function getLatestForecast(
  supabase: SupabaseClient,
  accountId: string,
  horizon: Horizon
): Promise<ForecastRow | null> {
  const { data, error } = await supabase
    .from("forecasts")
    .select("*")
    .eq("account_id", accountId)
    .eq("horizon", horizon)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ForecastRow | null;
}

/** Most recent forecast of any horizon (used by the single-forecast account view). */
export async function getMostRecentForecast(
  supabase: SupabaseClient,
  accountId: string
): Promise<ForecastRow | null> {
  const { data, error } = await supabase
    .from("forecasts")
    .select("*")
    .eq("account_id", accountId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ForecastRow | null;
}

export interface ForecastHistoryEntry {
  id: string;
  horizon: Horizon;
  generated_at: string;
  low_point_week: string | null;
  low_point_balance: number | null;
}

/** Past forecast runs across all horizons, most recent first. */
export async function listForecastHistory(
  supabase: SupabaseClient,
  accountId: string,
  limit = 20
): Promise<ForecastHistoryEntry[]> {
  const { data, error } = await supabase
    .from("forecasts")
    .select("id, horizon, generated_at, low_point_week, low_point_balance")
    .eq("account_id", accountId)
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ForecastHistoryEntry[];
}

/** Earliest and latest transaction dates for an account, without loading every row. */
export async function getTransactionDateRange(
  supabase: SupabaseClient,
  accountId: string
): Promise<{ earliest: string; latest: string } | null> {
  const [{ data: earliestRows, error: e1 }, { data: latestRows, error: e2 }] = await Promise.all([
    supabase.from("transactions").select("date").eq("account_id", accountId).order("date", { ascending: true }).limit(1),
    supabase.from("transactions").select("date").eq("account_id", accountId).order("date", { ascending: false }).limit(1),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!earliestRows?.length || !latestRows?.length) return null;
  return { earliest: earliestRows[0].date, latest: latestRows[0].date };
}

export async function saveForecast(
  supabase: SupabaseClient,
  accountId: string,
  result: {
    horizon: Horizon;
    starting_balance: number;
    weekly_data: ForecastRow["weekly_data"];
    low_point_week: string;
    low_point_balance: number;
    low_point_explanation: string;
  }
): Promise<void> {
  const { error } = await supabase.from("forecasts").insert({ account_id: accountId, ...result });
  if (error) throw error;
}
