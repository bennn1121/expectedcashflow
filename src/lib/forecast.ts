// Pure, dependency-free cash flow forecasting engine.
// No Supabase / DB / UI imports here on purpose — see forecast.test.ts for
// worked examples that double as executable documentation of the algorithm.

export interface RawTransaction {
  date: string; // ISO yyyy-mm-dd
  description: string;
  amount: number; // positive = inflow, negative = outflow
}

export interface RecurringGroup {
  key: string;
  label: string;
  occurrences: number;
  averageAmount: number;
  averageIntervalDays: number;
  lastOccurrence: string; // ISO date
}

export interface WeeklyDataPoint {
  week_start: string; // ISO date
  projected_in: number;
  projected_out: number;
  balance: number;
}

export interface ForecastResult {
  starting_balance: number;
  weekly_data: WeeklyDataPoint[];
  low_point_week: string;
  low_point_balance: number;
  low_point_explanation: string;
}

export interface ForecastOptions {
  /** Injectable "now" so tests are deterministic. Defaults to the real current date. */
  today?: Date;
  minimumBuffer?: number;
  startingBalanceOverride?: number | null;
}

const WEEKS = 13;
const HORIZON_DAYS = WEEKS * 7;
const RECURRING_MIN_OCCURRENCES = 3;
const RECURRING_CV_THRESHOLD = 0.35;
const IRREGULAR_LOOKBACK_WEEKS = 10;

const MS_PER_DAY = 86_400_000;

// ---------- date helpers (UTC-anchored so string dates round-trip exactly) ----------

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// ---------- small stats helpers ----------

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- step 1: normalize + group descriptions ----------

/**
 * Strips per-occurrence noise (order codes, invoice numbers) from a
 * description so repeated payments to the same payee collapse to one key,
 * while one-off purchases with random reference codes still group together
 * for the recurrence test (which then rejects them on interval variance).
 */
export function normalizeDescription(description: string): string {
  let s = description.toUpperCase().trim().replace(/\s+/g, " ");

  // "AMZN MKTP US*2F3" -> "AMZN MKTP US"
  s = s.replace(/[*#][A-Z0-9-]+$/, "").trim();

  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/\d/.test(last) && /[A-Z]/.test(last) && last.length <= 10) {
      tokens.pop();
    }
  }
  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/^\d{4,}$/.test(last)) {
      tokens.pop();
    }
  }

  return tokens.join(" ").trim() || s;
}

interface GroupedTransaction {
  date: Date;
  amount: number;
  description: string;
}

export function detectRecurringGroups(
  transactions: RawTransaction[]
): { recurring: RecurringGroup[]; nonRecurring: RawTransaction[] } {
  const groups = new Map<string, GroupedTransaction[]>();

  for (const t of transactions) {
    const key = normalizeDescription(t.description);
    const list = groups.get(key) ?? [];
    list.push({ date: parseDate(t.date), amount: t.amount, description: t.description });
    groups.set(key, list);
  }

  const recurring: RecurringGroup[] = [];
  const recurringKeys = new Set<string>();

  for (const [key, members] of groups) {
    if (members.length < RECURRING_MIN_OCCURRENCES) continue;

    const sorted = [...members].sort((a, b) => a.date.getTime() - b.date.getTime());
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / MS_PER_DAY);
    }

    const avgInterval = mean(intervals);
    if (avgInterval <= 0) continue;
    const cv = stddev(intervals) / avgInterval;
    if (cv >= RECURRING_CV_THRESHOLD) continue;

    // Label with the most common original description text in the group.
    const counts = new Map<string, number>();
    for (const m of sorted) counts.set(m.description, (counts.get(m.description) ?? 0) + 1);
    const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    recurring.push({
      key,
      label,
      occurrences: sorted.length,
      averageAmount: mean(sorted.map((m) => m.amount)),
      averageIntervalDays: avgInterval,
      lastOccurrence: toISODate(sorted[sorted.length - 1].date),
    });
    recurringKeys.add(key);
  }

  const nonRecurring = transactions.filter((t) => !recurringKeys.has(normalizeDescription(t.description)));

  return { recurring, nonRecurring };
}

// ---------- step 2: project recurring groups forward ----------

interface ProjectedOccurrence {
  date: Date;
  amount: number;
  group: RecurringGroup;
}

function projectGroupForward(group: RecurringGroup, from: Date, horizonEnd: Date): ProjectedOccurrence[] {
  const last = parseDate(group.lastOccurrence);
  const occurrences: ProjectedOccurrence[] = [];

  let n = 1;
  let next = addDays(last, Math.round(group.averageIntervalDays * n));
  // Fast-forward past cycles that fall before the forecast window (e.g. a
  // stale last_occurrence relative to "today").
  while (next < from) {
    n++;
    next = addDays(last, Math.round(group.averageIntervalDays * n));
  }
  while (next <= horizonEnd) {
    occurrences.push({ date: next, amount: group.averageAmount, group });
    n++;
    next = addDays(last, Math.round(group.averageIntervalDays * n));
  }

  return occurrences;
}

// ---------- step 3: irregular baseline ----------

