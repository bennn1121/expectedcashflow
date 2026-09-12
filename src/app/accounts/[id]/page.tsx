import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAccount,
  listTransactions,
  getMostRecentForecast,
  getTransactionDateRange,
  TRANSACTIONS_PAGE_SIZE,
  type TransactionSort,
} from "@/lib/queries";
import { getAllHorizonEligibility, daysBetweenIso, HORIZON_LABELS } from "@/lib/forecast";
import { AppHeader } from "@/components/AppHeader";
import { CsvUpload } from "@/components/CsvUpload";
import { ForecastChart } from "@/components/ForecastChart";
import { HorizonSelector } from "@/components/HorizonSelector";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { Money } from "@/components/Money";
import { runForecastAction } from "./actions";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sort?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const sort: TransactionSort = sp.sort === "date_asc" ? "date_asc" : "date_desc";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = await getAccount(supabase, id);
  if (!account) notFound();

  const [{ rows: transactions, total }, forecast, dateRange] = await Promise.all([
    listTransactions(supabase, id, { page, sort }),
    getMostRecentForecast(supabase, id),
    getTransactionDateRange(supabase, id),
  ]);

  const historyDays = dateRange ? daysBetweenIso(dateRange.earliest, dateRange.latest) : 0;
  const eligibility = getAllHorizonEligibility(historyDays);
  const canRunAnyHorizon = Object.values(eligibility).some((e) => e.eligible);

  const totalPages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));
  const otherSort: TransactionSort = sort === "date_asc" ? "date_desc" : "date_asc";
  const isHealthy = forecast ? (forecast.low_point_balance ?? 0) >= account.minimum_buffer : true;

  return (
    <>
      <AppHeader userEmail={user?.email} />
      <CurrencyProvider nativeCurrency={account.currency}>
        <main className="app-main">
          <div className="wrap stack">
            <div>
              <p className="breadcrumb">
                <Link href="/dashboard">Your businesses</Link> / {account.name}
              </p>
              <div className="page-head">
                <div>
                  <h1>{account.name}</h1>
                  <p className="page-head__meta">
                    {account.currency} · minimum buffer <Money amount={account.minimum_buffer} />
                  </p>
                </div>
                <div className="page-head__actions">
                  <Link href={`/accounts/${id}/forecasts`} className="btn btn-secondary">
                    Forecasts overview
                  </Link>
                  <Link href={`/accounts/${id}/settings`} className="btn btn-secondary">
                    Settings
                  </Link>
                </div>
              </div>
              <CurrencyToggle />
            </div>

            <div className="card">
              <div className="card__head">
                <h2>Upload transactions</h2>
              </div>
              <CsvUpload accountId={id} />
            </div>

            <div className="card">
              <div className="card__head">
                <h2>Forecast</h2>
              </div>

              {sp.error && <div className="form-error">{sp.error}</div>}

              <form action={runForecastAction} className="forecast-controls">
                <input type="hidden" name="accountId" value={id} />
                <HorizonSelector eligibility={eligibility} defaultHorizon={forecast?.horizon ?? "quarter"} />
                <button type="submit" className="btn btn-primary" disabled={total === 0 || !canRunAnyHorizon}>
                  Run forecast
                </button>
              </form>

              {!forecast && <p className="form-note">Run a forecast once you&apos;ve imported some transactions.</p>}

              {forecast && (
                <>
                  <p className="badge badge-neutral" style={{ marginBottom: 12 }}>
                    {HORIZON_LABELS[forecast.horizon]} forecast
                  </p>
                  <ForecastChart weeklyData={forecast.weekly_data} />
                  <div className={`callout ${isHealthy ? "callout-positive" : "callout-warning"}`}>
                    {forecast.low_point_explanation}
                  </div>
                  <p className="form-note" style={{ marginTop: 12 }}>
                    Generated {new Date(forecast.generated_at).toLocaleString()} from a starting balance of{" "}
                    <Money amount={forecast.starting_balance} />.
                  </p>
                </>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <h2>Transactions</h2>
                <span className="page-head__meta">{total} total</span>
              </div>

              {transactions.length === 0 ? (
                <p className="form-note">No transactions yet — upload a CSV above to get started.</p>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="ledger">
                      <thead>
                        <tr>
                          <th>
                            <Link href={`/accounts/${id}?sort=${otherSort}&page=1`}>
                              Date {sort === "date_desc" ? "↓" : "↑"}
                            </Link>
                          </th>
                          <th>Description</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id}>
                            <td>{t.date}</td>
                            <td className="description">{t.description}</td>
                            <td className={t.amount >= 0 ? "amount-positive" : "amount-negative"}>
                              <Money amount={t.amount} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination">
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <div className="pagination__links">
                      {page > 1 && <Link href={`/accounts/${id}?sort=${sort}&page=${page - 1}`}>Previous</Link>}
                      {page < totalPages && <Link href={`/accounts/${id}?sort=${sort}&page=${page + 1}`}>Next</Link>}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </CurrencyProvider>
    </>
  );
}
