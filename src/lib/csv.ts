// Pure helpers for turning a papaparse result into clean, signed
// { date, description, amount } rows — independent of the DB or any UI so
// the column-detection and row-cleaning rules can be reasoned about (and
// tested) on their own.

export type RawCsvRow = Record<string, string>;

export type AmountMode = "single" | "debit-credit";

export interface ColumnMapping {
  date: string;
  description: string;
  mode: AmountMode;
  amount?: string;
  debit?: string;
  credit?: string;
}

export interface CleanTransaction {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number;
}

export interface SkippedRow {
  row: number; // 1-based row number within the parsed data
  reason: string;
}

export interface ImportPreview {
  mapping: ColumnMapping | null;
  headers: string[];
  sampleRows: RawCsvRow[];
}

const DATE_HEADERS = ["date", "transaction date"];
const DESCRIPTION_HEADERS = ["description", "memo"];
const AMOUNT_HEADERS = ["amount"];
const DEBIT_HEADERS = ["debit"];
const CREDIT_HEADERS = ["credit"];

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map((h) => [h, h.trim().toLowerCase()] as const);
  for (const candidate of candidates) {
    const match = normalized.find(([, lower]) => lower === candidate);
    if (match) return match[0];
  }
  return undefined;
}

/** Best-effort column detection; returns null if date/description can't be found or no amount source is present. */
export function detectColumnMapping(headers: string[]): ColumnMapping | null {
  const date = findHeader(headers, DATE_HEADERS);
  const description = findHeader(headers, DESCRIPTION_HEADERS);
  if (!date || !description) return null;

  const amount = findHeader(headers, AMOUNT_HEADERS);
  if (amount) return { date, description, mode: "single", amount };

  const debit = findHeader(headers, DEBIT_HEADERS);
  const credit = findHeader(headers, CREDIT_HEADERS);
  if (debit || credit) return { date, description, mode: "debit-credit", debit, credit };

  return null;
}

/** Accepts ISO (yyyy-mm-dd) and US (m/d/yyyy) formatted dates; returns null if unparseable or not a real calendar date. */
export function parseFlexibleDate(value: string): string | null {
  const trimmed = value.trim();

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return toIsoIfValid(Number(y), Number(m), Number(d));
  }

  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    return toIsoIfValid(Number(y), Number(m), Number(d));
  }

  return null;
}

function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function parseAmount(value: string | undefined): number | null {
  if (value === undefined) return null;
  const cleaned = value.trim().replace(/[$,]/g, "");
  if (cleaned === "") return null;
  // Accept "(123.45)" as a negative-amount convention some bank exports use.
  const negativeParens = /^\((.*)\)$/.exec(cleaned);
  const numeric = negativeParens ? `-${negativeParens[1]}` : cleaned;
  const n = Number(numeric);
  return Number.isFinite(n) ? n : null;
}

export function buildTransactions(
  rows: RawCsvRow[],
  mapping: ColumnMapping
): { transactions: CleanTransaction[]; skipped: SkippedRow[] } {
  const transactions: CleanTransaction[] = [];
  const skipped: SkippedRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const description = (row[mapping.description] ?? "").trim();
    const rawDate = row[mapping.date] ?? "";
    const date = parseFlexibleDate(rawDate);

    if (!date) {
      skipped.push({ row: rowNumber, reason: `unrecognized date "${rawDate}"` });
      return;
    }
    if (!description) {
      skipped.push({ row: rowNumber, reason: "missing description" });
      return;
    }

    let amount: number | null;
    if (mapping.mode === "single") {
      amount = parseAmount(row[mapping.amount!]);
      if (amount === null) {
        skipped.push({ row: rowNumber, reason: `non-numeric amount "${row[mapping.amount!]}"` });
        return;
      }
    } else {
      const debit = mapping.debit ? parseAmount(row[mapping.debit]) : null;
      const credit = mapping.credit ? parseAmount(row[mapping.credit]) : null;
      if (debit === null && credit === null) {
        skipped.push({ row: rowNumber, reason: "missing debit/credit amount" });
        return;
      }
      amount = (credit ?? 0) - (debit ?? 0);
    }

    transactions.push({ date, description, amount });
  });

  return { transactions, skipped };
}
