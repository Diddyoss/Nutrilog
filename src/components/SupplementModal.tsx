import { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useExitTransition } from '../hooks/useExitTransition';
import { useScrollLock } from '../hooks/useScrollLock';
import { haptic } from '../lib/haptics';
import { scrollFocusedFieldIntoView } from '../lib/motion';
import { NUTRIENT_META, SUPPLEMENT_KEYS } from '../lib/nutrientReference';
import type { NutrientKey, SupplementSaveFields } from '../types';

interface SupplementModalProps {
  /** Returns whether the save succeeded — on true the modal animates itself closed. */
  onSave: (fields: SupplementSaveFields) => Promise<boolean> | boolean;
  onClose: () => void;
}

export function SupplementModal({ onSave, onClose }: SupplementModalProps) {
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { closing, requestClose } = useExitTransition(onClose);
  useScrollLock();
  useEscapeKey(requestClose);

  const setValue = (key: NutrientKey, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  const submit = async () => {
    if (!name.trim()) {
      setError('Supplement name is required');
      return;
    }
    setError(null);
    setSaving(true);
    const micros: Partial<Record<NutrientKey, number>> = {};
    for (const key of SUPPLEMENT_KEYS) {
      const n = parseFloat(values[key] ?? '');
      if (Number.isFinite(n) && n > 0) micros[key] = n;
    }
    try {
      const ok = await onSave({ supplement_name: name.trim(), dose: dose.trim() || null, ...micros });
      if (ok) {
        haptic('success');
        requestClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={requestClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onFocus={scrollFocusedFieldIntoView}>
        <div className="modal-head">
          <h2 className="modal-title">Add supplement</h2>
        </div>

        <div className="field">
          <label className="field-label">Name</label>
          <input
            className="input"
            placeholder="e.g. Multivitamin, Vitamin C"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="field-label">Dose (optional)</label>
          <input
            className="input"
            placeholder="e.g. 1 tablet, 500mg"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
        </div>

        <div className="micro-groups">
          <div className="micro-subhead">Per serving — fill what's on the label</div>
          {SUPPLEMENT_KEYS.map((key) => (
            <div key={key} className="micro-field">
              <label className="micro-field-label">
                {NUTRIENT_META[key].label} ({NUTRIENT_META[key].unit})
              </label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min="0"
                value={values[key] ?? ''}
                onChange={(e) => setValue(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        {error && <p className="caption error-text">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={requestClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving} type="button">
            {saving ? <span className="spinner" /> : 'Add Supplement'}
          </button>
        </div>
      </div>
    </div>
  );
}
