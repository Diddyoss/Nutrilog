import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import {
  contributorsFor,
  formatAmount,
  GROUP_LABELS,
  NUTRIENT_GROUPS,
  NUTRIENT_META,
} from '../lib/nutrientReference';
import type { NutrientGroup } from '../lib/nutrientReference';
import type { FoodEntry, NutrientKey, NutrientValues, SupplementEntry } from '../types';

const GROUPS: NutrientGroup[] = ['vitamins', 'minerals', 'fats'];

interface Highlight {
  key: NutrientKey;
  nonce: number;
}

interface NutrientBreakdownTableProps {
  totals: NutrientValues;
  foods: FoodEntry[];
  supplements: SupplementEntry[];
  mealLabel: (entry: FoodEntry) => string;
  highlight: Highlight | null;
  onAddSupplement?: () => void;
}

function Contributors({
  nutrient,
  foods,
  supplements,
  mealLabel,
}: {
  nutrient: NutrientKey;
  foods: FoodEntry[];
  supplements: SupplementEntry[];
  mealLabel: (entry: FoodEntry) => string;
}) {
  const items = contributorsFor(nutrient, foods, supplements, mealLabel);
  const unit = NUTRIENT_META[nutrient].unit;
  if (items.length === 0) {
    return (
      <div className="nb-contrib">
        <div className="nb-contrib-empty">Nothing logged contributes to this nutrient.</div>
      </div>
    );
  }
  const top = items.slice(0, 5);
  const more = items.length - top.length;
  return (
    <div className="nb-contrib">
      {top.map((c, i) => (
        <div key={i} className="nb-contrib-row">
          <span className="nb-contrib-name">
            {c.name} <span className="muted">({c.context})</span>
          </span>
          <span className="nb-contrib-amt">{formatAmount(c.amount, unit)}</span>
        </div>
      ))}
      {more > 0 && <div className="nb-contrib-more">+{more} more</div>}
    </div>
  );
}

export function NutrientBreakdownTable({
  totals,
  foods,
  supplements,
  mealLabel,
  highlight,
  onAddSupplement,
}: NutrientBreakdownTableProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<NutrientKey>>(new Set());
  const [pulseKey, setPulseKey] = useState<NutrientKey | null>(null);
  const rowRefs = useRef<Partial<Record<NutrientKey, HTMLDivElement | null>>>({});

  // A pie-segment tap opens the section, expands + scrolls to + pulses the row.
  useEffect(() => {
    if (!highlight) return;
    const { key } = highlight;
    setOpen(true);
    setExpanded((prev) => new Set(prev).add(key));
    setPulseKey(key);
    const raf = requestAnimationFrame(() =>
      rowRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
    const t = setTimeout(() => setPulseKey(null), 1200);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [highlight]);

  const toggleRow = (key: NutrientKey) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="card nb-card">
      <button className="nb-header" onClick={() => setOpen((o) => !o)} aria-expanded={open} type="button">
        <span className="meal-title">Nutrient Breakdown</span>
        <ChevronDown size={16} className={`chevron${open ? ' open' : ''}`} />
      </button>

      {open && (
        <div className="nb-body">
          {onAddSupplement && (
            <button className="btn btn-secondary btn-block nb-add-supp" onClick={onAddSupplement} type="button">
              <Plus size={16} /> Add Supplement
            </button>
          )}

          {GROUPS.map((group) => {
            const rows = NUTRIENT_GROUPS[group]
              .map((key) => {
                const meta = NUTRIENT_META[key];
                const consumed = totals[key] ?? 0;
                const pct = meta.rdi > 0 ? consumed / meta.rdi : 0;
                return { key, meta, consumed, pct };
              })
              .sort((a, b) => b.pct - a.pct);

            return (
              <div key={group} className="nb-group">
                <div className="micro-subhead">{GROUP_LABELS[group]}</div>
                <div className="nb-table">
                  {rows.map(({ key, meta, consumed, pct }) => (
                    <div
                      key={key}
                      className={`nb-row-wrap${pulseKey === key ? ' pulse' : ''}`}
                      ref={(el) => {
                        rowRefs.current[key] = el;
                      }}
                    >
                      <button className="nb-row" onClick={() => toggleRow(key)} type="button">
                        <div className="nb-row-head">
                          <span className="nb-name">{meta.label}</span>
                          <span className="nb-amounts">
                            <span className="nb-val">{formatAmount(consumed, meta.unit)}</span>
                            <span className="muted">
                              {' '}
                              / {meta.rdi}
                              {meta.unit}
                            </span>
                            <span className={`nb-pct${pct >= 1 ? ' met' : ''}`}>{Math.round(pct * 100)}%</span>
                          </span>
                        </div>
                        <span className="nb-bar">
                          <span
                            className={`nb-fill${pct >= 1 ? ' met' : ''}`}
                            style={{ width: `${Math.min(100, pct * 100)}%` }}
                          />
                        </span>
                      </button>
                      {expanded.has(key) && (
                        <Contributors
                          nutrient={key}
                          foods={foods}
                          supplements={supplements}
                          mealLabel={mealLabel}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
