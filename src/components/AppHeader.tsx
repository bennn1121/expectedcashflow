import Link from "next/link";
import { signOutAction } from "@/app/actions";

export function AppHeader({ userEmail }: { userEmail: string | undefined }) {
  return (
    <header className="app-header">
      <div className="wrap app-header__bar">
        <Link href="/dashboard" className="app-header__brand">
          <span>Ledger</span>line
        </Link>
        <div className="app-header__actions">
          {userEmail && <span>{userEmail}</span>}
          <form action={signOutAction}>
            <button type="submit" className="btn btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
