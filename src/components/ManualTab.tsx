import { useEffect, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { blankManualDraft } from '../lib/api';
import { customFoodSummary, customFoodToDraft, filterCustomFoods } from '../lib/customFoods';
import type { CustomFood, FoodDraft } from '../types';

interface ManualTabProps {
  foods: CustomFood[];
  loading: boolean;
  available: boolean;
  onResult: (draft: FoodDraft) => void;
  onRemove: (id: string) => void;
}

function FoodRow({
  food,
  onPick,
  onRemove,
}: {
  food: CustomFood;
  onPick: () => void;
  onRemove: () => void;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="my-food-row">
      <button className="result-item" onClick={onPick} type="button">
        <span className="result-name">{food.food_name}</span>
        <span className="result-meta">{customFoodSummary(food)}</span>
      </button>
      <button
        className={`icon-btn${armed ? ' armed' : ''}`}
        aria-label={armed ? 'Confirm remove' : 'Remove from saved foods'}
        onClick={() => (armed ? onRemove() : setArmed(true))}
        type="button"
      >
        {armed ? <Check size={16} /> : <Trash2 size={16} />}
      </button>
    </div>
  );
}

/**
 * Manual entry plus the user's saved foods. Entering a food by hand is the
 * primary action here; anything entered this way is saved below for re-logging.
 */
export function ManualTab({ foods, loading, available, onResult, onRemove }: ManualTabProps) {
  const [query, setQuery] = useState('');
  const visible = filterCustomFoods(foods, query);

  return (
    <div className="search-tab">
      <button
        className="btn btn-primary btn-block"
        onClick={() => onResult(blankManualDraft())}
        type="button"
      >
        <Plus size={16} />
        Enter a new food
      </button>

      {!available ? (
        <p className="caption muted">
          Saved foods need DB migration 005 — you can still enter foods manually.
        </p>
      ) : foods.length === 0 ? (
        !loading && (
          <p className="caption muted">
            Foods you enter here are saved so you can log them again with one tap.
          </p>
        )
      ) : (
        <>
          <div className="micro-label">Saved foods</div>
          <input
            className="input"
            placeholder="Filter saved foods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {visible.length === 0 ? (
            <p className="caption muted">No saved foods match “{query.trim()}”.</p>
          ) : (
            <div className="results-list">
              {visible.map((f) => (
                <FoodRow
                  key={f.id}
                  food={f}
                  onPick={() => onResult(customFoodToDraft(f))}
                  onRemove={() => onRemove(f.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
