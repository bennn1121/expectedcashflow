import Link from "next/link";
import { authAction } from "./actions";
import { T } from "@/components/LocaleProvider";
import { LocaleHiddenInput } from "@/components/LocaleHiddenInput";
import { LanguageToggle } from "@/components/LanguageToggle";

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
        <div className="auth-card__top">
          <h1>Ledgerline</h1>
          <LanguageToggle />
        </div>
        <p className="auth-card__subtitle">
          <T k={isSignup ? "loginSubtitleSignup" : "loginSubtitleSignin"} />
        </p>

        {params.error && <div className="form-error">{params.error}</div>}

        <form action={authAction} className="stack">
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="redirect" value={redirectTo} />
          <LocaleHiddenInput />

          <div className="field">
            <label htmlFor="email">
              <T k="emailLabel" />
            </label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">
              <T k="passwordLabel" />
            </label>
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
            <T k={isSignup ? "createAccountButton" : "signInButton"} />
          </button>
        </form>

        <p className="auth-toggle">
          {isSignup ? (
            <>
              <T k="alreadyHaveAccount" />{" "}
              <Link href={`/login?mode=signin${redirectTo !== "/dashboard" ? `&redirect=${redirectTo}` : ""}`}>
                <T k="signInLink" />
              </Link>
            </>
          ) : (
            <>
              <T k="newToLedgerline" />{" "}
              <Link href={`/login?mode=signup${redirectTo !== "/dashboard" ? `&redirect=${redirectTo}` : ""}`}>
                <T k="createAccountLink" />
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
