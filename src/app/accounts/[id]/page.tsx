import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount, listTransactions, getLatestForecast, TRANSACTIONS_PAGE_SIZE, type TransactionSort } from "@/lib/queries";
import { AppHeader } from "@/components/AppHeader";
import { CsvUpload } from "@/components/CsvUpload";
import { ForecastChart } from "@/components/ForecastChart";
import { runForecastAction } from "./actions";

function formatMoney(n: number): string {
  const rounded = Math.round(n);
  const formatted = Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? `-$${formatted}` : `$${formatted}`;
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
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

  const [{ rows: transactions, total }, forecast] = await Promise.all([
    listTransactions(supabase, id, { page, sort }),
    getLatestForecast(supabase, id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));
  const otherSort: TransactionSort = sort === "date_asc" ? "date_desc" : "date_asc";
  const isHealthy = forecast ? (forecast.low_point_balance ?? 0) >= account.minimum_buffer : true;

  return (
    <>
      <AppHeader userEmail={user?.email} />
      <main className="app-main">
        <div className="wrap stack">
          <div>
            <p className="breadcrumb">
              <Link href="/dashboard">Your businesses</Link> / {account.name}
            </p>
            <div className="page-head">
              <div>
                <h1>{account.name}</h1>
                <p className="page-head__meta">{account.currency} · minimum buffer {formatMoney(account.minimum_buffer)}</p>
              </div>
              <Link href={`/accounts/${id}/settings`} className="btn btn-secondary">
                Settings
              </Link>
            </div>
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
              <form action={runForecastAction}>
                <input type="hidden" name="accountId" value={id} />
                <button type="submit" className="btn btn-primary" disabled={total === 0}>
                  Run forecast
                </button>
              </form>
            </div>

            {!forecast && <p className="form-note">Run a forecast once you&apos;ve imported some transactions.</p>}

            {forecast && (
              <>
                <ForecastChart weeklyData={forecast.weekly_data} />
                <div className={`callout ${isHealthy ? "callout-positive" : "callout-warning"}`}>
                  {forecast.low_point_explanation}
                </div>
                <p className="form-note" style={{ marginTop: 12 }}>
                  Generated {new Date(forecast.generated_at).toLocaleString()} from a starting balance of{" "}
                  {formatMoney(forecast.starting_balance)}.
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
                            {formatMoney(t.amount)}
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
    </>
  );
}
