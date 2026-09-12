import { HORIZON_LABELS, type Horizon, type HorizonEligibility } from "@/lib/forecast";

const ORDER: Horizon[] = ["month", "quarter", "year"];

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
  return (
    <div className="horizon-selector" role="radiogroup" aria-label="Forecast horizon">
      {ORDER.map((h) => {
        const e = eligibility[h];
        return (
          <label key={h} className={`horizon-option ${!e.eligible ? "is-disabled" : ""}`}>
            <input type="radio" name="horizon" value={h} defaultChecked={h === defaultHorizon} disabled={!e.eligible} />
            <span className="horizon-option__label">{HORIZON_LABELS[h]}</span>
            {!e.eligible && (
              <span className="horizon-option__hint">
                Needs {e.daysNeeded} more day{e.daysNeeded === 1 ? "" : "s"} of transaction history
              </span>
            )}
            {e.eligible && e.lowConfidence && (
              <span className="horizon-option__hint">Confidence is lower — under a full year of history</span>
            )}
          </label>
        );
      })}
    </div>
  );
}
