import { useEffect, useState } from 'react';
import { Check, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { FoodEntry, Meal } from '../types';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: FoodEntry;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);

  const macros = `P${Math.round(entry.protein_g ?? 0)} C${Math.round(entry.carbs_g ?? 0)} F${Math.round(entry.fat_g ?? 0)}`;

  return (
    <div className="entry-row">
      <div className="entry-info">
        <div className="entry-name">{entry.food_name}</div>
        <div className="entry-meta">
          {entry.serving_size ? `${entry.serving_size} · ` : ''}
          {entry.calories} kcal · {macros}
        </div>
      </div>
      <button className="icon-btn" aria-label="Edit entry" onClick={() => onEdit(entry)}>
        <Pencil size={16} />
      </button>
      <button
        className={`icon-btn${armed ? ' armed' : ''}`}
        aria-label={armed ? 'Confirm delete' : 'Delete entry'}
        onClick={() => (armed ? onDelete(entry.id) : setArmed(true))}
      >
        {armed ? <Check size={16} /> : <Trash2 size={16} />}
      </button>
    </div>
  );
}

interface MealSectionProps {
  meal: Meal;
  entries: FoodEntry[];
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}

export function MealSection({ meal, entries, onEdit, onDelete }: MealSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const subtotal = entries.reduce((sum, e) => sum + (e.calories ?? 0), 0);

  return (
    <section className="card meal-section">
      <button className="meal-header" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <span className="meal-title">{MEAL_LABELS[meal]}</span>
        <span className="meal-kcal">{subtotal} kcal</span>
        <ChevronDown size={16} className={`chevron${expanded ? ' open' : ''}`} />
      </button>
      <div className={`meal-collapse${expanded ? ' open' : ''}`}>
        <div className="meal-body">
          {entries.length === 0 ? (
            <div className="meal-empty">No items</div>
          ) : (
            entries.map((e) => <EntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />)
          )}
        </div>
      </div>
    </section>
  );
}
