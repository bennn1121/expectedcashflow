"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAccount } from "@/lib/queries";

export async function createAccountAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const currency = String(formData.get("currency") ?? "USD").trim() || "USD";

  if (!name) redirect("/dashboard?error=Account name is required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const account = await createAccount(supabase, user.id, { name, currency });
  redirect(`/accounts/${account.id}`);
}
