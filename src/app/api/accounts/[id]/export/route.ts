import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getAccount, listAllTransactionsFull, listAllForecastsFull } from "@/lib/queries";
import { detectRecurringGroups } from "@/lib/forecast";
import { buildMonthlySummary, isoDateToJsDate, safeFilenameSegment } from "@/lib/excel";

export const runtime = "nodejs"; // xlsx needs Node Buffer APIs, not the Edge runtime

const DATE_FORMAT = "yyyy-mm-dd";
const DATETIME_FORMAT = "yyyy-mm-dd hh:mm";
const CURRENCY_FORMAT = "#,##0.00";

function setColumnFormat(sheet: XLSX.WorkSheet, colIndexes: number[], format: string, dataRowCount: number): void {
  for (const c of colIndexes) {
    for (let r = 1; r <= dataRowCount; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = format;
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const supabase = await createClient();
  const account = await getAccount(supabase, id);
  if (!account) return new Response("Not found", { status: 404 });

  const [transactions, forecasts] = await Promise.all([
    listAllTransactionsFull(supabase, id),
    listAllForecastsFull(supabase, id),
  ]);

  const wb = XLSX.utils.book_new();

  // --- Transactions: the editable sheet, re-imported on the way back in ---
  const txRows = transactions.map((t) => [t.id, isoDateToJsDate(t.date), t.description, t.amount, t.source]);
  const txSheet = XLSX.utils.aoa_to_sheet([["ID", "Date", "Description", "Amount", "Source"], ...txRows]);
  setColumnFormat(txSheet, [1], DATE_FORMAT, txRows.length);
  setColumnFormat(txSheet, [3], CURRENCY_FORMAT, txRows.length);
  // ID stays narrow and unobtrusive — it's only there to match rows on re-import.
  txSheet["!cols"] = [{ wch: 9 }, { wch: 12 }, { wch: 42 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, txSheet, "Transactions");

  // --- Monthly Summary: reference only ---
  const summary = buildMonthlySummary(transactions.map((t) => ({ date: t.date, amount: t.amount })));
  const summaryRows = summary.map((s) => [s.month, s.totalIncome, s.totalExpenses, s.net, s.transactionCount]);
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Month", "Total Income", "Total Expenses", "Net", "Transaction Count"],
    ...summaryRows,
  ]);
  setColumnFormat(summarySheet, [1, 2, 3], CURRENCY_FORMAT, summaryRows.length);
  summarySheet["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Monthly Summary");

  // --- Recurring Patterns: exposes what the forecast engine currently detects ---
  const { recurring } = detectRecurringGroups(
    transactions.map((t) => ({ date: t.date, description: t.description, amount: t.amount }))
  );
  const recRows = recurring.map((g) => [
    g.label,
    Math.round(g.averageAmount * 100) / 100,
    Math.round(g.averageIntervalDays),
    isoDateToJsDate(g.lastOccurrence),
    g.occurrences,
  ]);
  const recSheet = XLSX.utils.aoa_to_sheet([
    ["Description", "Average Amount", "Average Interval (days)", "Last Occurrence", "Occurrences Counted"],
    ...recRows,
  ]);
  setColumnFormat(recSheet, [1], CURRENCY_FORMAT, recRows.length);
  setColumnFormat(recSheet, [3], DATE_FORMAT, recRows.length);
  recSheet["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, recSheet, "Recurring Patterns");

  // --- Forecast History: reference only ---
  const fcRows = forecasts.map((f) => [
    capitalize(f.horizon),
    new Date(f.generated_at),
    f.starting_balance,
    f.low_point_week ? isoDateToJsDate(f.low_point_week) : "",
    f.low_point_balance ?? "",
    f.low_point_explanation ?? "",
  ]);
  const fcSheet = XLSX.utils.aoa_to_sheet([
    ["Horizon", "Generated At", "Starting Balance", "Low Point Date", "Low Point Balance", "Explanation"],
    ...fcRows,
  ]);
  setColumnFormat(fcSheet, [1], DATETIME_FORMAT, fcRows.length);
  setColumnFormat(fcSheet, [2, 4], CURRENCY_FORMAT, fcRows.length);
  setColumnFormat(fcSheet, [3], DATE_FORMAT, fcRows.length);
  fcSheet["!cols"] = [{ wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, fcSheet, "Forecast History");

  // --- Account Info: editable key/value sheet, re-imported on the way back in ---
  const infoSheet = XLSX.utils.aoa_to_sheet([
    ["Field", "Value"],
    ["Name", account.name],
    ["Currency", account.currency],
    ["Minimum Buffer", account.minimum_buffer],
    ["Starting Balance Override", account.starting_balance_override ?? ""],
  ]);
  // Only the two numeric rows (Minimum Buffer, Starting Balance Override) get a currency format.
  if (infoSheet["B3"]) infoSheet["B3"].z = CURRENCY_FORMAT;
  if (infoSheet["B4"]) infoSheet["B4"].z = CURRENCY_FORMAT;
  infoSheet["!cols"] = [{ wch: 26 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, infoSheet, "Account Info");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const filename = `${safeFilenameSegment(account.name)}-export.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
