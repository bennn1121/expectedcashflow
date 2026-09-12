import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAccount,
  listTransactions,
  getMostRecentForecast,
  getTransactionDateRange,
  TRANSACTIONS_PAGE_SIZE,
  type TransactionSort,
} from "@/lib/queries";
import { getAllHorizonEligibility, daysBetweenIso } from "@/lib/forecast";
import { AccountPageContent } from "@/components/AccountPageContent";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sort?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const sort: TransactionSort = sp.sort === "date_asc" ? "date_asc" : "date_desc";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = await getAccount(supabase, id);
  if (!account) notFound();

  const [{ rows: transactions, total }, forecast, dateRange] = await Promise.all([
    listTransactions(supabase, id, { page, sort }),
    getMostRecentForecast(supabase, id),
    getTransactionDateRange(supabase, id),
  ]);

  const historyDays = dateRange ? daysBetweenIso(dateRange.earliest, dateRange.latest) : 0;
  const eligibility = getAllHorizonEligibility(historyDays);
  const totalPages = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));

  return (
    <AccountPageContent
      userEmail={user?.email}
      id={id}
      account={account}
      transactions={transactions}
      total={total}
      page={page}
      sort={sort}
      totalPages={totalPages}
      forecast={forecast}
      eligibility={eligibility}
      error={sp.error}
    />
  );
}
