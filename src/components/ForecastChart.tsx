"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ForecastRow } from "@/lib/types";
import { formatMoney } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ForecastChart({
  weeklyData,
  height = 320,
}: {
  weeklyData: ForecastRow["weekly_data"];
  height?: number;
}) {
  const { convert, displayCurrency, rateStatus, nativeCurrency } = useCurrency();
  const currency = rateStatus === "error" ? nativeCurrency : displayCurrency;

  const data = weeklyData.map((w) => ({
    week: formatShortDate(w.week_start),
    in: Math.round(convert(w.projected_in)),
    out: -Math.round(convert(w.projected_out)),
    balance: Math.round(convert(w.balance)),
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--hairline)" vertical={false} />
          <XAxis dataKey="week" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }}
            formatter={(value, name) => [
              formatMoney(Math.abs(Number(value)), currency),
              name === "in" ? "Projected in" : name === "out" ? "Projected out" : "Balance",
            ]}
          />
          <ReferenceLine y={0} stroke="var(--ink-muted)" />
          <Bar dataKey="in" fill="var(--forest)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="out" fill="var(--rust)" radius={[0, 0, 3, 3]} />
          <Line type="monotone" dataKey="balance" stroke="var(--ink)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
