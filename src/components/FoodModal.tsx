import { useRef, useState } from 'react';
import { defaultMealForNow } from '../lib/date';
import { MEAL_LABELS, MEALS } from './MealSection';
import type { FoodDraft, FoodSaveFields, FoodSource, Meal } from '../types';

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
  onSave: (fields: FoodSaveFields) => Promise<void> | void;
  onClose: () => void;
}

function numStr(v: number | null): string {
  return v === null || v === undefined ? '' : String(Math.round(v * 10) / 10);
}

export function FoodModal({ title, saveLabel, draft, initialMeal, onSave, onClose }: FoodModalProps) {
  const [name, setName] = useState(draft.food_name);
  const [serving, setServing] = useState(draft.serving_size);
  const [meal, setMeal] = useState<Meal>(initialMeal ?? defaultMealForNow());
  const [calories, setCalories] = useState(numStr(draft.calories));
  const [protein, setProtein] = useState(numStr(draft.protein_g));
  const [carbs, setCarbs] = useState(numStr(draft.carbs_g));
  const [fat, setFat] = useState(numStr(draft.fat_g));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Original values captured on open — all proportional rescaling is anchored
  // here so repeated edits never compound rounding drift.
  const baseline = useRef({
    qty: parseQty(draft.serving_size),
    calories: draft.calories,
    protein: draft.protein_g,
    carbs: draft.carbs_g,
    fat: draft.fat_g,
  });

  const handleServingChange = (value: string) => {
    setServing(value);

    // Exact per-gram data (from a database/scan result) wins when grams are typed.
    const gramMatch = value.match(/(\d+(?:[.,]\d+)?)\s*(?:g|grams?)\b/i);
    if (draft.perGram && gramMatch) {
      const grams = parseFloat(gramMatch[1].replace(',', '.'));
      if (Number.isFinite(grams) && grams > 0) {
        setCalories(String(Math.round(draft.perGram.calories * grams)));
        setProtein(round1str(draft.perGram.protein_g * grams));
        setCarbs(round1str(draft.perGram.carbs_g * grams));
        setFat(round1str(draft.perGram.fat_g * grams));
        return;
      }
    }

    // Otherwise scale everything by the quantity ratio vs the original serving
    // (works for 100g -> 50g, 2 cups -> 1 cup, 3 scoops -> 1 scoop, ...).
    const b = baseline.current;
    const newQty = parseQty(value);
    if (b.qty === null || b.qty <= 0 || newQty === null || newQty <= 0) return;
    const ratio = newQty / b.qty;
    if (b.calories !== null) setCalories(String(Math.round(b.calories * ratio)));
    if (b.protein !== null) setProtein(round1str(b.protein * ratio));
    if (b.carbs !== null) setCarbs(round1str(b.carbs * ratio));
    if (b.fat !== null) setFat(round1str(b.fat * ratio));
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
    try {
      await onSave({
        food_name: name.trim(),
        serving_size: serving.trim() || null,
        meal,
        calories: Math.round(cal),
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
        source: draft.source,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
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

        <p className="caption muted">
          Changing the serving or calories rescales the other values proportionally.
        </p>

        {error && <p className="caption error-text">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} type="button">
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
