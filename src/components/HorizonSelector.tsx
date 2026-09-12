"use client";

import { type Horizon, type HorizonEligibility } from "@/lib/forecast";
import { pluralS, type TranslationKey } from "@/lib/i18n";
import { useLocale } from "./LocaleProvider";

const ORDER: Horizon[] = ["month", "quarter", "year"];
const LABEL_KEYS: Record<Horizon, TranslationKey> = {
  month: "horizonMonth",
  quarter: "horizonQuarter",
  year: "horizonYear",
};

/**
 * Native radio group so horizon selection works without client JS. Ineligible
 * horizons stay visible but disabled, with the exact number of days still needed.
 */
export function HorizonSelector({
  eligibility,
  defaultHorizon,
}: {
  eligibility: Record<Horizon, HorizonEligibility>;
  defaultHorizon: Horizon;
}) {
  const { t, locale } = useLocale();

  return (
    <div className="horizon-selector" role="radiogroup" aria-label="Forecast horizon">
      {ORDER.map((h) => {
        const e = eligibility[h];
        return (
          <label key={h} className={`horizon-option ${!e.eligible ? "is-disabled" : ""}`}>
            <input type="radio" name="horizon" value={h} defaultChecked={h === defaultHorizon} disabled={!e.eligible} />
            <span className="horizon-option__label">{t(LABEL_KEYS[h])}</span>
            {!e.eligible && (
              <span className="horizon-option__hint">
                {t("horizonNeedsMoreDays", { days: e.daysNeeded, plural: pluralS(e.daysNeeded, locale) })}
              </span>
            )}
            {e.eligible && e.lowConfidence && <span className="horizon-option__hint">{t("horizonLowConfidence")}</span>}
          </label>
        );
      })}
    </div>
  );
}
