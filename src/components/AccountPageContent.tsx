"use client";

import Link from "next/link";
import type { Account, TransactionRow, ForecastRow } from "@/lib/types";
import type { Horizon, HorizonEligibility } from "@/lib/forecast";
import type { TransactionSort } from "@/lib/queries";
import type { TranslationKey } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { CsvUpload } from "@/components/CsvUpload";
import { ExcelUpload } from "@/components/ExcelUpload";
import { ForecastChart } from "@/components/ForecastChart";
import { HorizonSelector } from "@/components/HorizonSelector";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { Money } from "@/components/Money";
import { LocaleHiddenInput } from "@/components/LocaleHiddenInput";
import { useLocale } from "@/components/LocaleProvider";
import { runForecastAction } from "@/app/accounts/[id]/actions";

const HORIZON_LABEL_KEYS: Record<Horizon, TranslationKey> = {
  month: "horizonMonth",
  quarter: "horizonQuarter",
  year: "horizonYear",
};

export function AccountPageContent({
  userEmail,
  id,
  account,
  transactions,
  total,
  page,
  sort,
  totalPages,
  forecast,
  eligibility,
  error,
}: {
  userEmail: string | undefined;
  id: string;
  account: Account;
  transactions: TransactionRow[];
  total: number;
  page: number;
  sort: TransactionSort;
  totalPages: number;
  forecast: ForecastRow | null;
  eligibility: Record<Horizon, HorizonEligibility>;
  error?: string;
}) {
  const { t, locale } = useLocale();
  const otherSort: TransactionSort = sort === "date_asc" ? "date_desc" : "date_asc";
  const isHealthy = forecast ? (forecast.low_point_balance ?? 0) >= account.minimum_buffer : true;
  const canRunAnyHorizon = Object.values(eligibility).some((e) => e.eligible);

  return (
    <>
      <AppHeader userEmail={userEmail} />
      <CurrencyProvider nativeCurrency={account.currency}>
        <main className="app-main">
          <div className="wrap stack">
            <div>
              <p className="breadcrumb">
                <Link href="/dashboard">{t("yourBusinesses")}</Link> / {account.name}
              </p>
              <div className="page-head">
                <div>
                  <h1>{account.name}</h1>
                  <p className="page-head__meta">
                    {account.currency} · {t("minimumBufferMeta")} <Money amount={account.minimum_buffer} />
                  </p>
                </div>
                <div className="page-head__actions">
                  <a href={`/api/accounts/${id}/export`} className="btn btn-secondary">
                    {t("exportToExcel")}
                  </a>
                  <Link href={`/accounts/${id}/forecasts`} className="btn btn-secondary">
                    {t("forecastsOverviewButton")}
                  </Link>
                  <Link href={`/accounts/${id}/settings`} className="btn btn-secondary">
                    {t("settingsButton")}
                  </Link>
                </div>
              </div>
              <CurrencyToggle />
            </div>

            <div className="card">
              <div className="card__head">
                <h2>{t("uploadTransactionsHeading")}</h2>
              </div>
              <div className="stack">
                <div>
                  <h3 className="upload-subheading">{t("csvImportHeading")}</h3>
                  <CsvUpload accountId={id} />
                </div>
                <div>
                  <h3 className="upload-subheading">{t("excelImportHeading")}</h3>
                  <ExcelUpload accountId={id} />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <h2>{t("forecastHeading")}</h2>
              </div>

              {error && <div className="form-error">{error}</div>}

              <form action={runForecastAction} className="forecast-controls">
                <input type="hidden" name="accountId" value={id} />
                <LocaleHiddenInput />
                <HorizonSelector eligibility={eligibility} defaultHorizon={forecast?.horizon ?? "quarter"} />
                <button type="submit" className="btn btn-primary" disabled={total === 0 || !canRunAnyHorizon}>
                  {t("runForecastButton")}
                </button>
              </form>

              {!forecast && <p className="form-note">{t("runForecastHint")}</p>}

              {forecast && (
                <>
                  <p className="badge badge-neutral" style={{ marginBottom: 12 }}>
                    {t(HORIZON_LABEL_KEYS[forecast.horizon])} {t("forecastBadgeSuffix")}
                  </p>
                  <ForecastChart weeklyData={forecast.weekly_data} />
                  <div className={`callout ${isHealthy ? "callout-positive" : "callout-warning"}`}>
                    {forecast.low_point_explanation}
                  </div>
                  <p className="form-note" style={{ marginTop: 12 }}>
                    {t("generatedFromStartingBalance", {
                      date: new Date(forecast.generated_at).toLocaleString(locale === "he" ? "he" : "en-US"),
                    })}{" "}
                    <Money amount={forecast.starting_balance} />.
                  </p>
                </>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <h2>{t("transactionsHeading")}</h2>
                <span className="page-head__meta">
                  {total} {t("totalSuffix")}
                </span>
              </div>

              {transactions.length === 0 ? (
                <p className="form-note">{t("noTransactionsYet")}</p>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="ledger">
                      <thead>
                        <tr>
                          <th>
                            <Link href={`/accounts/${id}?sort=${otherSort}&page=1`}>
                              {t("dateColumn")} {sort === "date_desc" ? "↓" : "↑"}
                            </Link>
                          </th>
                          <th>{t("descriptionColumn")}</th>
                          <th>{t("amountColumn")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td>{tx.date}</td>
                            <td className="description">{tx.description}</td>
                            <td className={tx.amount >= 0 ? "amount-positive" : "amount-negative"}>
                              <Money amount={tx.amount} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pagination">
                    <span>{t("pageOf", { page, total: totalPages })}</span>
                    <div className="pagination__links">
                      {page > 1 && (
                        <Link href={`/accounts/${id}?sort=${sort}&page=${page - 1}`}>{t("previous")}</Link>
                      )}
                      {page < totalPages && (
                        <Link href={`/accounts/${id}?sort=${sort}&page=${page + 1}`}>{t("next")}</Link>
                      )}
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
