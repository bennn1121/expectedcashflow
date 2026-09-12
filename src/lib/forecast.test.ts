import { describe, expect, it } from "vitest";
import {
  computeHorizonEligibility,
  detectRecurringGroups,
  getHistoryDays,
  getAllHorizonEligibility,
  normalizeDescription,
  runForecast,
  type RawTransaction,
} from "./forecast";

const TODAY = new Date(Date.UTC(2026, 6, 1)); // 2026-07-01, the day after our synthetic data ends

// A synthetic six-month history: monthly payroll, a ~30-day vendor payment,
// monthly rent, a ~30-day hosting subscription, one-off customer payments,
// one-off misc expenses, and Amazon purchases that share a description
// prefix but happen at random intervals (should NOT be treated as recurring).
const SAMPLE_TRANSACTIONS: RawTransaction[] = [
  // Payroll — 1st of each month
  { date: "2026-01-01", description: "PAYROLL - ACME LLC STAFF", amount: -8200 },
  { date: "2026-02-01", description: "PAYROLL - ACME LLC STAFF", amount: -8200 },
  { date: "2026-03-01", description: "PAYROLL - ACME LLC STAFF", amount: -8200 },
  { date: "2026-04-01", description: "PAYROLL - ACME LLC STAFF", amount: -8200 },
  { date: "2026-05-01", description: "PAYROLL - ACME LLC STAFF", amount: -8200 },
  { date: "2026-06-01", description: "PAYROLL - ACME LLC STAFF", amount: -8200 },

  // Vendor payment — every 30 days on the dot
  { date: "2026-01-05", description: "ACME SUPPLIES CO - INVOICE", amount: -3050 },
  { date: "2026-02-04", description: "ACME SUPPLIES CO - INVOICE", amount: -3050 },
  { date: "2026-03-06", description: "ACME SUPPLIES CO - INVOICE", amount: -3050 },
  { date: "2026-04-05", description: "ACME SUPPLIES CO - INVOICE", amount: -3050 },
  { date: "2026-05-05", description: "ACME SUPPLIES CO - INVOICE", amount: -3050 },
  { date: "2026-06-04", description: "ACME SUPPLIES CO - INVOICE", amount: -3050 },

  // Rent — 10th of each month
  { date: "2026-01-10", description: "OFFICE LEASE - RENT", amount: -2500 },
  { date: "2026-02-10", description: "OFFICE LEASE - RENT", amount: -2500 },
  { date: "2026-03-10", description: "OFFICE LEASE - RENT", amount: -2500 },
  { date: "2026-04-10", description: "OFFICE LEASE - RENT", amount: -2500 },
  { date: "2026-05-10", description: "OFFICE LEASE - RENT", amount: -2500 },
  { date: "2026-06-10", description: "OFFICE LEASE - RENT", amount: -2500 },

  // Hosting — every ~30 days
  { date: "2026-01-15", description: "CLOUDLINE HOSTING SUBSCRIPTION", amount: -180 },
  { date: "2026-02-14", description: "CLOUDLINE HOSTING SUBSCRIPTION", amount: -180 },
  { date: "2026-03-16", description: "CLOUDLINE HOSTING SUBSCRIPTION", amount: -180 },
  { date: "2026-04-15", description: "CLOUDLINE HOSTING SUBSCRIPTION", amount: -180 },
  { date: "2026-05-15", description: "CLOUDLINE HOSTING SUBSCRIPTION", amount: -180 },
  { date: "2026-06-14", description: "CLOUDLINE HOSTING SUBSCRIPTION", amount: -180 },

  // One-off customer payments (irregular, distinct payers). The three most
  // recent (within the engine's 10-week lookback for the irregular baseline)
  // are large enough that the healthy weekly baseline income outpaces the
  // ~$13,930/month of recurring obligations below, so the account recovers
  // between recurring hits — making the very first collision (against a
  // thin $2,000 starting balance) the deepest point in the 13-week window.
  { date: "2026-01-20", description: "CUSTOMER PAYMENT - ACME RETAIL", amount: 1500 },
  { date: "2026-02-25", description: "CUSTOMER PAYMENT - BLUE OAK CO", amount: 2200 },
  { date: "2026-03-12", description: "CUSTOMER PAYMENT - HARBOR GOODS", amount: 1800 },
  { date: "2026-04-18", description: "CUSTOMER PAYMENT - NORTHWIND LTD", amount: 2600 },
  { date: "2026-05-22", description: "CUSTOMER PAYMENT - SILVERLINE INC", amount: 20000 },
  { date: "2026-06-08", description: "CUSTOMER PAYMENT - DELTA MARKET", amount: 20000 },
  { date: "2026-06-25", description: "CUSTOMER PAYMENT - PINEWOOD CO", amount: 20000 },

  // Misc small expenses (one-off)
  { date: "2026-01-08", description: "COFFEE SHOP DOWNTOWN", amount: -18 },
  { date: "2026-02-11", description: "OFFICE SUPPLIES DEPOT", amount: -95 },
  { date: "2026-03-22", description: "PARKING GARAGE DOWNTOWN", amount: -60 },
  { date: "2026-04-09", description: "COURIER EXPRESS DELIVERY", amount: -40 },
  { date: "2026-05-14", description: "PRINT SHOP INVOICE", amount: -75 },

  // Amazon purchases: shared prefix, random intervals/amounts -> should NOT
  // be classified as recurring even though they group together.
  { date: "2026-01-08", description: "AMZN MKTP US*2F3", amount: -45.2 },
  { date: "2026-02-19", description: "AMZN MKTP US*8G1", amount: -32.1 },
  { date: "2026-03-03", description: "AMZN MKTP US*K91Q", amount: -78.4 },
  { date: "2026-05-27", description: "AMZN MKTP US*4RT2", amount: -19.99 },
];

