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

/**
 * Fetches a spot exchange rate via our own `/api/exchange-rate` route, which
 * calls the external FX API server-side (avoiding the browser CORS/redirect
 * issues a direct client-side call to it runs into) and caches results for
 * an hour.
 */
export async function fetchExchangeRate(from: string, to: string): Promise<number> {
  const res = await fetch(
    `/api/exchange-rate?from=${encodeURIComponent(from.toUpperCase())}&to=${encodeURIComponent(to.toUpperCase())}`
  );
  if (!res.ok) throw new Error("Exchange rate request failed");
  const data = await res.json();
  if (typeof data?.rate !== "number") throw new Error("Unexpected exchange rate response");
  return data.rate;
}
