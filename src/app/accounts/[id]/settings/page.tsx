import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/queries";
import { SettingsContent } from "@/components/SettingsContent";

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

  return <SettingsContent userEmail={user?.email} id={id} account={account} saved={saved} />;
}
