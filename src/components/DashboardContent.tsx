"use client";

import Link from "next/link";
import type { Account } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { LocaleHiddenInput } from "@/components/LocaleHiddenInput";
import { useLocale } from "@/components/LocaleProvider";
import { createAccountAction } from "@/app/dashboard/actions";

export function DashboardContent({
  userEmail,
  accounts,
  error,
}: {
  userEmail: string | undefined;
  accounts: Account[];
  error?: string;
}) {
  const { t } = useLocale();

  return (
    <>
      <AppHeader userEmail={userEmail} />
      <main className="app-main">
        <div className="wrap stack">
          <div className="page-head">
            <div>
              <h1>{t("yourBusinesses")}</h1>
              <p className="page-head__meta">{t("pickAccountToForecast")}</p>
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="grid-accounts">
              {accounts.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`} className="account-card">
                  <div className="account-card__name">{account.name}</div>
                  <div className="account-card__meta">{account.currency}</div>
                </Link>
              ))}
            </div>
          )}

          <div className="card" style={{ maxWidth: 420 }}>
            <div className="card__head">
              <h2>{t("addABusiness")}</h2>
            </div>
            {error && <div className="form-error">{error}</div>}
            <form action={createAccountAction} className="stack">
              <LocaleHiddenInput />
              <div className="field">
                <label htmlFor="name">{t("businessNameLabel")}</label>
                <input id="name" name="name" type="text" required placeholder="Acme LLC" />
              </div>
              <div className="field">
                <label htmlFor="currency">{t("currencyLabel")}</label>
                <input id="currency" name="currency" type="text" defaultValue="USD" maxLength={3} />
              </div>
              <button type="submit" className="btn btn-primary">
                {t("createAccountButton")}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
