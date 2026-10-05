import { Plus } from 'lucide-react';
import { ConfirmDeleteButton } from './ConfirmDeleteButton';
import type { ActivityEntry } from '../types';

function ActivityRow({ entry, onDelete }: { entry: ActivityEntry; onDelete: (id: string) => void }) {
  return (
    <div className="entry-row">
      <div className="entry-info">
        <div className="entry-name">{entry.activity_name}</div>
        <div className="entry-meta">−{entry.calories_burned} kcal</div>
      </div>
      <ConfirmDeleteButton label="Delete activity" onConfirm={() => onDelete(entry.id)} />
    </div>
  );
}

interface ActivitySectionProps {
  entries: ActivityEntry[];
  totalBurned: number;
  canAdd: boolean;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export function ActivitySection({ entries, totalBurned, canAdd, onAdd, onDelete }: ActivitySectionProps) {
  if (entries.length === 0 && !canAdd) return null;

  return (
    <section className="card meal-section activity-section">
      <div className="meal-header activity-header">
        <span className="meal-title">Activity</span>
        <span className="meal-kcal">{totalBurned > 0 ? `−${totalBurned} kcal` : '0 kcal'}</span>
      </div>
      <div className="meal-body">
        {entries.length === 0 ? (
          <div className="meal-empty">No activity logged</div>
        ) : (
          entries.map((e) => <ActivityRow key={e.id} entry={e} onDelete={onDelete} />)
        )}
        {canAdd && (
          <button className="btn btn-secondary btn-block activity-add" onClick={onAdd} type="button">
            <Plus size={16} /> Add activity
          </button>
        )}
      </div>
    </section>
  );
}
