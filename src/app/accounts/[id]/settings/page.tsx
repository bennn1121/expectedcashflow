import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/queries";
import { AppHeader } from "@/components/AppHeader";
import { updateAccountSettingsAction, deleteAccountAction } from "../actions";

export default async function AccountSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = await getAccount(supabase, id);
  if (!account) notFound();

  return (
    <>
      <AppHeader userEmail={user?.email} />
      <main className="app-main">
        <div className="wrap stack">
          <div>
            <p className="breadcrumb">
              <Link href="/dashboard">Your businesses</Link> / <Link href={`/accounts/${id}`}>{account.name}</Link> / Settings
            </p>
            <h1>Account settings</h1>
          </div>

          <div className="card" style={{ maxWidth: 480 }}>
            {saved && <div className="form-error" style={{ background: "rgba(47,158,110,0.09)", borderColor: "rgba(47,158,110,0.35)", color: "var(--forest-ink)" }}>Settings saved.</div>}

            <form action={updateAccountSettingsAction} className="stack">
              <input type="hidden" name="accountId" value={id} />

              <div className="field">
                <label htmlFor="name">Business name</label>
                <input id="name" name="name" type="text" defaultValue={account.name} required />
              </div>

              <div className="field">
                <label htmlFor="minimum_buffer">Minimum buffer</label>
                <input
                  id="minimum_buffer"
                  name="minimum_buffer"
                  type="number"
                  step="0.01"
                  defaultValue={account.minimum_buffer}
                />
                <p className="form-note" style={{ margin: 0 }}>
                  The forecast flags any week that dips below this balance.
                </p>
              </div>

              <div className="field">
                <label htmlFor="starting_balance_override">Starting balance override</label>
                <input
                  id="starting_balance_override"
                  name="starting_balance_override"
                  type="number"
                  step="0.01"
                  defaultValue={account.starting_balance_override ?? ""}
                  placeholder="Uses sum of transaction history if left blank"
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Save changes
              </button>
            </form>
          </div>

          <div className="card" style={{ maxWidth: 480, borderColor: "rgba(163,64,44,0.35)" }}>
            <div className="card__head">
              <h2>Danger zone</h2>
            </div>
            <p className="form-note">
              Deleting this account permanently removes its transactions and forecasts.
            </p>
            <form action={deleteAccountAction}>
              <input type="hidden" name="accountId" value={id} />
              <button type="submit" className="btn btn-danger">
                Delete account
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
