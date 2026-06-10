import { useState } from 'react';
import { ProfileForm } from './ProfileForm';
import { calculateTargets } from '../lib/calculations';
import type { ProfileInput, Units } from '../types';

interface ProfileWizardProps {
  initial?: ProfileInput | null;
  defaultUnits?: Units;
  submitLabel: string;
  onComplete: (values: ProfileInput) => Promise<void> | void;
  onCancel?: () => void;
}

/** Two-step flow: stats form → calculated target summary → "Looks good". */
export function ProfileWizard({
  initial,
  defaultUnits,
  submitLabel,
  onComplete,
  onCancel,
}: ProfileWizardProps) {
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [values, setValues] = useState<ProfileInput | null>(initial ?? null);
  const [saving, setSaving] = useState(false);

  if (step === 'form' || !values) {
    return (
      <ProfileForm
        initial={values}
        defaultUnits={defaultUnits}
        submitLabel={submitLabel}
        onCancel={onCancel}
        onSubmit={(v) => {
          setValues(v);
          setStep('summary');
        }}
      />
    );
  }

  const t = calculateTargets(values);

  return (
    <div className="target-summary">
      <div className="micro-label">Your daily target</div>
      <div className="stat-giant">{t.calorie_target}</div>
      <div className="caption">kcal</div>
      <div className="summary-macros">
        {t.protein_target_g}g protein · {t.carbs_target_g}g carbs · {t.fat_target_g}g fat
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={saving}
        type="button"
        onClick={async () => {
          setSaving(true);
          try {
            await onComplete(values);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? <span className="spinner" /> : 'Looks good'}
      </button>
      <button className="btn btn-secondary btn-block" onClick={() => setStep('form')} type="button">
        Back
      </button>
    </div>
  );
}
