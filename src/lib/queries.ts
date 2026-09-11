import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function getLatestForecast(
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

export async function saveForecast(
  supabase: SupabaseClient,
  accountId: string,
  result: {
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
