// Pure, dependency-free cash flow forecasting engine.
// No Supabase / DB / UI imports here on purpose — see forecast.test.ts for
// worked examples that double as executable documentation of the algorithm.

export type Horizon = "month" | "quarter" | "year";
type BucketUnit = "week" | "month";

export const HORIZON_LABELS: Record<Horizon, string> = {
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

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
  week_start: string; // ISO date — bucket start; weekly for month/quarter, monthly for year
  projected_in: number;
  projected_out: number;
  balance: number;
}

export interface ForecastResult {
  horizon: Horizon;
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
  horizon?: Horizon;
}

interface HorizonSpec {
  unit: BucketUnit;
  count: number;
}

// Month uses weekly buckets too (5 weeks ~= a calendar month) so the near-term
// view stays visually consistent with quarter; year switches to monthly
// buckets since 52 weekly points is unreadable.
const HORIZON_SPECS: Record<Horizon, HorizonSpec> = {
  month: { unit: "week", count: 5 },
  quarter: { unit: "week", count: 13 },
  year: { unit: "month", count: 12 },
};

export const HORIZON_MIN_HISTORY_DAYS: Record<Horizon, number> = {
  month: 60,
  quarter: 90,
  year: 180,
};

/** Below this much history, a year forecast hasn't seen a full annual cycle. */
export const YEAR_FULL_CYCLE_DAYS = 365;

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

/** Adds calendar months, clamping the day into the target month (e.g. Jan 31 + 1mo -> Feb 28/29). */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), Math.min(day, daysInTargetMonth))
  );
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
): { avgDailyIn: number; avgDailyOut: number } {
  if (nonRecurring.length === 0) return { avgDailyIn: 0, avgDailyOut: 0 };

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
    avgDailyIn: totalIn / lookbackDays,
    avgDailyOut: totalOut / lookbackDays,
  };
}

// ---------- bucketing per horizon ----------

interface Bucket {
  start: Date;
  end: Date;
}

function bucketBoundaries(from: Date, spec: HorizonSpec): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = 0; i < spec.count; i++) {
    const start = spec.unit === "week" ? addDays(from, i * 7) : addMonthsClamped(from, i);
    const end = spec.unit === "week" ? addDays(start, 7) : addMonthsClamped(from, i + 1);
    buckets.push({ start, end });
  }
  return buckets;
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

