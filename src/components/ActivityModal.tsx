import { useState } from 'react';
import { useExitTransition } from '../hooks/useExitTransition';
import type { ActivitySaveFields } from '../types';

interface ActivityModalProps {
  /** Returns whether the save succeeded — on true the modal animates itself closed. */
  onSave: (fields: ActivitySaveFields) => Promise<boolean> | boolean;
  onClose: () => void;
}

export function ActivityModal({ onSave, onClose }: ActivityModalProps) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { closing, requestClose } = useExitTransition(onClose);

  const submit = async () => {
    const burned = parseInt(kcal, 10);
    if (!name.trim()) {
      setError('Activity name is required');
      return;
    }
    if (!Number.isFinite(burned) || burned <= 0) {
      setError('Enter the calories burned');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const ok = await onSave({ activity_name: name.trim(), calories_burned: Math.round(burned) });
      if (ok) requestClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={requestClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Log activity</h2>
        </div>

        <div className="field">
          <label className="field-label">Activity</label>
          <input
            className="input"
            placeholder="e.g. Run, Gym, Walk, Football"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">Calories burned (kcal)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </div>

        <p className="caption muted">Burned calories are deducted from today's net total.</p>

        {error && <p className="caption error-text">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={requestClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving} type="button">
            {saving ? <span className="spinner" /> : 'Log Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}
