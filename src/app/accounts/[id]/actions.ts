"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccount, insertTransactions, listAllTransactionsForForecast, saveForecast, deleteAccount, updateAccount } from "@/lib/queries";
import { computeHorizonEligibility, getHistoryDays, runForecast, HORIZON_LABELS, type Horizon } from "@/lib/forecast";
import type { CleanTransaction } from "@/lib/csv";

function parseHorizon(value: FormDataEntryValue | null): Horizon {
  return value === "month" || value === "year" ? value : "quarter";
}

export async function importTransactionsAction(accountId: string, rows: CleanTransaction[]) {
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) throw new Error("Account not found");

  await insertTransactions(supabase, accountId, rows);
  revalidatePath(`/accounts/${accountId}`);
}

export async function runForecastAction(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const horizon = parseHorizon(formData.get("horizon"));
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) redirect("/dashboard");

  const transactions = await listAllTransactionsForForecast(supabase, accountId);
  const eligibility = computeHorizonEligibility(getHistoryDays(transactions), horizon);
  if (!eligibility.eligible) {
    const message = `${HORIZON_LABELS[horizon]} forecast needs ${eligibility.daysNeeded} more day${
      eligibility.daysNeeded === 1 ? "" : "s"
    } of transaction history.`;
    redirect(`/accounts/${accountId}?error=${encodeURIComponent(message)}`);
  }

  const result = runForecast(transactions, {
    horizon,
    minimumBuffer: account.minimum_buffer,
    startingBalanceOverride: account.starting_balance_override,
  });
  await saveForecast(supabase, accountId, result);
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath(`/accounts/${accountId}/forecasts`);
}

export async function updateAccountSettingsAction(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const minimumBuffer = Number(formData.get("minimum_buffer") ?? 0);
  const overrideRaw = String(formData.get("starting_balance_override") ?? "").trim();
  const startingBalanceOverride = overrideRaw === "" ? null : Number(overrideRaw);

  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) redirect("/dashboard");

  await updateAccount(supabase, accountId, {
    name: name || account.name,
    minimum_buffer: Number.isFinite(minimumBuffer) ? minimumBuffer : 0,
    starting_balance_override:
      startingBalanceOverride !== null && Number.isFinite(startingBalanceOverride)
        ? startingBalanceOverride
        : null,
  });

  revalidatePath(`/accounts/${accountId}`);
  redirect(`/accounts/${accountId}/settings?saved=1`);
}

export async function deleteAccountAction(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) redirect("/dashboard");

  await deleteAccount(supabase, accountId);
  redirect("/dashboard");
}
