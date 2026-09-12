"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchExchangeRate, type DisplayCurrency } from "@/lib/currency";

type RateStatus = "loading" | "ok" | "error";

interface CurrencyContextValue {
  nativeCurrency: string;
  displayCurrency: DisplayCurrency;
  setDisplayCurrency: (c: DisplayCurrency) => void;
  rate: number | null;
  rateStatus: RateStatus;
  /** Converts a native-currency amount to the current display currency. Falls back to the raw amount if the rate isn't available. */
  convert: (amount: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// Module-level cache so navigating between pages in the same tab doesn't
// re-fetch a rate we already have; sessionStorage backs it across reloads.
const rateCache = new Map<string, number>();

function cacheKey(from: string, to: string): string {
  return `${from.toUpperCase()}_${to.toUpperCase()}`;
}

function readCachedRate(key: string): number | null {
  if (rateCache.has(key)) return rateCache.get(key)!;
  if (typeof window === "undefined") return null;
  const stored = window.sessionStorage.getItem(`ledgerline:fx:${key}`);
  if (stored === null) return null;
  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) return null;
  rateCache.set(key, parsed);
  return parsed;
}

function writeCachedRate(key: string, rate: number): void {
  rateCache.set(key, rate);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`ledgerline:fx:${key}`, String(rate));
  } catch {
    // sessionStorage can throw in locked-down environments — the in-memory cache still works.
  }
}

export function CurrencyProvider({
  nativeCurrency,
  children,
}: {
  nativeCurrency: string;
  children: React.ReactNode;
}) {
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(
    nativeCurrency.toUpperCase() === "ILS" ? "ILS" : "USD"
  );
  // Fetch outcomes are tagged with the pair they answer, so switching pairs
  // never needs an explicit "reset" setState call — a stale-keyed result is
  // simply ignored below rather than cleared.
  const [fetchedRate, setFetchedRate] = useState<{ key: string; rate: number } | null>(null);
  const [erroredKey, setErroredKey] = useState<string | null>(null);

  // Same currency needs no conversion — derive it instead of round-tripping through an effect.
  const sameCurrency = nativeCurrency.toUpperCase() === displayCurrency;
  const pairKey = sameCurrency ? null : cacheKey(nativeCurrency, displayCurrency);

  // Reading the cache is a synchronous, render-safe lookup (guarded for SSR) —
  // no effect needed just to mirror it into state.
  const cachedRate = useMemo(() => (pairKey ? readCachedRate(pairKey) : null), [pairKey]);

  useEffect(() => {
    if (pairKey === null || cachedRate !== null) return;

    let cancelled = false;
    fetchExchangeRate(nativeCurrency, displayCurrency)
      .then((fetched) => {
        if (cancelled) return;
        writeCachedRate(pairKey, fetched);
        setFetchedRate({ key: pairKey, rate: fetched });
      })
      .catch(() => {
        if (cancelled) return;
        setErroredKey(pairKey);
      });

    return () => {
      cancelled = true;
    };
  }, [pairKey, cachedRate, nativeCurrency, displayCurrency]);

  const fetchedForPair = fetchedRate && fetchedRate.key === pairKey ? fetchedRate.rate : null;
  const erroredForPair = erroredKey === pairKey;

  const rate = sameCurrency ? 1 : (cachedRate ?? fetchedForPair);
  const rateStatus: RateStatus = sameCurrency || cachedRate !== null || fetchedForPair !== null
    ? "ok"
    : erroredForPair
      ? "error"
      : "loading";

  const convert = useCallback(
    (amount: number) => {
      if (rateStatus === "ok" && rate !== null) return amount * rate;
      return amount;
    },
    [rate, rateStatus]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({ nativeCurrency, displayCurrency, setDisplayCurrency, rate, rateStatus, convert }),
    [nativeCurrency, displayCurrency, rate, rateStatus, convert]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}