function formatMonthLabel(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildLowPointExplanation(
  lowBucket: WeeklyDataPoint,
  minimumBuffer: number,
  contributors: RecurringGroup[],
  horizonPhrase: string,
  periodPhrase: string,
  unitWord: "week" | "month"
): string {
  const balanceStr = formatCurrency(lowBucket.balance);

  if (lowBucket.balance >= minimumBuffer) {
    return `Your balance stays healthy throughout ${horizonPhrase} — the lowest point is ${balanceStr} in ${periodPhrase}.`;
  }

  if (contributors.length === 0) {
    return `Your balance is projected to dip to ${balanceStr} in ${periodPhrase}, based on your typical recurring and day-to-day cash flow.`;
  }

  const describe = (g: RecurringGroup) =>
    `your recurring payment to '${g.label}' (~${formatCurrency(Math.abs(g.averageAmount))}, every ${Math.round(
      g.averageIntervalDays
    )} days)`;

  const clause =
    contributors.length === 1
      ? `${describe(contributors[0])} lands that ${unitWord}`
      : `${describe(contributors[0])} lands the same ${unitWord} as ${describe(contributors[1])}`;

  return `Your balance is projected to dip to ${balanceStr} in ${periodPhrase}, mainly because ${clause}.`;
}

// ---------- minimum history / eligibility gating ----------

export interface HorizonEligibility {
  horizon: Horizon;
  eligible: boolean;
  historyDays: number;
  /** 0 when eligible; otherwise how many more days of history are needed. */
  daysNeeded: number;
  /** True only for an eligible year forecast that hasn't seen a full annual cycle yet. */
  lowConfidence: boolean;
}

/** Days between the earliest and latest ISO date in `transactions`. */
export function getHistoryDays(transactions: RawTransaction[]): number {
  if (transactions.length === 0) return 0;
  let earliest = Infinity;
  let latest = -Infinity;
  for (const t of transactions) {
    const time = parseDate(t.date).getTime();
    if (time < earliest) earliest = time;
    if (time > latest) latest = time;
  }
  return Math.round((latest - earliest) / MS_PER_DAY);
}

/** Days between two ISO dates (order-independent). */
export function daysBetweenIso(a: string, b: string): number {
  return Math.round(Math.abs(parseDate(b).getTime() - parseDate(a).getTime()) / MS_PER_DAY);
}

export function computeHorizonEligibility(historyDays: number, horizon: Horizon): HorizonEligibility {
  const required = HORIZON_MIN_HISTORY_DAYS[horizon];
  const eligible = historyDays >= required;
  return {
    horizon,
    eligible,
    historyDays,
    daysNeeded: eligible ? 0 : required - historyDays,
    lowConfidence: horizon === "year" && eligible && historyDays < YEAR_FULL_CYCLE_DAYS,
  };
}

export function getHorizonEligibility(transactions: RawTransaction[], horizon: Horizon): HorizonEligibility {
  return computeHorizonEligibility(getHistoryDays(transactions), horizon);
}

export function getAllHorizonEligibility(historyDays: number): Record<Horizon, HorizonEligibility> {
  return {
    month: computeHorizonEligibility(historyDays, "month"),
    quarter: computeHorizonEligibility(historyDays, "quarter"),
    year: computeHorizonEligibility(historyDays, "year"),
  };
}

// ---------- putting it all together ----------

export function runForecast(transactions: RawTransaction[], options: ForecastOptions = {}): ForecastResult {
  const horizon = options.horizon ?? "quarter";
  const spec = HORIZON_SPECS[horizon];
  const from = startOfDay(options.today ?? new Date());
  const minimumBuffer = options.minimumBuffer ?? 0;

  const buckets = bucketBoundaries(from, spec);
  const horizonEnd = buckets[buckets.length - 1].end;

  const historical = transactions.filter((t) => parseDate(t.date) <= from);

  const startingBalance =
    options.startingBalanceOverride ?? historical.reduce((sum, t) => sum + t.amount, 0);

  const { recurring, nonRecurring } = detectRecurringGroups(historical);
  const { avgDailyIn, avgDailyOut } = estimateIrregularBaseline(nonRecurring, from);

  const projected = recurring.flatMap((g) => projectGroupForward(g, from, horizonEnd));

  const bucketData: WeeklyDataPoint[] = [];
  let balance = startingBalance;

  for (const { start, end } of buckets) {
    let recurringIn = 0;
    let recurringOut = 0;
    for (const occ of projected) {
      if (occ.date >= start && occ.date < end) {
        if (occ.amount >= 0) recurringIn += occ.amount;
        else recurringOut += Math.abs(occ.amount);
      }
    }

    const bucketDays = (end.getTime() - start.getTime()) / MS_PER_DAY;
    const projected_in = round2(recurringIn + avgDailyIn * bucketDays);
    const projected_out = round2(recurringOut + avgDailyOut * bucketDays);
    balance = balance + projected_in - projected_out;

    bucketData.push({
      week_start: toISODate(start),
      projected_in,
      projected_out,
      balance: round2(balance),
    });
  }

  let lowIndex = 0;
  for (let i = 1; i < bucketData.length; i++) {
    if (bucketData[i].balance < bucketData[lowIndex].balance) lowIndex = i;
  }
  const lowBucket = bucketData[lowIndex];
  const { start: lowBucketStart, end: lowBucketEnd } = buckets[lowIndex];

  // Contributors: outflow-type recurring groups with a projection landing in
  // the low bucket, or in the 3 days just before it, ranked by size.
  const lookback = addDays(lowBucketStart, -3);

  const contributingByGroup = new Map<string, number>();
  for (const occ of projected) {
    if (occ.amount < 0 && occ.date >= lookback && occ.date < lowBucketEnd) {
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

  const unitWord: "week" | "month" = spec.unit === "month" ? "month" : "week";
  const horizonPhrase = spec.unit === "month" ? `the next ${spec.count} months` : `the next ${spec.count} weeks`;
  const periodPhrase =
    spec.unit === "month" ? formatMonthLabel(lowBucket.week_start) : `the week of ${formatWeekLabel(lowBucket.week_start)}`;

  return {
    horizon,
    starting_balance: round2(startingBalance),
    weekly_data: bucketData,
    low_point_week: lowBucket.week_start,
    low_point_balance: lowBucket.balance,
    low_point_explanation: buildLowPointExplanation(
      lowBucket,
      minimumBuffer,
      contributors,
      horizonPhrase,
      periodPhrase,
      unitWord
    ),
  };
}
