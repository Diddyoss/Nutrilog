import { useState } from 'react';
import {
  GROUP_LABELS,
  NUTRIENT_GROUPS,
  NUTRIENT_META,
} from '../lib/nutrientReference';
import type { NutrientGroup } from '../lib/nutrientReference';
import type { NutrientKey, NutrientValues } from '../types';

interface NutrientPieChartProps {
  totals: NutrientValues;
  hasData: boolean;
  onSegmentTap?: (key: NutrientKey) => void;
}

const VIEWS: NutrientGroup[] = ['vitamins', 'minerals', 'fats'];
const R = 70;
const C = 2 * Math.PI * R;

export function NutrientPieChart({ totals, hasData, onSegmentTap }: NutrientPieChartProps) {
  const [view, setView] = useState<NutrientGroup>('vitamins');

  const keys = NUTRIENT_GROUPS[view];
  const segments = keys.map((key) => {
    const rdi = NUTRIENT_META[key].rdi;
    const pct = rdi > 0 ? totals[key] / rdi : 0;
    return { key, pct, size: Math.min(Math.max(pct, 0), 1) };
  });
  const sizeSum = segments.reduce((s, x) => s + x.size, 0);
  const metCount = segments.filter((s) => s.pct >= 1).length;

  let acc = 0;

  return (
    <div className="pie-panel">
      <div className="pie-toggle">
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? 'active' : ''}
            onClick={() => setView(v)}
          >
            {GROUP_LABELS[v]}
          </button>
        ))}
      </div>

      <div className="pie-wrap">
        <svg viewBox="0 0 200 200" className="pie-svg" role="img" aria-label={`${GROUP_LABELS[view]} vs daily targets`}>
          <circle className="pie-track" cx="100" cy="100" r={R} />
          {hasData &&
            sizeSum > 0 &&
            segments.map((s) => {
              if (s.size <= 0) return null;
              const len = (s.size / sizeSum) * C;
              const offset = -acc;
              acc += len;
              return (
                <circle
                  key={s.key}
                  className="pie-seg"
                  cx="100"
                  cy="100"
                  r={R}
                  stroke={NUTRIENT_META[s.key].color}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={offset}
                  onClick={() => onSegmentTap?.(s.key)}
                />
              );
            })}
        </svg>
        <div className="pie-center">
          {hasData ? (
            <>
              <div className="pie-met">
                {metCount}<span className="pie-met-of"> of {keys.length}</span>
              </div>
              <div className="micro-label">{view} met</div>
            </>
          ) : (
            <div className="caption muted pie-empty-text">Log food to see your nutrient breakdown</div>
          )}
        </div>
      </div>

      {hasData && (
        <div className="pie-legend">
          {segments.map((s) => (
            <button
              key={s.key}
              type="button"
              className="pie-legend-item"
              onClick={() => onSegmentTap?.(s.key)}
            >
              <span className="pie-dot" style={{ background: NUTRIENT_META[s.key].color }} />
              <span className="pie-legend-label">{NUTRIENT_META[s.key].label}</span>
              <span className="pie-legend-pct">{Math.round(s.pct * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
