interface CaloriesChartProps {
  days: { date: string; calories: number }[];
  target: number;
}

const W = 320;
const H = 120;
const PAD = 12;

export function CaloriesChart({ days, target }: CaloriesChartProps) {
  const logged = days.some((d) => d.calories > 0);
  if (!logged) {
    return <p className="caption muted">No calories logged in the last two weeks.</p>;
  }

  const max = Math.max(target, ...days.map((d) => d.calories), 1);
  const chartH = H - PAD * 2;
  const gap = 4;
  const barW = (W - PAD * 2 - gap * (days.length - 1)) / days.length;
  const targetY = H - PAD - (target / max) * chartH;

  return (
    <div className="cal-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily calories over the last 14 days">
        <line className="cal-target-line" x1={PAD} y1={targetY} x2={W - PAD} y2={targetY} />
        {days.map((d, i) => {
          const h = (d.calories / max) * chartH;
          const x = PAD + i * (barW + gap);
          const y = H - PAD - h;
          return (
            <rect
              key={d.date}
              className={`cal-bar${d.calories > target ? ' over' : ''}`}
              x={x}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              rx="1"
            />
          );
        })}
      </svg>
      <div className="chart-range">
        <span className="caption muted">target {target} kcal</span>
        <span className="caption muted">last {days.length} days</span>
      </div>
    </div>
  );
}
