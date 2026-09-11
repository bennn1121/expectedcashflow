"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (!email || !password) {
    loginRedirect(mode, redirectTo, "Enter an email and password.");
  }

  const supabase = await createClient();

  if (mode === "signup") {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) loginRedirect(mode, redirectTo, error.message);
    // Supabase may require email confirmation depending on project settings.
    loginRedirect("signin", redirectTo, "Account created — sign in below.");
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) loginRedirect(mode, redirectTo, error.message);
  }

  redirect(redirectTo || "/dashboard");
}
