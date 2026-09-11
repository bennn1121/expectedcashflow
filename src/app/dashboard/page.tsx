import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listAccounts } from "@/lib/queries";
import { AppHeader } from "@/components/AppHeader";
import { createAccountAction } from "./actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accounts = await listAccounts(supabase);

  return (
    <>
      <AppHeader userEmail={user?.email} />
      <main className="app-main">
        <div className="wrap stack">
          <div className="page-head">
            <div>
              <h1>Your businesses</h1>
              <p className="page-head__meta">Pick an account to import transactions and run a forecast.</p>
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
              <h2>Add a business</h2>
            </div>
            {error && <div className="form-error">{error}</div>}
            <form action={createAccountAction} className="stack">
              <div className="field">
                <label htmlFor="name">Business name</label>
                <input id="name" name="name" type="text" required placeholder="Acme LLC" />
              </div>
              <div className="field">
                <label htmlFor="currency">Currency</label>
                <input id="currency" name="currency" type="text" defaultValue="USD" maxLength={3} />
              </div>
              <button type="submit" className="btn btn-primary">
                Create account
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
