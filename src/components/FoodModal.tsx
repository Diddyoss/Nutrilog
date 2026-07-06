import { useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useExitTransition } from '../hooks/useExitTransition';
import { defaultMealForNow } from '../lib/date';
import { MEAL_LABELS, MEALS } from './MealSection';
import {
  ALL_NUTRIENT_KEYS,
  GROUP_LABELS,
  NUTRIENT_GROUPS,
  NUTRIENT_META,
} from '../lib/nutrientReference';
import type {
  FoodDraft,
  FoodSaveFields,
  FoodSource,
  Meal,
  NutrientKey,
  NutrientValues,
} from '../types';

const MICRO_VIEWS = ['vitamins', 'minerals', 'fats', 'fatty_acids'] as const;

/** Extract the quantity from a serving string: prefers grams/ml, falls back to the first number. */
function parseQty(s: string): number | null {
  const metric = s.match(/(\d+(?:[.,]\d+)?)\s*(?:g|grams?|ml)\b/i);
  if (metric) return parseFloat(metric[1].replace(',', '.'));
  const any = s.match(/(\d+(?:[.,]\d+)?)/);
  return any ? parseFloat(any[1].replace(',', '.')) : null;
}

function round1str(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** Micro display: blank when zero to keep the form uncluttered. */
function microStr(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r ? String(r) : '';
}

function initMicroStrings(src?: Partial<NutrientValues>): Record<NutrientKey, string> {
  const out = {} as Record<NutrientKey, string>;
  for (const k of ALL_NUTRIENT_KEYS) out[k] = microStr(Number(src?.[k] ?? 0));
  return out;
}

function initMicroNums(src?: Partial<NutrientValues>): NutrientValues {
  const out = {} as NutrientValues;
  for (const k of ALL_NUTRIENT_KEYS) out[k] = Number(src?.[k] ?? 0) || 0;
  return out;
}

export interface FoodImpact {
  /** Day totals excluding this entry (for edits) — what the day looks like without it. */
  baseline: { calories: number; protein: number; carbs: number; fat: number };
  targets: { calories: number; protein: number; carbs: number; fat: number };
}

const MINI_R = 22;
const MINI_C = 2 * Math.PI * MINI_R;

function MiniRing({
  label,
  current,
  target,
  colorClass,
}: {
  label: string;
  current: number;
  target: number;
  colorClass: 'calories' | 'protein' | 'carbs' | 'fat';
}) {
  const pct = target > 0 ? current / target : 0;
  const frac = Math.min(pct, 1);
  const over = pct > 1;

  return (
    <div className="impact-ring">
      <div className="impact-svg-wrap">
        <svg viewBox="0 0 56 56">
          <circle className="mini-track" cx="28" cy="28" r={MINI_R} />
          <circle
            className={`mini-fill ${colorClass}${over ? ' over' : ''}`}
            cx="28"
            cy="28"
            r={MINI_R}
            strokeDasharray={MINI_C}
            strokeDashoffset={MINI_C * (1 - frac)}
          />
        </svg>
        <span className={`impact-pct${over ? ' over' : ''}`}>{Math.round(pct * 100)}%</span>
      </div>
      <span className="micro-label">{label}</span>
    </div>
  );
}

const SOURCE_LABELS: Record<FoodSource, string> = {
  scan: 'Scanned',
  ai_photo: 'AI Photo',
  search: 'Database',
  manual: 'Manual',
};

interface FoodModalProps {
  title: string;
  saveLabel: string;
  draft: FoodDraft;
  initialMeal?: Meal;
  impact?: FoodImpact;
  /** Returns whether the save succeeded — on true the modal animates itself closed. */
  onSave: (fields: FoodSaveFields) => Promise<boolean> | boolean;
  onClose: () => void;
}

function numStr(v: number | null): string {
  return v === null || v === undefined ? '' : String(Math.round(v * 10) / 10);
}

export function FoodModal({ title, saveLabel, draft, initialMeal, impact, onSave, onClose }: FoodModalProps) {
  const [name, setName] = useState(draft.food_name);
  const [serving, setServing] = useState(draft.serving_size);
  const [meal, setMeal] = useState<Meal>(initialMeal ?? defaultMealForNow());
  const [calories, setCalories] = useState(numStr(draft.calories));
  const [protein, setProtein] = useState(numStr(draft.protein_g));
  const [carbs, setCarbs] = useState(numStr(draft.carbs_g));
  const [fat, setFat] = useState(numStr(draft.fat_g));
  const [micros, setMicros] = useState<Record<NutrientKey, string>>(() => initMicroStrings(draft.micros));
  const [microsOpen, setMicrosOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { closing, requestClose } = useExitTransition(onClose);

  // Original values captured on open — all proportional rescaling is anchored
  // here so repeated edits never compound rounding drift.
  const baseline = useRef({
    qty: parseQty(draft.serving_size),
    calories: draft.calories,
    protein: draft.protein_g,
    carbs: draft.carbs_g,
    fat: draft.fat_g,
    micros: initMicroNums(draft.micros),
  });

  const setMicro = (key: NutrientKey, value: string) =>
    setMicros((prev) => ({ ...prev, [key]: value }));

  const scaleMicrosFromBaseline = (ratio: number) => {
    const bm = baseline.current.micros;
    const next = {} as Record<NutrientKey, string>;
    for (const k of ALL_NUTRIENT_KEYS) next[k] = microStr(bm[k] * ratio);
    setMicros(next);
  };

  const handleServingChange = (value: string) => {
    setServing(value);

    const b = baseline.current;
    const newQty = parseQty(value);
    const ratio = b.qty && b.qty > 0 && newQty && newQty > 0 ? newQty / b.qty : null;

    // Exact per-gram data (from a database/scan result) wins for macros when grams are typed.
    const gramMatch = value.match(/(\d+(?:[.,]\d+)?)\s*(?:g|grams?)\b/i);
    if (draft.perGram && gramMatch) {
      const grams = parseFloat(gramMatch[1].replace(',', '.'));
      if (Number.isFinite(grams) && grams > 0) {
        setCalories(String(Math.round(draft.perGram.calories * grams)));
        setProtein(round1str(draft.perGram.protein_g * grams));
        setCarbs(round1str(draft.perGram.carbs_g * grams));
        setFat(round1str(draft.perGram.fat_g * grams));
        if (ratio !== null) scaleMicrosFromBaseline(ratio);
        return;
      }
    }

    // Otherwise scale everything by the quantity ratio vs the original serving
    // (works for 100g -> 50g, 2 cups -> 1 cup, 3 scoops -> 1 scoop, ...).
    if (ratio === null) return;
    if (b.calories !== null) setCalories(String(Math.round(b.calories * ratio)));
    if (b.protein !== null) setProtein(round1str(b.protein * ratio));
    if (b.carbs !== null) setCarbs(round1str(b.carbs * ratio));
    if (b.fat !== null) setFat(round1str(b.fat * ratio));
    scaleMicrosFromBaseline(ratio);
  };

  const handleCaloriesChange = (value: string) => {
    setCalories(value);
    const b = baseline.current;
    const newCal = parseFloat(value);
    if (!b.calories || b.calories <= 0 || !Number.isFinite(newCal) || newCal < 0) return;
    const ratio = newCal / b.calories;
    if (b.protein !== null) setProtein(round1str(b.protein * ratio));
    if (b.carbs !== null) setCarbs(round1str(b.carbs * ratio));
    if (b.fat !== null) setFat(round1str(b.fat * ratio));
    scaleMicrosFromBaseline(ratio);
  };

  const submit = async () => {
    if (!name.trim()) {
      setError('Food name is required');
      return;
    }
    const cal = parseFloat(calories);
    if (!Number.isFinite(cal) || cal < 0) {
      setError('Enter the calories');
      return;
    }
    setError(null);
    setSaving(true);
    const microValues = {} as NutrientValues;
    for (const k of ALL_NUTRIENT_KEYS) microValues[k] = parseFloat(micros[k]) || 0;
    try {
      const ok = await onSave({
        food_name: name.trim(),
        serving_size: serving.trim() || null,
        meal,
        calories: Math.round(cal),
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
        source: draft.source,
        ...microValues,
      });
      if (ok) requestClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={requestClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <span className="badge">{SOURCE_LABELS[draft.source]}</span>
        </div>

        {draft.source === 'ai_photo' && (
          <p className="caption">
            AI estimate — adjust if needed
            {draft.confidence ? ` · confidence: ${draft.confidence}` : ''}
          </p>
        )}
        {draft.note && <p className="caption muted">{draft.note}</p>}
        {draft.has_macros === false && <p className="caption">Macros unavailable — enter manually</p>}

        <div className="field">
          <label className="field-label">Food name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label className="field-label">Serving size</label>
          <input
            className="input"
            placeholder="e.g. 1 cup, 150g, 1 scoop"
            value={serving}
            onChange={(e) => handleServingChange(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">Meal</label>
          <div className="segmented wrap">
            {MEALS.map((m) => (
              <button key={m} className={meal === m ? 'active' : ''} onClick={() => setMeal(m)} type="button">
                {MEAL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Calories (kcal)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            value={calories}
            onChange={(e) => handleCaloriesChange(e.target.value)}
          />
        </div>

        <div className="grid-3">
          <div className="field">
            <label className="field-label">Protein g</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Carbs g</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label">Fat g</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </div>

        <div className="micro-section">
          <button
            type="button"
            className="micro-toggle"
            onClick={() => setMicrosOpen((o) => !o)}
            aria-expanded={microsOpen}
          >
            <span className="field-label">Micronutrients (tap to edit)</span>
            <ChevronDown size={16} className={`chevron${microsOpen ? ' open' : ''}`} />
          </button>
          {microsOpen && (
            <div className="micro-groups">
              {MICRO_VIEWS.map((group) => (
                <div key={group} className="micro-group">
                  <div className="micro-subhead">{GROUP_LABELS[group]}</div>
                  {NUTRIENT_GROUPS[group].map((key) => (
                    <div key={key} className="micro-field">
                      <label className="micro-field-label">
                        {NUTRIENT_META[key].label} ({NUTRIENT_META[key].unit})
                      </label>
                      <input
                        className="input"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={micros[key]}
                        onChange={(e) => setMicro(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {impact && (
          <div className="field">
            <label className="field-label">Impact on daily targets</label>
            <div className="impact-row">
              <MiniRing
                label="kcal"
                colorClass="calories"
                current={impact.baseline.calories + (parseFloat(calories) || 0)}
                target={impact.targets.calories}
              />
              <MiniRing
                label="Protein"
                colorClass="protein"
                current={impact.baseline.protein + (parseFloat(protein) || 0)}
                target={impact.targets.protein}
              />
              <MiniRing
                label="Carbs"
                colorClass="carbs"
                current={impact.baseline.carbs + (parseFloat(carbs) || 0)}
                target={impact.targets.carbs}
              />
              <MiniRing
                label="Fat"
                colorClass="fat"
                current={impact.baseline.fat + (parseFloat(fat) || 0)}
                target={impact.targets.fat}
              />
            </div>
          </div>
        )}

        <p className="caption muted">
          Changing the serving or calories rescales the other values proportionally.
        </p>

        {error && <p className="caption error-text">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={requestClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving} type="button">
            {saving ? <span className="spinner" /> : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
