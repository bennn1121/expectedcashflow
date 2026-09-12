"use client";

import Link from "next/link";
import type { Account } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { LocaleHiddenInput } from "@/components/LocaleHiddenInput";
import { useLocale } from "@/components/LocaleProvider";
import { updateAccountSettingsAction, deleteAccountAction } from "@/app/accounts/[id]/actions";

export function SettingsContent({
  userEmail,
  id,
  account,
  saved,
}: {
  userEmail: string | undefined;
  id: string;
  account: Account;
  saved?: string;
}) {
  const { t } = useLocale();

  return (
    <>
      <AppHeader userEmail={userEmail} />
      <main className="app-main">
        <div className="wrap stack">
          <div>
            <p className="breadcrumb">
              <Link href="/dashboard">{t("yourBusinesses")}</Link> / <Link href={`/accounts/${id}`}>{account.name}</Link> /{" "}
              {t("settingsBreadcrumb")}
            </p>
            <h1>{t("accountSettingsHeading")}</h1>
          </div>

          <div className="card" style={{ maxWidth: 480 }}>
            {saved && (
              <div
                className="form-error"
                style={{ background: "rgba(47,158,110,0.09)", borderColor: "rgba(47,158,110,0.35)", color: "var(--forest-ink)" }}
              >
                {t("settingsSaved")}
              </div>
            )}

            <form action={updateAccountSettingsAction} className="stack">
              <input type="hidden" name="accountId" value={id} />
              <LocaleHiddenInput />

              <div className="field">
                <label htmlFor="name">{t("businessNameLabel")}</label>
                <input id="name" name="name" type="text" defaultValue={account.name} required />
              </div>

              <div className="field">
                <label htmlFor="minimum_buffer">{t("minimumBufferLabel")}</label>
                <input id="minimum_buffer" name="minimum_buffer" type="number" step="0.01" defaultValue={account.minimum_buffer} />
                <p className="form-note" style={{ margin: 0 }}>
                  {t("minimumBufferHelp")}
                </p>
              </div>

              <div className="field">
                <label htmlFor="starting_balance_override">{t("startingBalanceOverrideLabel")}</label>
                <input
                  id="starting_balance_override"
                  name="starting_balance_override"
                  type="number"
                  step="0.01"
                  defaultValue={account.starting_balance_override ?? ""}
                  placeholder={t("startingBalanceOverridePlaceholder")}
                />
              </div>

              <button type="submit" className="btn btn-primary">
                {t("saveChangesButton")}
              </button>
            </form>
          </div>

          <div className="card" style={{ maxWidth: 480, borderColor: "rgba(163,64,44,0.35)" }}>
            <div className="card__head">
              <h2>{t("dangerZoneHeading")}</h2>
            </div>
            <p className="form-note">{t("dangerZoneBody")}</p>
            <form action={deleteAccountAction}>
              <input type="hidden" name="accountId" value={id} />
              <button type="submit" className="btn btn-danger">
                {t("deleteAccountButton")}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
