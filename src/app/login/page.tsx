import Link from "next/link";
import { authAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "signin";
  const redirectTo = params.redirect ?? "/dashboard";
  const isSignup = mode === "signup";

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Ledgerline</h1>
        <p className="auth-card__subtitle">
          {isSignup ? "Create an account to start forecasting." : "Sign in to your business."}
        </p>

        {params.error && <div className="form-error">{params.error}</div>}

        <form action={authAction} className="stack">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="redirect" value={redirectTo} />

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary">
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-toggle">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href={`/login?mode=signin${redirectTo !== "/dashboard" ? `&redirect=${redirectTo}` : ""}`}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              New to Ledgerline?{" "}
              <Link href={`/login?mode=signup${redirectTo !== "/dashboard" ? `&redirect=${redirectTo}` : ""}`}>
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
