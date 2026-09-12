import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccount, getLatestForecast, getTransactionDateRange, listForecastHistory } from "@/lib/queries";
import { getAllHorizonEligibility, daysBetweenIso } from "@/lib/forecast";
import { ForecastsOverviewContent } from "@/components/ForecastsOverviewContent";

export default async function ForecastsOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const account = await getAccount(supabase, id);
  if (!account) notFound();

  const [dateRange, history, month, quarter, year] = await Promise.all([
    getTransactionDateRange(supabase, id),
    listForecastHistory(supabase, id, 25),
    getLatestForecast(supabase, id, "month"),
    getLatestForecast(supabase, id, "quarter"),
    getLatestForecast(supabase, id, "year"),
  ]);

  const historyDays = dateRange ? daysBetweenIso(dateRange.earliest, dateRange.latest) : 0;
  const eligibility = getAllHorizonEligibility(historyDays);

  return (
    <ForecastsOverviewContent
      userEmail={user?.email}
      id={id}
      account={account}
      eligibility={eligibility}
      forecastsByHorizon={{ month, quarter, year }}
      history={history}
    />
  );
}
