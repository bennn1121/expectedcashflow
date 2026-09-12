# Ledgerline

A cash flow forecasting tool: sign in, create a business, upload a CSV of bank
transactions, and get a month/quarter/year forecast with a plain-English
explanation of the low point.

## Setup

1. **Apply the database migrations.** This project's Supabase publishable key
   can't run DDL, so the schema has to be applied by hand:
   - Open the SQL Editor for the project at
     https://supabase.com/dashboard/project/qqpiahsovponzwmapkcp/sql/new
   - Paste in the contents of `supabase/migrations/0001_init.sql` and run it.
     This creates `accounts`, `transactions`, and `forecasts` with RLS
     policies scoping every row to `auth.uid()`.
   - Then paste in `supabase/migrations/0002_forecast_horizons.sql` and run
     it. This adds the `horizon` column (`'month' | 'quarter' | 'year'`,
     defaulting to `'quarter'`) that records which horizon each forecast run
     used — existing rows backfill to `'quarter'` automatically.
   - Then paste in `supabase/migrations/0003_apply_excel_import.sql` and run
     it. This adds the `apply_excel_import` Postgres function the Excel
     re-import flow calls via `supabase.rpc(...)` to commit an import as one
     atomic transaction. It runs `security invoker`, so the existing RLS
     policies still apply exactly as if the caller ran the statements
     directly. **Note:** I wrote and reviewed this SQL carefully but, same as
     the other migrations, couldn't execute it against a live database in
     this environment — please sanity-check an import once after applying it.
