import { describe, expect, it } from "vitest";
import {
  parseTransactionSheetRows,
  diffTransactions,
  parseAccountInfoSheet,
  diffAccountInfo,
  buildMonthlySummary,
  safeFilenameSegment,
  type StoredTransaction,
} from "./excel";

describe("parseTransactionSheetRows", () => {
  it("parses a well-formed row, treating a blank ID as new", () => {
    const { rows, skipped } = parseTransactionSheetRows([
      { ID: "", Date: new Date(Date.UTC(2026, 0, 15)), Description: "Coffee", Amount: -4.5, Source: "excel" },
      { ID: "abc-123", Date: "2026-01-16", Description: "Payroll", Amount: 1000, Source: "csv" },
    ]);

    expect(skipped).toHaveLength(0);
    expect(rows).toEqual([
      { id: null, date: "2026-01-15", description: "Coffee", amount: -4.5, source: "excel" },
      { id: "abc-123", date: "2026-01-16", description: "Payroll", amount: 1000, source: "csv" },
    ]);
  });

  it("defaults a blank Source to 'excel'", () => {
    const { rows } = parseTransactionSheetRows([{ ID: "", Date: "2026-01-01", Description: "X", Amount: 1, Source: "" }]);
    expect(rows[0].source).toBe("excel");
  });

  it("skips rows with an unrecognized date, missing description, or non-numeric amount", () => {
    const { rows, skipped } = parseTransactionSheetRows([
      { ID: "", Date: "not-a-date", Description: "X", Amount: 1 },
      { ID: "", Date: "2026-01-01", Description: "", Amount: 1 },
      { ID: "", Date: "2026-01-01", Description: "X", Amount: "abc" },
    ]);
    expect(rows).toHaveLength(0);
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toMatch(/unrecognized date/);
    expect(skipped[1].reason).toMatch(/missing description/);
    expect(skipped[2].reason).toMatch(/non-numeric amount/);
  });

  it("accepts a currency-formatted string amount, matching CSV import rules", () => {
    const { rows } = parseTransactionSheetRows([{ ID: "", Date: "2026-01-01", Description: "X", Amount: "$1,200.50" }]);
    expect(rows[0].amount).toBe(1200.5);
  });
});

describe("diffTransactions", () => {
  const existing: StoredTransaction[] = [
    { id: "1", date: "2026-01-01", description: "Rent", amount: -1000, source: "csv" },
    { id: "2", date: "2026-01-05", description: "Payroll", amount: 2000, source: "csv" },
  ];

  it("treats a blank-ID row as an insert", () => {
    const diff = diffTransactions([{ id: null, date: "2026-01-10", description: "New", amount: 50, source: "excel" }], existing);
    expect(diff.toInsert).toEqual([{ date: "2026-01-10", description: "New", amount: 50, source: "excel" }]);
    expect(diff.toUpdate).toHaveLength(0);
    // Both existing rows are missing from the sheet, so both are flagged for deletion.
    expect(diff.toDeleteIds.sort()).toEqual(["1", "2"]);
  });

  it("treats a matching ID with a changed field as an update, and leaves unchanged rows alone", () => {
    const diff = diffTransactions(
      [
        { id: "1", date: "2026-01-01", description: "Rent", amount: -1100, source: "csv" }, // amount changed
        { id: "2", date: "2026-01-05", description: "Payroll", amount: 2000, source: "csv" }, // unchanged
      ],
      existing
    );
    expect(diff.toUpdate).toEqual([{ id: "1", date: "2026-01-01", description: "Rent", amount: -1100, source: "csv" }]);
    expect(diff.toInsert).toHaveLength(0);
    expect(diff.toDeleteIds).toHaveLength(0);
  });

  it("flags an existing transaction missing from the sheet for deletion", () => {
    const diff = diffTransactions(
      [{ id: "1", date: "2026-01-01", description: "Rent", amount: -1000, source: "csv" }],
      existing
    );
    expect(diff.toDeleteIds).toEqual(["2"]);
  });

  it("treats a row with an ID matching nothing real as an insert rather than crashing", () => {
    const diff = diffTransactions(
      [{ id: "does-not-exist", date: "2026-01-01", description: "X", amount: 1, source: "excel" }],
      existing
    );
    expect(diff.toInsert).toHaveLength(1);
  });
});

describe("parseAccountInfoSheet / diffAccountInfo", () => {
  const current = { name: "Acme LLC", currency: "USD", minimum_buffer: 500, starting_balance_override: 1000 };

  it("parses a well-formed key/value sheet", () => {
    const parsed = parseAccountInfoSheet([
      ["Field", "Value"],
      ["Name", "Acme LLC"],
      ["Currency", "ILS"],
      ["Minimum Buffer", 750],
      ["Starting Balance Override", 2000],
    ]);
    expect(parsed).toEqual({ name: "Acme LLC", currency: "ILS", minimum_buffer: 750, starting_balance_override: 2000 });
  });

  it("treats a blank Starting Balance Override as clearing it to null", () => {
    const parsed = parseAccountInfoSheet([
      ["Name", "Acme LLC"],
      ["Starting Balance Override", ""],
    ]);
    expect(parsed.starting_balance_override).toBeNull();
  });

  it("diff only reports fields that actually changed", () => {
    const parsed = parseAccountInfoSheet([
      ["Name", "Acme LLC"], // unchanged
      ["Currency", "ILS"], // changed
      ["Minimum Buffer", 500], // unchanged
      ["Starting Balance Override", 2000], // changed
    ]);
    const diff = diffAccountInfo(parsed, current);
    expect(diff).toEqual({ currency: "ILS", starting_balance_override: 2000 });
  });

  it("diff is empty when nothing changed", () => {
    const parsed = parseAccountInfoSheet([
      ["Name", "Acme LLC"],
      ["Currency", "USD"],
      ["Minimum Buffer", 500],
      ["Starting Balance Override", 1000],
    ]);
    expect(diffAccountInfo(parsed, current)).toEqual({});
  });
});

describe("buildMonthlySummary", () => {
  it("groups by calendar month and computes totals", () => {
    const rows = buildMonthlySummary([
      { date: "2026-01-05", amount: 1000 },
      { date: "2026-01-10", amount: -200 },
      { date: "2026-02-01", amount: -50 },
    ]);
    expect(rows).toEqual([
      { month: "2026-01", totalIncome: 1000, totalExpenses: 200, net: 800, transactionCount: 2 },
      { month: "2026-02", totalIncome: 0, totalExpenses: 50, net: -50, transactionCount: 1 },
    ]);
  });
});

describe("safeFilenameSegment", () => {
  it("strips characters unsafe for filenames/headers", () => {
    expect(safeFilenameSegment("Acme LLC / Payments?")).toBe("Acme-LLC-Payments");
  });

  it("falls back to a default when nothing survives", () => {
    expect(safeFilenameSegment("???")).toBe("account");
  });
});
