"use client";

import { formatMoney } from "@/lib/currency";
import { useCurrency } from "./CurrencyProvider";

/** Renders a native-currency amount converted into the viewer's chosen display currency. */
export function Money({ amount }: { amount: number }) {
  const { convert, displayCurrency, rateStatus, nativeCurrency } = useCurrency();
  const shown = rateStatus === "error" ? amount : convert(amount);
  const currency = rateStatus === "error" ? nativeCurrency : displayCurrency;
  return <>{formatMoney(shown, currency)}</>;
}