describe("normalizeDescription", () => {
  it("strips order-code suffixes so repeat purchases share a key", () => {
    expect(normalizeDescription("AMZN MKTP US*2F3")).toBe("AMZN MKTP US");
    expect(normalizeDescription("AMZN MKTP US*8G1")).toBe("AMZN MKTP US");
  });

  it("leaves ordinary payee names untouched", () => {
    expect(normalizeDescription("PAYROLL - ACME LLC STAFF")).toBe("PAYROLL - ACME LLC STAFF");
    expect(normalizeDescription("  Office Lease - Rent  ")).toBe("OFFICE LEASE - RENT");
  });
});

describe("detectRecurringGroups", () => {
  const { recurring, nonRecurring } = detectRecurringGroups(SAMPLE_TRANSACTIONS);

  it("finds all four recurring payments", () => {
    const labels = recurring.map((g) => g.label).sort();
    expect(labels).toEqual(
      [
        "PAYROLL - ACME LLC STAFF",
        "ACME SUPPLIES CO - INVOICE",
        "OFFICE LEASE - RENT",
        "CLOUDLINE HOSTING SUBSCRIPTION",
      ].sort()
    );
  });

  it("computes payroll's average amount and ~30 day interval", () => {
    const payroll = recurring.find((g) => g.label === "PAYROLL - ACME LLC STAFF")!;
    expect(payroll.averageAmount).toBe(-8200);
    expect(payroll.averageIntervalDays).toBeGreaterThan(29);
    expect(payroll.averageIntervalDays).toBeLessThan(31);
    expect(payroll.lastOccurrence).toBe("2026-06-01");
  });

  it("does not classify the Amazon purchases as recurring", () => {
    expect(recurring.some((g) => g.key === "AMZN MKTP US")).toBe(false);
    expect(nonRecurring.some((t) => t.description.startsWith("AMZN"))).toBe(true);
  });

  it("requires at least 3 occurrences", () => {
    expect(recurring.every((g) => g.occurrences >= 3)).toBe(true);
  });
});

describe("runForecast", () => {
  it("finds the low point where payroll and the vendor payment collide, and explains it", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      minimumBuffer: 500,
      startingBalanceOverride: 2000,
    });

    expect(result.weekly_data).toHaveLength(13);
    expect(result.starting_balance).toBe(2000);

    // Payroll (~30.2 day interval) and the vendor payment (30 days flat)
    // stay in near lock-step across every monthly cycle in the 13-week
    // window, so whichever week ends up lowest, both should be named —
    // a thin starting balance of $2,000 against ~$13,930/month of combined
    // recurring outflow guarantees a dip well below the $500 buffer.
    expect(result.low_point_balance).toBeLessThan(500);
    expect(result.low_point_explanation).toContain("PAYROLL - ACME LLC STAFF");
    expect(result.low_point_explanation).toContain("ACME SUPPLIES CO - INVOICE");
    expect(result.low_point_explanation).toMatch(/mainly because/);
  });

  it("gives a positive explanation when the balance never dips below the buffer", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      minimumBuffer: 0,
      startingBalanceOverride: 500_000,
    });

    expect(result.low_point_balance).toBeGreaterThanOrEqual(0);
    expect(result.low_point_explanation).toMatch(/stays healthy/);
  });

  it("falls back to summing history when there is no starting balance override", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, { today: TODAY });
    const expectedStart = SAMPLE_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
    expect(result.starting_balance).toBeCloseTo(expectedStart, 2);
  });

  it("defaults to the quarter horizon when none is given", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, { today: TODAY });
    expect(result.horizon).toBe("quarter");
  });
});

