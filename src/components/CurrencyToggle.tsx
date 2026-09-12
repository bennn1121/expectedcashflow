"use client";

import { useCurrency } from "./CurrencyProvider";

const OPTIONS = ["USD", "ILS"] as const;

export function CurrencyToggle() {
  const { displayCurrency, setDisplayCurrency, rate, rateStatus, nativeCurrency } = useCurrency();
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

      {isConverting && rateStatus === "loading" && (
        <span className="currency-toggle__note">Fetching exchange rate…</span>
      )}
      {isConverting && rateStatus === "ok" && rate !== null && (
        <span className="currency-toggle__note">
          1 {nativeCurrency.toUpperCase()} ≈ {rate.toFixed(4)} {displayCurrency}, for display only
        </span>
      )}
      {isConverting && rateStatus === "error" && (
        <span className="currency-toggle__note currency-toggle__note--warning">
          Conversion temporarily unavailable — showing {nativeCurrency.toUpperCase()}
        </span>
      )}
    </div>
  );
}
