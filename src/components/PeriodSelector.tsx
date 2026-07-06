import { CHART_PERIODS, type ChartPeriod } from '../lib/trends';

const LABELS: Record<ChartPeriod, string> = { '1W': '1W', '1M': '1M', '3M': '3M', ALL: 'All' };

/** Segmented period control with a sliding thumb (1W / 1M / 3M / All). */
export function PeriodSelector({
  value,
  onChange,
}: {
  value: ChartPeriod;
  onChange: (p: ChartPeriod) => void;
}) {
  const idx = CHART_PERIODS.indexOf(value);
  return (
    <div className="period-selector" role="tablist" aria-label="Chart period">
      <span className="period-thumb" style={{ transform: `translateX(${idx * 100}%)` }} aria-hidden="true" />
      {CHART_PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={p === value}
          className={`period-option${p === value ? ' active' : ''}`}
          onClick={() => onChange(p)}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}
