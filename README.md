# Ledgerline

A cash flow forecasting tool: sign in, create a business, upload a CSV of bank
transactions, and get a 13-week forecast with a plain-English explanation of
the low point.

## Setup

1. **Apply the database migration.** This project's Supabase publishable key
   can't run DDL, so the schema has to be applied by hand once:
   - Open the SQL Editor for the project at
     https://supabase.com/dashboard/project/qqpiahsovponzwmapkcp/sql/new
   - Paste in the contents of `supabase/migrations/0001_init.sql` and run it.
   - This creates `accounts`, `transactions`, and `forecasts` with RLS
     policies scoping every row to `auth.uid()`.
2. `.env.local` is already populated with the project URL and publishable key.
3. `npm install` (already done if you're reading this from the built repo).
4. `npm run dev` and open http://localhost:3000 — unauthenticated requests
   redirect to `/login`.

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
  DB/UI imports, so it's independently testable.
- `src/lib/csv.ts` — CSV column detection and row cleaning, also pure.
- `src/lib/queries.ts` — the only place that talks to Supabase tables.
- `src/lib/supabase/{client,server}.ts` — browser vs. server Supabase
  clients (`@supabase/ssr`).
- `src/proxy.ts` — session refresh + route protection. Next.js 16 renamed
  `middleware.ts` to `proxy.ts`; behavior is otherwise unchanged.
- Mutations are Server Actions (`actions.ts` beside each route), not API
  routes — forms work without client JS where the flow allows it (sign
  in/up, create/update/delete account, run forecast); the CSV upload is a
  client component because it needs to parse and preview before committing.
