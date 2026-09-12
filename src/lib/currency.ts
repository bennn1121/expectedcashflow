// Pure currency helpers shared between server-rendered and client components.
// Conversion is purely a display concern — nothing here ever touches stored
// transaction/forecast amounts, which always stay in the account's own currency.

export type DisplayCurrency = "USD" | "ILS";

export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount);
  const code = currency.toUpperCase();
  const symbol = code === "ILS" ? "₪" : code === "USD" ? "$" : `${code} `;
  const formatted = Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

/** Fetches a spot exchange rate from the free, no-key Frankfurter API. */
export async function fetchExchangeRate(from: string, to: string): Promise<number> {
  const res = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(from.toUpperCase())}&to=${encodeURIComponent(to.toUpperCase())}`
  );
  if (!res.ok) throw new Error("Exchange rate request failed");
  const data = await res.json();
  const rate = data?.rates?.[to.toUpperCase()];
  if (typeof rate !== "number") throw new Error("Unexpected exchange rate response");
  return rate;
}
