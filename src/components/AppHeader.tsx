"use client";

import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { useLocale } from "./LocaleProvider";
import { LanguageToggle } from "./LanguageToggle";

export function AppHeader({ userEmail }: { userEmail: string | undefined }) {
  const { t } = useLocale();

  return (
    <header className="app-header">
      <div className="wrap app-header__bar">
        <Link href="/dashboard" className="app-header__brand">
          <span>Ledger</span>line
        </Link>
        <div className="app-header__actions">
          <LanguageToggle />
          {userEmail && <span>{userEmail}</span>}
          <form action={signOutAction}>
            <button type="submit" className="btn btn-secondary">
              {t("signOut")}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
