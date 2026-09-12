"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getAccount,
  insertTransactions,
  listAllTransactionsForForecast,
  listAllTransactionsFull,
  applyExcelImport,
  saveForecast,
  deleteAccount,
  updateAccount,
} from "@/lib/queries";
import { computeHorizonEligibility, getHistoryDays, runForecast, type Horizon } from "@/lib/forecast";
import { translations, interpolate, pluralS, parseLocaleFormField, type TranslationKey } from "@/lib/i18n";
import { diffTransactions, diffAccountInfo, type CleanImportRow, type AccountInfoValues } from "@/lib/excel";
import type { CleanTransaction } from "@/lib/csv";

function parseHorizon(value: FormDataEntryValue | null): Horizon {
  return value === "month" || value === "year" ? value : "quarter";
}

const HORIZON_LABEL_KEYS: Record<Horizon, TranslationKey> = {
  month: "horizonMonth",
  quarter: "horizonQuarter",
  year: "horizonYear",
};

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
  const locale = parseLocaleFormField(formData.get("locale"));
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) redirect("/dashboard");

  const transactions = await listAllTransactionsForForecast(supabase, accountId);
  const eligibility = computeHorizonEligibility(getHistoryDays(transactions), horizon);
  if (!eligibility.eligible) {
    const message = interpolate(translations[locale].errorHorizonNeedsDays, {
      horizon: translations[locale][HORIZON_LABEL_KEYS[horizon]],
      days: eligibility.daysNeeded,
      plural: pluralS(eligibility.daysNeeded, locale),
    });
    redirect(`/accounts/${accountId}?error=${encodeURIComponent(message)}`);
  }

  const result = runForecast(transactions, {
    horizon,
    locale,
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

/** Read-only snapshot of an account's current data, used to build the Excel-import preview client-side. */
export async function getAccountImportSnapshotAction(accountId: string) {
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) throw new Error("Account not found");

  const transactions = await listAllTransactionsFull(supabase, accountId);

  return {
    account: {
      name: account.name,
      currency: account.currency,
      minimum_buffer: account.minimum_buffer,
      starting_balance_override: account.starting_balance_override,
    },
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      source: t.source,
    })),
  };
}

export interface ExcelImportSummary {
  insertCount: number;
  updateCount: number;
  deleteCount: number;
  accountChanges: ReturnType<typeof diffAccountInfo>;
}

/**
 * Applies an Excel import. Re-fetches current data and recomputes the diff
 * fresh (never trusts a diff computed client-side against possibly-stale
 * data), then applies it as one atomic operation via the `apply_excel_import`
 * RPC. No forecast is re-run automatically — the account's forecast history
 * stays as-is until the person runs a new one manually.
 */
export async function commitExcelImportAction(
  accountId: string,
  cleanRows: CleanImportRow[],
  accountInfoPatch: Partial<AccountInfoValues>
): Promise<ExcelImportSummary> {
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) throw new Error("Account not found");

  const existing = await listAllTransactionsFull(supabase, accountId);
  const txDiff = diffTransactions(
    cleanRows,
    existing.map((t) => ({ id: t.id, date: t.date, description: t.description, amount: t.amount, source: t.source }))
  );
  const accountDiff = diffAccountInfo(accountInfoPatch, {
    name: account.name,
    currency: account.currency,
    minimum_buffer: account.minimum_buffer,
    starting_balance_override: account.starting_balance_override,
  });

  await applyExcelImport(supabase, {
    accountId,
    accountPatch: Object.keys(accountDiff).length > 0 ? accountDiff : null,
    toInsert: txDiff.toInsert,
    toUpdate: txDiff.toUpdate,
    toDeleteIds: txDiff.toDeleteIds,
  });

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath(`/accounts/${accountId}/settings`);
  revalidatePath(`/accounts/${accountId}/forecasts`);

  return {
    insertCount: txDiff.toInsert.length,
    updateCount: txDiff.toUpdate.length,
    deleteCount: txDiff.toDeleteIds.length,
    accountChanges: accountDiff,
  };
}

export async function deleteAccountAction(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const supabase = await createClient();
  const account = await getAccount(supabase, accountId);
  if (!account) redirect("/dashboard");

  await deleteAccount(supabase, accountId);
  redirect("/dashboard");
}