describe("runForecast — month horizon", () => {
  it("produces 5 weekly buckets", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      horizon: "month",
      minimumBuffer: 500,
      startingBalanceOverride: 2000,
    });

    expect(result.horizon).toBe("month");
    expect(result.weekly_data).toHaveLength(5);
    // Each bucket is a 7-day week, same shape as quarter's buckets.
    const first = result.weekly_data[0];
    const second = result.weekly_data[1];
    expect(new Date(second.week_start).getTime() - new Date(first.week_start).getTime()).toBe(7 * 86_400_000);
  });

  it("mentions 'the next 5 weeks' when the balance stays healthy", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      horizon: "month",
      minimumBuffer: 0,
      startingBalanceOverride: 500_000,
    });
    expect(result.low_point_explanation).toContain("the next 5 weeks");
  });
});

describe("runForecast — year horizon", () => {
  it("produces 12 monthly buckets spanning roughly a year", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      horizon: "year",
      minimumBuffer: 500,
      startingBalanceOverride: 2000,
    });

    expect(result.horizon).toBe("year");
    expect(result.weekly_data).toHaveLength(12);

    const first = new Date(result.weekly_data[0].week_start);
    const last = new Date(result.weekly_data[11].week_start);
    const monthsApart =
      (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth());
    expect(monthsApart).toBe(11);
  });

  it("aggregates recurring + irregular projections into monthly totals", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      horizon: "year",
      minimumBuffer: 500,
      startingBalanceOverride: 2000,
    });

    // Payroll + vendor + rent + hosting recur roughly monthly, so every
    // monthly bucket should show meaningfully more outflow than a single
    // weekly bucket would.
    for (const bucket of result.weekly_data) {
      expect(bucket.projected_out).toBeGreaterThan(1000);
    }
  });

  it("phrases the explanation in months, not weeks", () => {
    const result = runForecast(SAMPLE_TRANSACTIONS, {
      today: TODAY,
      horizon: "year",
      minimumBuffer: 0,
      startingBalanceOverride: 500_000,
    });
    expect(result.low_point_explanation).toContain("the next 12 months");
    expect(result.low_point_explanation).not.toContain("week");
  });
});

describe("getHistoryDays", () => {
  it("returns 0 for no transactions", () => {
    expect(getHistoryDays([])).toBe(0);
  });

  it("computes the span between earliest and latest transaction dates", () => {
    const txns: RawTransaction[] = [
      { date: "2026-01-01", description: "A", amount: 10 },
      { date: "2026-03-02", description: "B", amount: -5 },
    ];
    expect(getHistoryDays(txns)).toBe(60);
  });
});

describe("computeHorizonEligibility / getAllHorizonEligibility", () => {
  it("gates month at 60 days, quarter at 90, year at 180", () => {
    expect(computeHorizonEligibility(59, "month").eligible).toBe(false);
    expect(computeHorizonEligibility(60, "month").eligible).toBe(true);
    expect(computeHorizonEligibility(89, "quarter").eligible).toBe(false);
    expect(computeHorizonEligibility(90, "quarter").eligible).toBe(true);
    expect(computeHorizonEligibility(179, "year").eligible).toBe(false);
    expect(computeHorizonEligibility(180, "year").eligible).toBe(true);
  });

  it("reports exactly how many more days are needed when ineligible", () => {
    const e = computeHorizonEligibility(45, "month");
    expect(e.eligible).toBe(false);
    expect(e.daysNeeded).toBe(15);
  });

  it("flags year forecasts as low-confidence until a full annual cycle of history exists", () => {
    const shortYear = computeHorizonEligibility(200, "year");
    expect(shortYear.eligible).toBe(true);
    expect(shortYear.lowConfidence).toBe(true);

    const fullYear = computeHorizonEligibility(400, "year");
    expect(fullYear.eligible).toBe(true);
    expect(fullYear.lowConfidence).toBe(false);
  });

  it("getAllHorizonEligibility returns all three horizons keyed correctly", () => {
    const all = getAllHorizonEligibility(100);
    expect(all.month.eligible).toBe(true);
    expect(all.quarter.eligible).toBe(true);
    expect(all.year.eligible).toBe(false);
    expect(all.year.daysNeeded).toBe(80);
  });
});
