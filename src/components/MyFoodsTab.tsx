import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { blankManualDraft } from '../lib/api';
import { customFoodSummary, customFoodToDraft, filterCustomFoods } from '../lib/customFoods';
import type { CustomFood, FoodDraft } from '../types';

interface MyFoodsTabProps {
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
        aria-label={armed ? 'Confirm remove' : 'Remove from My Foods'}
        onClick={() => (armed ? onRemove() : setArmed(true))}
        type="button"
      >
        {armed ? <Check size={16} /> : <Trash2 size={16} />}
      </button>
    </div>
  );
}

export function MyFoodsTab({ foods, loading, available, onResult, onRemove }: MyFoodsTabProps) {
  const [query, setQuery] = useState('');
  const visible = filterCustomFoods(foods, query);

  if (!available) {
    return (
      <div className="empty-state">
        <p>My Foods isn’t set up yet.</p>
        <p className="muted">Run DB migration 005 to start saving foods you enter manually.</p>
      </div>
    );
  }

  if (!loading && foods.length === 0) {
    return (
      <div className="empty-state">
        <p>No saved foods yet.</p>
        <p className="muted">Foods you enter manually are saved here so you can log them again.</p>
        <button className="btn btn-secondary" onClick={() => onResult(blankManualDraft())} type="button">
          Enter a food
        </button>
      </div>
    );
  }

  return (
    <div className="search-tab">
      <input
        className="input"
        placeholder="Filter my foods…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>No saved foods match “{query.trim()}”.</p>
        </div>
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
    </div>
  );
}
