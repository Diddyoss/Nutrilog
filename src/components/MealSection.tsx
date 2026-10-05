import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ConfirmDeleteButton } from './ConfirmDeleteButton';
import { MEAL_LABELS } from '../lib/meals';
import type { FoodEntry, Meal } from '../types';

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: FoodEntry;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const macros = `P ${Math.round(entry.protein_g ?? 0)} · C ${Math.round(entry.carbs_g ?? 0)} · F ${Math.round(entry.fat_g ?? 0)}`;

  return (
    <div className="entry-row">
      {/* The whole row opens the editor; only delete keeps its own control. */}
      <button className="entry-main" onClick={() => onEdit(entry)} type="button" aria-label={`Edit ${entry.food_name}`}>
        <span className="entry-info">
          <span className="entry-name">{entry.food_name}</span>
          <span className="entry-meta">
            {entry.serving_size ? `${entry.serving_size} · ` : ''}
            {macros}
          </span>
        </span>
        <span className="entry-kcal">
          {entry.calories}
          <span className="entry-kcal-unit"> kcal</span>
        </span>
      </button>
      <ConfirmDeleteButton label={`Delete ${entry.food_name}`} onConfirm={() => onDelete(entry.id)} />
    </div>
  );
}

interface MealSectionProps {
  meal: Meal;
  entries: FoodEntry[];
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}

/** One meal inside the day's single meals card. */
export function MealSection({ meal, entries, onEdit, onDelete }: MealSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const subtotal = entries.reduce((sum, e) => sum + (e.calories ?? 0), 0);
  const empty = entries.length === 0;

  return (
    <div className={`meal-group${empty ? ' empty' : ''}`}>
      <button
        className="meal-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={empty}
        type="button"
      >
        <span className="meal-title">{MEAL_LABELS[meal]}</span>
        <span className="meal-kcal">{empty ? '—' : `${subtotal} kcal`}</span>
        {!empty && <ChevronDown size={16} className={`chevron${expanded ? ' open' : ''}`} />}
      </button>
      {!empty && (
        <div className={`meal-collapse${expanded ? ' open' : ''}`}>
          <div className="meal-body">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
