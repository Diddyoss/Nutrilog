import { useMountAnimation } from '../hooks/useMountAnimation';
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
  // Drives the draw-on: dashoffset flips 1 → 0 one frame after mount.
  const ready = useMountAnimation();
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
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight trend">
        <polyline
          className="chart-line"
          points={points}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={ready ? 0 : 1}
        />
        {values.map((v, i) => {
          const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
          const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
          return (
            <circle
              key={i}
              className="chart-dot"
              cx={x}
              cy={y}
              r="2.5"
              style={{ animationDelay: `${150 + i * 35}ms` }}
            />
          );
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
