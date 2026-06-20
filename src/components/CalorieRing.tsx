interface CalorieRingProps {
  /** Net calories for the day (food − activity). May be negative if more was burned than eaten. */
  consumed: number;
  target: number;
  /** 0–1 fraction of the waking day elapsed; null hides the outer day ring. */
  dayProgress: number | null;
  /** Calories burned via activity today; shown as context when > 0. */
  burned?: number;
}

const R = 84;
const C = 2 * Math.PI * R;
const DAY_R = 102;
const DAY_C = 2 * Math.PI * DAY_R;

export function CalorieRing({ consumed, target, dayProgress, burned = 0 }: CalorieRingProps) {
  const safeTarget = target > 0 ? target : 1;
  const pct = consumed / safeTarget;
  const mainFrac = Math.max(0, Math.min(pct, 1));
  const overFrac = pct > 1 ? Math.min(pct - 1, 1) : 0;
  const stroke = pct > 1 ? 'var(--ring-fill)' : pct >= 0.85 ? 'var(--warning)' : 'var(--ring-fill)';
  const remaining = Math.round(target - consumed);
  const display = Math.max(0, Math.round(consumed));
  const eaten = Math.round(consumed + burned);

  return (
    <div className="ring-block">
      <div className="ring-wrap">
        <svg viewBox="0 0 220 220" className="ring-svg" role="img" aria-label="Calorie progress">
          {dayProgress !== null && (
            <>
              <circle className="ring-day-track" cx="110" cy="110" r={DAY_R} />
              <circle
                className="ring-day"
                cx="110"
                cy="110"
                r={DAY_R}
                strokeDasharray={DAY_C}
                strokeDashoffset={DAY_C * (1 - dayProgress)}
              />
            </>
          )}
          <circle className="ring-track" cx="110" cy="110" r={R} />
          <circle
            className="ring-progress"
            cx="110"
            cy="110"
            r={R}
            style={{ stroke }}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - mainFrac)}
          />
          {overFrac > 0 && (
            <circle
              className="ring-over"
              cx="110"
              cy="110"
              r={R}
              strokeDasharray={`${C * overFrac} ${C}`}
            />
          )}
        </svg>
        <div className="ring-center">
          <div className="stat-giant">{display}</div>
          <div className="micro-label">/ {Math.round(target)} kcal</div>
        </div>
      </div>
      <div className={`ring-remaining${pct > 1 ? ' over' : ''}`}>
        {pct > 1 ? `${Math.abs(remaining)} kcal over target` : `${remaining} kcal remaining`}
      </div>
      {burned > 0 && (
        <div className="ring-net caption muted">
          {eaten} eaten · {Math.round(burned)} burned
        </div>
      )}
    </div>
  );
}
