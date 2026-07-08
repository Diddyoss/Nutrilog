import { useState } from 'react';
import { ChartTip } from './ChartTip';

interface CaloriesChartProps {
  days: { date: string; calories: number }[];
  target: number;
  /** Caption under the chart, e.g. "last 14 days" or "weekly avg · 13 weeks". */
  rangeLabel: string;
}

const W = 320;
const H = 120;
const PAD = 12;

export function CaloriesChart({ days, target, rangeLabel }: CaloriesChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const logged = days.some((d) => d.calories > 0);
  if (!logged) {
    return <p className="caption muted">No calories logged in this period.</p>;
  }

  const max = Math.max(target, ...days.map((d) => d.calories), 1);
  const chartH = H - PAD * 2;
  const gap = days.length > 40 ? 1 : 4;
  const barW = (W - PAD * 2 - gap * (days.length - 1)) / days.length;
  const targetY = H - PAD - (target / max) * chartH;

  const barX = (i: number) => PAD + i * (barW + gap);
  const barY = (i: number) => H - PAD - (days[i].calories / max) * chartH;

  return (
    <div className="cal-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Calories, ${rangeLabel}`}>
        <line className="cal-target-line" x1={PAD} y1={targetY} x2={W - PAD} y2={targetY} />
        {days.map((d, i) => {
          const h = (d.calories / max) * chartH;
          return (
            <rect
              key={d.date}
              className={`cal-bar${d.calories > target ? ' over' : ''}${active === i ? ' active' : ''}`}
              x={barX(i)}
              y={barY(i)}
              width={barW}
              height={Math.max(0, h)}
              rx="1"
            />
          );
        })}
        {/* Full-height invisible hit zones so bars are tappable at any height. */}
        {days.map((d, i) => (
          <rect
            key={`hit-${d.date}`}
            className="chart-hit"
            x={barX(i) - gap / 2}
            y={0}
            width={barW + gap}
            height={H}
            onClick={() => setActive(active === i ? null : i)}
          />
        ))}
        {active !== null && days[active] && (
          <ChartTip
            x={barX(active) + barW / 2}
            y={barY(active)}
            primary={`${Math.round(days[active].calories)} kcal`}
            secondary={days[active].date.slice(5).replace('-', '/')}
            chartWidth={W}
          />
        )}
      </svg>
      <div className="chart-range">
        <span className="caption muted">target {target} kcal</span>
        <span className="caption muted">{rangeLabel}</span>
      </div>
    </div>
  );
}
