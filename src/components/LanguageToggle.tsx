"use client";

import { useLocale } from "./LocaleProvider";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "he", label: "עברית" },
];

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="segmented" role="group" aria-label="Language / שפה">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segmented__option ${locale === o.value ? "is-active" : ""}`}
          onClick={() => setLocale(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
