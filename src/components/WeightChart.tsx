import { kgToLbs, round1 } from '../lib/units';
import type { Units, WeightEntry } from '../types';

interface WeightChartProps {
  entries: WeightEntry[];
  units: Units;
}

const W = 320;
const H = 120;
const PAD = 12;

export function WeightChart({ entries, units }: WeightChartProps) {
  if (entries.length < 2) {
    return <p className="caption muted">Log your weight on a few days to see the trend.</p>;
  }

  const values = entries.map((e) => (units === 'imperial' ? kgToLbs(e.weight_kg) : e.weight_kg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
      return `${round1(x)},${round1(y)}`;
    })
    .join(' ');

  const unitLabel = units === 'imperial' ? 'lbs' : 'kg';

  return (
    <div className="weight-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight trend over the last 30 days">
        <defs>
          <linearGradient id="weight-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          className="chart-area"
          fill="url(#weight-area)"
          points={`${PAD},${H - PAD} ${points} ${W - PAD},${H - PAD}`}
        />
        <polyline className="chart-line" points={points} />
        {values.map((v, i) => {
          const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
          const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
          return <circle key={i} className="chart-dot" cx={x} cy={y} r="2.5" />;
        })}
      </svg>
      <div className="chart-range">
        <span className="caption muted">
          low {round1(min)} {unitLabel}
        </span>
        <span className="caption muted">
          high {round1(max)} {unitLabel}
        </span>
      </div>
    </div>
  );
}
