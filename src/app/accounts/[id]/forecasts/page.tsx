import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount, getLatestForecast, getTransactionDateRange, listForecastHistory } from "@/lib/queries";
import { getAllHorizonEligibility, daysBetweenIso, HORIZON_LABELS, type Horizon } from "@/lib/forecast";
import { AppHeader } from "@/components/AppHeader";
import { ForecastChart } from "@/components/ForecastChart";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { Money } from "@/components/Money";

const ORDER: Horizon[] = ["month", "quarter", "year"];

export default async function ForecastsOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = await getAccount(supabase, id);
  if (!account) notFound();

  const [dateRange, history, month, quarter, year] = await Promise.all([
    getTransactionDateRange(supabase, id),
    listForecastHistory(supabase, id, 25),
    getLatestForecast(supabase, id, "month"),
    getLatestForecast(supabase, id, "quarter"),
    getLatestForecast(supabase, id, "year"),
  ]);

  const forecastsByHorizon = { month, quarter, year };
  const historyDays = dateRange ? daysBetweenIso(dateRange.earliest, dateRange.latest) : 0;
  const eligibility = getAllHorizonEligibility(historyDays);

  return (
    <>
      <AppHeader userEmail={user?.email} />
      <CurrencyProvider nativeCurrency={account.currency}>
        <main className="app-main">
          <div className="wrap stack">
            <div>
              <p className="breadcrumb">
                <Link href="/dashboard">Your businesses</Link> / <Link href={`/accounts/${id}`}>{account.name}</Link> / Forecasts
              </p>
              <div className="page-head">
                <div>
                  <h1>Forecasts</h1>
                  <p className="page-head__meta">Compare the near-term picture against the longer-term one at a glance.</p>
                </div>
              </div>
              <CurrencyToggle />
            </div>

            <div className="forecasts-grid">
              {ORDER.map((h) => {
                const e = eligibility[h];
                const f = forecastsByHorizon[h];

                return (
                  <div key={h} className={`card forecast-card ${!e.eligible ? "forecast-card--empty" : ""}`}>
                    <div className="card__head">
                      <h2>{HORIZON_LABELS[h]}</h2>
                      {e.eligible && e.lowConfidence && <span className="badge badge-warning">Lower confidence</span>}
                    </div>

                    {!e.eligible && (
                      <p className="form-note">
                        Not enough data yet — needs {e.daysNeeded} more day{e.daysNeeded === 1 ? "" : "s"} of transaction
                        history.
                      </p>
                    )}

                    {e.eligible && !f && (
                      <p className="form-note">
                        Not run yet. <Link href={`/accounts/${id}`}>Run a {HORIZON_LABELS[h].toLowerCase()} forecast</Link>{" "}
                        from the account page.
                      </p>
                    )}

                    {e.eligible && f && (
                      <>
                        <ForecastChart weeklyData={f.weekly_data} height={180} />
                        <p className="form-note" style={{ marginTop: 8 }}>
                          Low point: <Money amount={f.low_point_balance ?? 0} />
                        </p>
                        <p style={{ fontSize: "0.9rem" }}>{f.low_point_explanation}</p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="card">
              <div className="card__head">
                <h2>History</h2>
              </div>
              {history.length === 0 ? (
                <p className="form-note">No forecasts have been run yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>Horizon</th>
                        <th>Generated</th>
                        <th>Low point</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((run) => (
                        <tr key={run.id}>
                          <td>{HORIZON_LABELS[run.horizon]}</td>
                          <td>{new Date(run.generated_at).toLocaleString()}</td>
                          <td>{run.low_point_balance !== null ? <Money amount={run.low_point_balance} /> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </CurrencyProvider>
    </>
  );
}
