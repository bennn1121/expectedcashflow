"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { interpolate, translations, LOCALE_DIR, type Locale, type TranslationKey } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "ledgerline:locale";

// A tiny external store (module-scoped, one instance app-wide) so reading the
// persisted locale needs no effect: useSyncExternalStore renders "en" for the
// first (server-matching) pass and swaps to the real value right after
// hydration, with no manual setState-in-effect and no mismatch warning.
type Listener = () => void;
const listeners = new Set<Listener>();
let currentLocale: Locale = "en";

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "he";
}

if (typeof window !== "undefined") {
  const stored = window.sessionStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) currentLocale = stored;
}

function subscribe(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Locale {
  return currentLocale;
}

function getServerSnapshot(): Locale {
  return "en";
}

function setStoredLocale(next: Locale): void {
  currentLocale = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // sessionStorage can throw in locked-down environments — the in-memory value still applies for this tab.
  }
  listeners.forEach((listener) => listener());
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_DIR[locale];
  }, [locale]);

  const t = useMemo(
    () =>
      (key: TranslationKey, vars?: Record<string, string | number>) =>
        interpolate(translations[locale][key], vars),
    [locale]
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale: setStoredLocale, t }), [locale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

/** Convenience leaf for translating a text node inside otherwise server-rendered JSX. */
export function T({ k, vars }: { k: TranslationKey; vars?: Record<string, string | number> }) {
  const { t } = useLocale();
  return <>{t(k, vars)}</>;
}
