"use client";

import Link from "next/link";
import type { Account, ForecastRow } from "@/lib/types";
import type { ForecastHistoryEntry } from "@/lib/queries";
import { type Horizon, type HorizonEligibility } from "@/lib/forecast";
import { pluralS, type TranslationKey } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { ForecastChart } from "@/components/ForecastChart";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { Money } from "@/components/Money";
import { useLocale } from "@/components/LocaleProvider";

const ORDER: Horizon[] = ["month", "quarter", "year"];
const HORIZON_LABEL_KEYS: Record<Horizon, TranslationKey> = {
  month: "horizonMonth",
  quarter: "horizonQuarter",
  year: "horizonYear",
};

export function ForecastsOverviewContent({
  userEmail,
  id,
  account,
  eligibility,
  forecastsByHorizon,
  history,
}: {
  userEmail: string | undefined;
  id: string;
  account: Account;
  eligibility: Record<Horizon, HorizonEligibility>;
  forecastsByHorizon: Record<Horizon, ForecastRow | null>;
  history: ForecastHistoryEntry[];
}) {
  const { t, locale } = useLocale();

  return (
    <>
      <AppHeader userEmail={userEmail} />
      <CurrencyProvider nativeCurrency={account.currency}>
        <main className="app-main">
          <div className="wrap stack">
            <div>
              <p className="breadcrumb">
                <Link href="/dashboard">{t("yourBusinesses")}</Link> / <Link href={`/accounts/${id}`}>{account.name}</Link> /{" "}
                {t("forecastsBreadcrumb")}
              </p>
              <div className="page-head">
                <div>
                  <h1>{t("forecastsHeading")}</h1>
                  <p className="page-head__meta">{t("forecastsSubtitle")}</p>
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
                      <h2>{t(HORIZON_LABEL_KEYS[h])}</h2>
                      {e.eligible && e.lowConfidence && <span className="badge badge-warning">{t("lowerConfidenceBadge")}</span>}
                    </div>

                    {!e.eligible && (
                      <p className="form-note">
                        {t("notEnoughDataYet", { days: e.daysNeeded, plural: pluralS(e.daysNeeded, locale) })}
                      </p>
                    )}

                    {e.eligible && !f && (
                      <p className="form-note">
                        {t("notRunYetPrefix")} <Link href={`/accounts/${id}`}>{t("runAForecastLink", { horizon: t(HORIZON_LABEL_KEYS[h]).toLowerCase() })}</Link>{" "}
                        {t("fromTheAccountPage")}
                      </p>
                    )}

                    {e.eligible && f && (
                      <>
                        <ForecastChart weeklyData={f.weekly_data} height={180} />
                        <p className="form-note" style={{ marginTop: 8 }}>
                          {t("lowPointLabel")} <Money amount={f.low_point_balance ?? 0} />
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
                <h2>{t("historyHeading")}</h2>
              </div>
              {history.length === 0 ? (
                <p className="form-note">{t("noForecastsYet")}</p>
              ) : (
                <div className="table-scroll">
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>{t("horizonColumn")}</th>
                        <th>{t("generatedColumn")}</th>
                        <th>{t("lowPointColumn")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((run) => (
                        <tr key={run.id}>
                          <td>{t(HORIZON_LABEL_KEYS[run.horizon])}</td>
                          <td>{new Date(run.generated_at).toLocaleString(locale === "he" ? "he" : "en-US")}</td>
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
