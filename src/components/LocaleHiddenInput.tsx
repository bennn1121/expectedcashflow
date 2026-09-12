"use client";

import { useLocale } from "./LocaleProvider";

/** Lets a form owned by a server component tell its server action which language the viewer has selected. */
export function LocaleHiddenInput() {
  const { locale } = useLocale();
  return <input type="hidden" name="locale" value={locale} />;
}
