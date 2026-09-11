import { describe, expect, it } from "vitest";
import { buildTransactions, detectColumnMapping, parseFlexibleDate } from "./csv";

describe("detectColumnMapping", () => {
  it("detects the sample file's exact headers", () => {
    expect(detectColumnMapping(["Date", "Description", "Amount"])).toEqual({
      date: "Date",
      description: "Description",
      mode: "single",
      amount: "Amount",
    });
  });

  it("falls back to debit/credit columns", () => {
    expect(detectColumnMapping(["Transaction Date", "Memo", "Debit", "Credit"])).toEqual({
      date: "Transaction Date",
      description: "Memo",
      mode: "debit-credit",
      debit: "Debit",
      credit: "Credit",
    });
  });

  it("returns null when nothing recognizable is present", () => {
    expect(detectColumnMapping(["Foo", "Bar"])).toBeNull();
  });
});

describe("parseFlexibleDate", () => {
  it("parses ISO dates", () => {
    expect(parseFlexibleDate("2026-03-09")).toBe("2026-03-09");
  });

  it("parses US-style dates", () => {
    expect(parseFlexibleDate("3/9/2026")).toBe("2026-03-09");
  });

  it("rejects impossible dates", () => {
    expect(parseFlexibleDate("2026-02-30")).toBeNull();
    expect(parseFlexibleDate("not a date")).toBeNull();
  });
});

describe("buildTransactions", () => {
  const mapping = { date: "Date", description: "Description", mode: "single" as const, amount: "Amount" };

  it("cleans well-formed rows and skips bad ones with reasons", () => {
    const { transactions, skipped } = buildTransactions(
      [
        { Date: "2026-01-05", Description: "ACME SUPPLIES CO", Amount: "-3050.00" },
        { Date: "not-a-date", Description: "BAD ROW", Amount: "10" },
        { Date: "2026-01-06", Description: "", Amount: "10" },
        { Date: "2026-01-07", Description: "GOOD ROW", Amount: "not-a-number" },
        { Date: "2026-01-08", Description: "PARENS NEGATIVE", Amount: "(45.00)" },
      ],
      mapping
    );

    expect(transactions).toEqual([
      { date: "2026-01-05", description: "ACME SUPPLIES CO", amount: -3050 },
      { date: "2026-01-08", description: "PARENS NEGATIVE", amount: -45 },
    ]);
    expect(skipped).toHaveLength(3);
    expect(skipped[0].reason).toMatch(/unrecognized date/);
    expect(skipped[1].reason).toMatch(/missing description/);
    expect(skipped[2].reason).toMatch(/non-numeric amount/);
  });

  it("combines separate debit/credit columns into a signed amount", () => {
    const { transactions } = buildTransactions(
      [{ Date: "2026-01-05", Description: "DEPOSIT", Debit: "", Credit: "500.00" }],
      { date: "Date", description: "Description", mode: "debit-credit", debit: "Debit", credit: "Credit" }
    );
    expect(transactions).toEqual([{ date: "2026-01-05", description: "DEPOSIT", amount: 500 }]);
  });
});