function estimateIrregularBaseline(
  nonRecurring: RawTransaction[],
  from: Date
): { avgWeeklyIn: number; avgWeeklyOut: number } {
  if (nonRecurring.length === 0) return { avgWeeklyIn: 0, avgWeeklyOut: 0 };

  const lookbackDays = IRREGULAR_LOOKBACK_WEEKS * 7;
  let windowEnd = from;
  let windowStart = addDays(from, -lookbackDays);

  let inWindow = nonRecurring.filter((t) => {
    const d = parseDate(t.date);
    return d >= windowStart && d < windowEnd;
  });

  if (inWindow.length === 0) {
    // Data is stale relative to "today" (e.g. testing with an old sample
    // export) — fall back to the most recent window that actually has data.
    const maxDate = nonRecurring.reduce(
      (max, t) => (parseDate(t.date) > max ? parseDate(t.date) : max),
      parseDate(nonRecurring[0].date)
    );
    windowEnd = addDays(maxDate, 1);
    windowStart = addDays(windowEnd, -lookbackDays);
    inWindow = nonRecurring.filter((t) => {
      const d = parseDate(t.date);
      return d >= windowStart && d < windowEnd;
    });
  }

  const totalIn = inWindow.filter((t) => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = inWindow.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    avgWeeklyIn: totalIn / IRREGULAR_LOOKBACK_WEEKS,
    avgWeeklyOut: totalOut / IRREGULAR_LOOKBACK_WEEKS,
  };
}

// ---------- formatting for the plain-English explanation ----------

function formatCurrency(n: number): string {
  const rounded = Math.round(n);
  const formatted = Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatWeekLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildLowPointExplanation(
  lowWeek: WeeklyDataPoint,
  minimumBuffer: number,
  contributors: RecurringGroup[]
): string {
  const balanceStr = formatCurrency(lowWeek.balance);
  const dateStr = formatWeekLabel(lowWeek.week_start);

  if (lowWeek.balance >= minimumBuffer) {
    return `Your balance stays healthy throughout the next 13 weeks — the lowest point is ${balanceStr} in the week of ${dateStr}.`;
  }

  if (contributors.length === 0) {
    return `Your balance is projected to dip to ${balanceStr} in the week of ${dateStr}, based on your typical recurring and day-to-day cash flow.`;
  }

  const describe = (g: RecurringGroup) =>
    `your recurring payment to '${g.label}' (~${formatCurrency(Math.abs(g.averageAmount))}, every ${Math.round(
      g.averageIntervalDays
    )} days)`;

  const clause =
    contributors.length === 1
      ? `${describe(contributors[0])} lands that week`
      : `${describe(contributors[0])} lands the same week as ${describe(contributors[1])}`;

  return `Your balance is projected to dip to ${balanceStr} in the week of ${dateStr}, mainly because ${clause}.`;
}

// ---------- putting it all together ----------

export function runForecast(transactions: RawTransaction[], options: ForecastOptions = {}): ForecastResult {
  const from = startOfDay(options.today ?? new Date());
  const minimumBuffer = options.minimumBuffer ?? 0;
  const horizonEnd = addDays(from, HORIZON_DAYS);

  const historical = transactions.filter((t) => parseDate(t.date) <= from);

  const startingBalance =
    options.startingBalanceOverride ?? historical.reduce((sum, t) => sum + t.amount, 0);

  const { recurring, nonRecurring } = detectRecurringGroups(historical);
  const { avgWeeklyIn, avgWeeklyOut } = estimateIrregularBaseline(nonRecurring, from);

  const projected = recurring.flatMap((g) => projectGroupForward(g, from, horizonEnd));

  const weeklyData: WeeklyDataPoint[] = [];
  let balance = startingBalance;

  for (let i = 0; i < WEEKS; i++) {
    const weekStart = addDays(from, i * 7);
    const weekEnd = addDays(weekStart, 7);

    let recurringIn = 0;
    let recurringOut = 0;
    for (const occ of projected) {
      if (occ.date >= weekStart && occ.date < weekEnd) {
        if (occ.amount >= 0) recurringIn += occ.amount;
        else recurringOut += Math.abs(occ.amount);
      }
    }

    const projected_in = round2(recurringIn + avgWeeklyIn);
    const projected_out = round2(recurringOut + avgWeeklyOut);
    balance = balance + projected_in - projected_out;

    weeklyData.push({
      week_start: toISODate(weekStart),
      projected_in,
      projected_out,
      balance: round2(balance),
    });
  }

  const lowWeek = weeklyData.reduce((min, w) => (w.balance < min.balance ? w : min), weeklyData[0]);

  // Contributors: outflow-type recurring groups with a projection landing in
  // the low week, or in the 3 days just before it, ranked by size.
  const lowWeekStart = parseDate(lowWeek.week_start);
  const lookback = addDays(lowWeekStart, -3);
  const lowWeekEnd = addDays(lowWeekStart, 7);

  const contributingByGroup = new Map<string, number>();
  for (const occ of projected) {
    if (occ.amount < 0 && occ.date >= lookback && occ.date < lowWeekEnd) {
      const current = contributingByGroup.get(occ.group.key) ?? 0;
      if (Math.abs(occ.amount) > Math.abs(current)) {
        contributingByGroup.set(occ.group.key, occ.amount);
      }
    }
  }
  const contributors = recurring
    .filter((g) => contributingByGroup.has(g.key))
    .sort((a, b) => Math.abs(contributingByGroup.get(b.key)!) - Math.abs(contributingByGroup.get(a.key)!))
    .slice(0, 2);

  return {
    starting_balance: round2(startingBalance),
    weekly_data: weeklyData,
    low_point_week: lowWeek.week_start,
    low_point_balance: lowWeek.balance,
    low_point_explanation: buildLowPointExplanation(lowWeek, minimumBuffer, contributors),
  };
}
