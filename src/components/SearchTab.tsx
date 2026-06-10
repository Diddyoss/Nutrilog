import { useState } from 'react';
import { Search } from 'lucide-react';
import { draftFromSearchResult, searchFoods } from '../lib/api';
import type { FoodDraft, SearchResult } from '../types';

interface SearchTabProps {
  onResult: (draft: FoodDraft) => void;
}

const BLANK_MANUAL: FoodDraft = {
  food_name: '',
  serving_size: '',
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  source: 'manual',
  perGram: null,
};

export function SearchTab({ onResult }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await searchFoods(term));
    } catch {
      setError('Search failed — check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-tab">
      <form className="manual-row" onSubmit={submit}>
        <input
          className="input"
          placeholder="Search food or ingredient…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="btn btn-primary" type="submit" aria-label="Search">
          {loading ? <span className="spinner dark" /> : <Search size={16} />}
        </button>
      </form>

      {error && <p className="caption error-text">{error}</p>}

      {results !== null && results.length === 0 && !loading && (
        <div className="empty-state">
          <p>No results found.</p>
          <button className="btn btn-secondary" onClick={() => onResult(BLANK_MANUAL)} type="button">
            Add manually
          </button>
        </div>
      )}

      {results !== null && results.length > 0 && (
        <div className="results-list">
          {results.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              className="result-item"
              onClick={() => onResult(draftFromSearchResult(r))}
              type="button"
            >
              <span className="result-name">{r.name}</span>
              <span className="result-meta">
                {r.brand ? `${r.brand} · ` : ''}
                {r.kcal_per_100g !== null ? `${r.kcal_per_100g} kcal / 100g` : 'no calorie data'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
