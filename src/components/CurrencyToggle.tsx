"use client";

import { useCurrency } from "./CurrencyProvider";
import { useLocale } from "./LocaleProvider";

const OPTIONS = ["USD", "ILS"] as const;

export function CurrencyToggle() {
  const { displayCurrency, setDisplayCurrency, rate, rateStatus, nativeCurrency } = useCurrency();
  const { t } = useLocale();
  const isConverting = nativeCurrency.toUpperCase() !== displayCurrency;

  return (
    <div className="currency-toggle">
      <div className="segmented" role="group" aria-label="Display currency">
        {OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            className={`segmented__option ${displayCurrency === c ? "is-active" : ""}`}
            onClick={() => setDisplayCurrency(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {isConverting && rateStatus === "loading" && <span className="currency-toggle__note">{t("fetchingRate")}</span>}
      {isConverting && rateStatus === "ok" && rate !== null && (
        <span className="currency-toggle__note">
          {t("rateNote", { from: nativeCurrency.toUpperCase(), rate: rate.toFixed(4), to: displayCurrency })}
        </span>
      )}
      {isConverting && rateStatus === "error" && (
        <span className="currency-toggle__note currency-toggle__note--warning">
          {t("rateUnavailable", { currency: nativeCurrency.toUpperCase() })}
        </span>
      )}
    </div>
  );
}
