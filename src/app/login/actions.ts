"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { translations, parseLocaleFormField } from "@/lib/i18n";

function loginRedirect(mode: string, redirectTo: string, error: string) {
  const url = new URL("/login", "http://localhost");
  url.searchParams.set("mode", mode);
  if (redirectTo && redirectTo !== "/dashboard") url.searchParams.set("redirect", redirectTo);
  url.searchParams.set("error", error);
  redirect(url.pathname + url.search);
}

export async function authAction(formData: FormData) {
  const mode = String(formData.get("mode") ?? "signin");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard");
  const locale = parseLocaleFormField(formData.get("locale"));

  if (!email || !password) {
    loginRedirect(mode, redirectTo, translations[locale].errorEnterEmailPassword);
  }

  const supabase = await createClient();

  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({ email, password });
    // Supabase's own auth error messages are English-only regardless of locale.
    if (error) loginRedirect(mode, redirectTo, error.message);
    loginRedirect("signin", redirectTo, translations[locale].infoAccountCreated);
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) loginRedirect(mode, redirectTo, error.message);
  }

  redirect(redirectTo || "/dashboard");
}
