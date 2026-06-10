import { useState } from 'react';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../lib/calculations';
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg, round1 } from '../lib/units';
import type { ActivityLevel, Goal, ProfileInput, Sex, Units } from '../types';

interface ProfileFormProps {
  initial?: ProfileInput | null;
  defaultUnits?: Units;
  submitLabel: string;
  onSubmit: (values: ProfileInput) => void;
  onCancel?: () => void;
}

export function ProfileForm({
  initial,
  defaultUnits = 'metric',
  submitLabel,
  onSubmit,
  onCancel,
}: ProfileFormProps) {
  const initFtIn = initial ? cmToFtIn(initial.height_cm) : null;

  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'male');
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>(
    defaultUnits === 'imperial' ? 'ftin' : 'cm'
  );
  const [cm, setCm] = useState(initial ? String(round1(initial.height_cm)) : '');
  const [ft, setFt] = useState(initFtIn ? String(initFtIn.ft) : '');
  const [inch, setInch] = useState(initFtIn ? String(initFtIn.inch) : '');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(
    defaultUnits === 'imperial' ? 'lbs' : 'kg'
  );
  const [kg, setKg] = useState(initial ? String(round1(initial.weight_kg)) : '');
  const [lbs, setLbs] = useState(initial ? String(round1(kgToLbs(initial.weight_kg))) : '');
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? 'maintenance');
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activity_level ?? 'light');
  const [error, setError] = useState<string | null>(null);

  const switchHeightUnit = (unit: 'cm' | 'ftin') => {
    if (unit === heightUnit) return;
    if (unit === 'ftin') {
      const v = parseFloat(cm);
      if (Number.isFinite(v) && v > 0) {
        const { ft: f, inch: i } = cmToFtIn(v);
        setFt(String(f));
        setInch(String(i));
      }
    } else {
      const f = parseFloat(ft);
      const i = parseFloat(inch);
      if (Number.isFinite(f) || Number.isFinite(i)) {
        setCm(String(round1(ftInToCm(f || 0, i || 0))));
      }
    }
    setHeightUnit(unit);
  };

  const switchWeightUnit = (unit: 'kg' | 'lbs') => {
    if (unit === weightUnit) return;
    if (unit === 'lbs') {
      const v = parseFloat(kg);
      if (Number.isFinite(v) && v > 0) setLbs(String(round1(kgToLbs(v))));
    } else {
      const v = parseFloat(lbs);
      if (Number.isFinite(v) && v > 0) setKg(String(round1(lbsToKg(v))));
    }
    setWeightUnit(unit);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ageN = parseInt(age, 10);
    const heightCm =
      heightUnit === 'cm' ? parseFloat(cm) : ftInToCm(parseFloat(ft) || 0, parseFloat(inch) || 0);
    const weightKg = weightUnit === 'kg' ? parseFloat(kg) : lbsToKg(parseFloat(lbs));

    if (!Number.isFinite(ageN) || ageN < 10 || ageN > 100) return setError('Enter an age between 10 and 100');
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)
      return setError('Enter a height between 100 and 250 cm');
    if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300)
      return setError('Enter a weight between 30 and 300 kg');

    setError(null);
    onSubmit({
      sex,
      age: ageN,
      height_cm: round1(heightCm),
      weight_kg: round1(weightKg),
      goal,
      activity_level: activity,
    });
  };

  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="field">
        <label className="field-label">Biological sex</label>
        <div className="segmented">
          <button type="button" className={sex === 'male' ? 'active' : ''} onClick={() => setSex('male')}>
            Male
          </button>
          <button
            type="button"
            className={sex === 'female' ? 'active' : ''}
            onClick={() => setSex('female')}
          >
            Female
          </button>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Age (years)</label>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min="10"
          max="100"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
      </div>

      <div className="field">
        <div className="field-label-row">
          <label className="field-label">Height</label>
          <div className="unit-toggle">
            <button type="button" className={heightUnit === 'cm' ? 'active' : ''} onClick={() => switchHeightUnit('cm')}>
              cm
            </button>
            <button
              type="button"
              className={heightUnit === 'ftin' ? 'active' : ''}
              onClick={() => switchHeightUnit('ftin')}
            >
              ft/in
            </button>
          </div>
        </div>
        {heightUnit === 'cm' ? (
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="cm"
            value={cm}
            onChange={(e) => setCm(e.target.value)}
          />
        ) : (
          <div className="grid-2">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              placeholder="ft"
              value={ft}
              onChange={(e) => setFt(e.target.value)}
            />
            <input
              className="input"
              type="number"
              inputMode="numeric"
              placeholder="in"
              value={inch}
              onChange={(e) => setInch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="field">
        <div className="field-label-row">
          <label className="field-label">Weight</label>
          <div className="unit-toggle">
            <button type="button" className={weightUnit === 'kg' ? 'active' : ''} onClick={() => switchWeightUnit('kg')}>
              kg
            </button>
            <button
              type="button"
              className={weightUnit === 'lbs' ? 'active' : ''}
              onClick={() => switchWeightUnit('lbs')}
            >
              lbs
            </button>
          </div>
        </div>
        {weightUnit === 'kg' ? (
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="kg"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
        ) : (
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="lbs"
            value={lbs}
            onChange={(e) => setLbs(e.target.value)}
          />
        )}
      </div>

      <div className="field">
        <label className="field-label">Goal</label>
        <div className="segmented">
          {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
            <button key={g} type="button" className={goal === g ? 'active' : ''} onClick={() => setGoal(g)}>
              {GOAL_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label">Activity level</label>
        <select
          className="input"
          value={activity}
          onChange={(e) => setActivity(e.target.value as ActivityLevel)}
        >
          {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABELS[a]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="caption error-text">{error}</p>}

      <div className="modal-actions">
        {onCancel && (
          <button className="btn btn-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
        )}
        <button className="btn btn-primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
