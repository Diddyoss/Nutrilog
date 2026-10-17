import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ConfirmDeleteButton } from './ConfirmDeleteButton';
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
  return (
    <div className="my-food-row">
      <button className="result-item" onClick={onPick} type="button">
        <span className="result-name">{food.food_name}</span>
        <span className="result-meta">{customFoodSummary(food)}</span>
      </button>
      <ConfirmDeleteButton label="Remove from saved foods" confirmLabel="Confirm remove" onConfirm={onRemove} />
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
            Foods you enter here are saved to log again with one tap. To keep a scanned or searched food, tick “Save to My Foods” when adding it.
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