2. `.env.local` is already populated with the project URL and publishable key.
3. `npm install` (already done if you're reading this from the built repo).
4. `npm run dev` and open http://localhost:3000 — unauthenticated requests
   redirect to `/login`.

No new environment variables were added. One new dependency: `xlsx` (SheetJS),
for the Excel export/import feature — see the note under Architecture below
about where it's installed from. The currency toggle needs no key; it goes
through our own `/api/exchange-rate` route to the free Frankfurter API.

## Testing the forecast engine

```bash
npm test
```

Runs the vitest suite in `src/lib/forecast.test.ts` and `src/lib/csv.test.ts`,
including worked examples with a known recurring payroll + vendor payment
that collide to produce a checkable low-point explanation.

## Trying it end-to-end

`sample-data/ledgerline-sample-transactions.csv` has nine months of synthetic
history (Jan–Sep 2026): monthly payroll (-$8,200), a vendor payment every 30
days (-$3,050), monthly rent (-$2,500), a 30-day hosting subscription
(-$180), irregular customer payments, misc one-off expenses, and a few
Amazon-style purchases with random reference codes (to confirm those don't
get misclassified as recurring). It's timed so the next payroll and vendor
payment land in the same week just after the data ends.

1. Sign up at `/login`, create a business from `/dashboard`.
2. On `/accounts/[id]/settings`, set **Starting balance override** to `15000`
   (the raw historical net in the sample data is negative, so leaving this
   blank starts the forecast from an unrealistic base) — this is also where
   **Minimum buffer** is set.
3. On the account page, upload the sample CSV, confirm the column mapping,
   then **Run forecast**.

## Architecture notes

- `src/lib/forecast.ts` — the forecasting engine. Pure functions, no
  DB/UI imports, so it's independently testable. Supports three horizons:
  - **Month** — weekly buckets, 5 weeks out.
  - **Quarter** — weekly buckets, 13 weeks out (the original behavior,
    unchanged and still the default).
  - **Year** — monthly buckets, 12 months out; the same recurring-detection
    and irregular-baseline logic is just aggregated into monthly totals
    instead of weekly ones.

  Each horizon is gated on how much transaction history the account has
  (`getAllHorizonEligibility` / `computeHorizonEligibility`): 60 days for
  month, 90 for quarter, 180 for year. A year forecast with less than 365
  days of history is still allowed to run, but is flagged `lowConfidence`
  since it hasn't seen a full annual cycle yet. The account page's horizon
  selector reads this to grey out and explain ineligible options, and
  `runForecastAction` re-checks it server-side before saving.
- `src/lib/csv.ts` — CSV column detection and row cleaning, also pure.
- `src/lib/currency.ts` — pure money formatting + the Frankfurter API call
  used by the display-currency toggle. Conversion only ever changes what's
  *rendered*; stored transaction/forecast amounts always stay in the
  account's real currency.
- `src/lib/queries.ts` — the only place that talks to Supabase tables.
- `src/lib/supabase/{client,server}.ts` — browser vs. server Supabase
  clients (`@supabase/ssr`).
- `src/proxy.ts` — session refresh + route protection. Next.js 16 renamed
  `middleware.ts` to `proxy.ts`; behavior is otherwise unchanged.
- Mutations are Server Actions (`actions.ts` beside each route), not API
  routes — forms work without client JS where the flow allows it (sign
  in/up, create/update/delete account, run forecast — including the horizon
  radio group, which is plain HTML); the CSV upload is a client component
  because it needs to parse and preview before committing.
- `/accounts/[id]/forecasts` — the forecasts overview: month/quarter/year
  side by side (each showing its own chart, low point, and explanation, or
  a "not enough data yet" state when ineligible), plus a history table of
  every past forecast run across all horizons.
- `src/components/CurrencyProvider.tsx` + `CurrencyToggle.tsx` + `Money.tsx`
  — a small client-side context that converts amounts for display, and
  falls back to the native currency with a notice if the rate fetch fails.
  It calls `src/app/api/exchange-rate/route.ts`, a server-side route that
  hits the external FX API and caches each currency pair for an hour —
  the client never calls the external API directly, since `api.frankfurter.app`
  redirects to `api.frankfurter.dev` with no CORS headers on the redirect
  itself, which breaks a direct browser `fetch`. That route is excluded
  from the auth gate in `src/proxy.ts` since it's public, unauthenticated data.
- `src/lib/i18n.ts` + `src/components/LocaleProvider.tsx` (+ `LanguageToggle.tsx`,
  `LocaleHiddenInput.tsx`) — English/Hebrew UI text via a plain
  `{key: string}` dictionary (no i18n library), a client context persisted
  per tab in `sessionStorage`, and a `dir`/`lang` sync onto `<html>` so
  Hebrew renders RTL. Because the chosen language is a client-only,
  per-session value with no server-side record of it, every page's visible
  text lives in a client component (`*Content.tsx` beside most pages) that
  reads the context directly — a plain server-rendered string could never
  react to a later client-side language change without a full reload.
  `LocaleHiddenInput` bridges the one remaining gap: the handful of
  messages a Server Action itself generates (a login error, "needs N more
  days of history") read the submitting form's hidden `locale` field so
  those come back in the right language too. The generated low-point
  forecast sentence has its own from-scratch Hebrew phrasing in
  `lib/forecast.ts` (not a machine translation of the English one) — see
  `buildLowPointExplanationHe`.
- **Excel export/import** (`src/lib/excel.ts`, `src/app/api/accounts/[id]/export/route.ts`,
  `src/components/ExcelUpload.tsx`): exports a `.xlsx` workbook (Transactions,
  Monthly Summary, Recurring Patterns, Forecast History, Account Info) and
  re-imports the two editable sheets (Transactions, Account Info) with a
  preview-before-commit diff, mirroring the CSV upload's pattern. `lib/excel.ts`
  holds the pure parse/diff logic (no `xlsx` or Supabase imports, so it's
  independently testable — see `excel.test.ts`); the API route and
  `ExcelUpload` component are the only places that touch actual `.xlsx`
  bytes. The `xlsx` package is installed from SheetJS's own CDN
  (`https://cdn.sheetjs.com/xlsx-0.20.3/...`), **not** the `xlsx` package on
  the public npm registry — that registry version is stuck on 0.18.5, which
  has two unpatched advisories (prototype pollution, ReDoS); SheetJS stopped
  publishing fixes there and now distributes patched releases only from
  their own CDN. `npm audit` is clean with this install.
  Known limitation: bold header rows and frozen header rows are SheetJS
  **Pro** features, not available when writing with the free/Community
  Edition library used here — the export still gets column widths and
  proper date/currency number formats, just not those two visual touches.
