// Pure helpers for the Excel export/import round trip — no Supabase, DOM, or
// `xlsx` (SheetJS) imports here, so the parsing/diffing logic is testable
// without a real workbook. SheetJS calls that read/write actual files live
// in the API export route and the ExcelUpload component.

import { parseFlexibleDate, parseAmount } from "./csv";

export interface StoredTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  source: string;
}

export interface CleanImportRow {
  id: string | null; // null => new transaction to insert
  date: string;
  description: string;
  amount: number;
  source: string;
}

export interface SkippedImportRow {
  row: number;
  reason: string;
}

function resolveDateCell(value: unknown): string | null {
  if (value instanceof Date) {
    // SheetJS (read with cellDates:true) hands back UTC-interpreted Date objects.
    const y = value.getUTCFullYear().toString().padStart(4, "0");
    const m = (value.getUTCMonth() + 1).toString().padStart(2, "0");
    const d = value.getUTCDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "string") return parseFlexibleDate(value);
  return null;
}

function resolveAmountCell(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return parseAmount(value);
  return null;
}

function cellToString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

/**
 * Cleans raw rows from the "Transactions" sheet (as returned by
 * `XLSX.utils.sheet_to_json`) the same way CSV import cleans rows: bad
 * dates, missing descriptions, and non-numeric amounts are skipped and
 * reported rather than failing the whole import. A blank `ID` marks a row
 * as a new transaction to insert.
 */
export function parseTransactionSheetRows(rawRows: Record<string, unknown>[]): {
  rows: CleanImportRow[];
  skipped: SkippedImportRow[];
} {
  const rows: CleanImportRow[] = [];
  const skipped: SkippedImportRow[] = [];

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const idStr = cellToString(raw["ID"]);
    const id = idStr === "" ? null : idStr;

    const description = cellToString(raw["Description"]);
    const date = resolveDateCell(raw["Date"]);
    const amount = resolveAmountCell(raw["Amount"]);
    const sourceStr = cellToString(raw["Source"]);
    const source = sourceStr === "" ? "excel" : sourceStr;

    if (!date) {
      skipped.push({ row: rowNumber, reason: `unrecognized date "${raw["Date"] ?? ""}"` });
      return;
    }
    if (!description) {
      skipped.push({ row: rowNumber, reason: "missing description" });
      return;
    }
    if (amount === null) {
      skipped.push({ row: rowNumber, reason: `non-numeric amount "${raw["Amount"] ?? ""}"` });
      return;
    }

    rows.push({ id, date, description, amount, source });
  });

  return { rows, skipped };
}

export interface TransactionDiff {
  toInsert: { date: string; description: string; amount: number; source: string }[];
  toUpdate: { id: string; date: string; description: string; amount: number; source: string }[];
  toDeleteIds: string[];
}

/**
 * Diffs cleaned sheet rows against what's currently stored: a row with an ID
 * matching an existing transaction where a field differs is an update; a
 * blank-ID row (or one whose ID no longer matches anything) is an insert;
 * an existing transaction whose ID appears nowhere in the sheet is a delete.
 */
export function diffTransactions(cleanRows: CleanImportRow[], existing: StoredTransaction[]): TransactionDiff {
  const existingById = new Map(existing.map((t) => [t.id, t]));
  const seenIds = new Set<string>();

  const toInsert: TransactionDiff["toInsert"] = [];
  const toUpdate: TransactionDiff["toUpdate"] = [];

  for (const row of cleanRows) {
    const current = row.id === null ? undefined : existingById.get(row.id);

    if (!current) {
      toInsert.push({ date: row.date, description: row.description, amount: row.amount, source: row.source });
      continue;
    }

    seenIds.add(row.id as string);
    const changed =
      current.date !== row.date ||
      current.description !== row.description ||
      current.amount !== row.amount ||
      current.source !== row.source;
    if (changed) {
      toUpdate.push({ id: current.id, date: row.date, description: row.description, amount: row.amount, source: row.source });
    }
  }

  const toDeleteIds = existing.filter((t) => !seenIds.has(t.id)).map((t) => t.id);

  return { toInsert, toUpdate, toDeleteIds };
}

export interface AccountInfoValues {
  name: string;
  currency: string;
  minimum_buffer: number;
  starting_balance_override: number | null;
}

/** Parses the key/value "Account Info" sheet, read as an array-of-arrays (`header: 1`). */
export function parseAccountInfoSheet(rows: unknown[][]): Partial<AccountInfoValues> {
  const map = new Map<string, unknown>();
  for (const row of rows) {
    const key = row[0];
    if (typeof key === "string" && key.trim() !== "") map.set(key.trim().toLowerCase(), row[1]);
  }

  const result: Partial<AccountInfoValues> = {};

  const name = map.get("name");
  if (typeof name === "string" && name.trim() !== "") result.name = name.trim();

  const currency = map.get("currency");
  if (typeof currency === "string" && currency.trim() !== "") result.currency = currency.trim();

  const minimumBuffer = resolveAmountCell(map.get("minimum buffer"));
  if (minimumBuffer !== null) result.minimum_buffer = minimumBuffer;

  if (map.has("starting balance override")) {
    const raw = map.get("starting balance override");
    const str = cellToString(raw);
    result.starting_balance_override = str === "" ? null : resolveAmountCell(raw);
  }

  return result;
}

export interface AccountInfoDiff {
  name?: string;
  currency?: string;
  minimum_buffer?: number;
  starting_balance_override?: number | null;
}

export function diffAccountInfo(
  parsed: Partial<AccountInfoValues>,
  current: { name: string; currency: string; minimum_buffer: number; starting_balance_override: number | null }
): AccountInfoDiff {
  const diff: AccountInfoDiff = {};
  if (parsed.name !== undefined && parsed.name !== current.name) diff.name = parsed.name;
  if (parsed.currency !== undefined && parsed.currency !== current.currency) diff.currency = parsed.currency;
  if (parsed.minimum_buffer !== undefined && parsed.minimum_buffer !== current.minimum_buffer) {
    diff.minimum_buffer = parsed.minimum_buffer;
  }
  if ("starting_balance_override" in parsed && parsed.starting_balance_override !== current.starting_balance_override) {
    diff.starting_balance_override = parsed.starting_balance_override ?? null;
  }
  return diff;
}

export interface MonthlySummaryRow {
  month: string; // "YYYY-MM"
  totalIncome: number;
  totalExpenses: number;
  net: number;
  transactionCount: number;
}

/** Computed from the transactions themselves at export time — reference only, never re-imported. */
export function buildMonthlySummary(transactions: { date: string; amount: number }[]): MonthlySummaryRow[] {
  const byMonth = new Map<string, MonthlySummaryRow>();

  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const row = byMonth.get(month) ?? { month, totalIncome: 0, totalExpenses: 0, net: 0, transactionCount: 0 };
    if (t.amount >= 0) row.totalIncome += t.amount;
    else row.totalExpenses += Math.abs(t.amount);
    row.transactionCount += 1;
    byMonth.set(month, row);
  }

  const rows = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const row of rows) {
    row.totalIncome = Math.round(row.totalIncome * 100) / 100;
    row.totalExpenses = Math.round(row.totalExpenses * 100) / 100;
    row.net = Math.round((row.totalIncome - row.totalExpenses) * 100) / 100;
  }
  return rows;
}

/** ISO `yyyy-mm-dd` -> a UTC-midnight JS Date, for writing real date cells into an export workbook. */
export function isoDateToJsDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** A filesystem/header-safe filename segment derived from the account name. */
export function safeFilenameSegment(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "account";
}
