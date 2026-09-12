import { createClient } from "@/lib/supabase/server";
import { listAccounts } from "@/lib/queries";
import { DashboardContent } from "@/components/DashboardContent";

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

  return <DashboardContent userEmail={user?.email} accounts={accounts} error={error} />;
}
