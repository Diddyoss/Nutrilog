import { useCallback, useEffect, useState } from 'react';
import { ProfileWizard } from '../components/ProfileWizard';
import { WeightChart } from '../components/WeightChart';
import { useToast } from '../components/Toast';
import { ACTIVITY_LABELS, GOAL_LABELS } from '../lib/calculations';
import { addDays, toDateStr, todayStr } from '../lib/date';
import { formatHeight, formatWeight, lbsToKg, round1 } from '../lib/units';
import { supabase } from '../lib/supabase';
import type { Profile, ProfileInput, WeightEntry } from '../types';

interface ProfilePageProps {
  profile: Profile;
  onSaveProfile: (input: ProfileInput) => Promise<boolean>;
  onUpdateProfile: (patch: Partial<Profile>) => Promise<boolean>;
}

export function ProfilePage({ profile, onSaveProfile, onUpdateProfile }: ProfilePageProps) {
  const [name, setName] = useState(profile.name ?? '');
  const [editing, setEditing] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const { toast } = useToast();

  const loadWeights = useCallback(async () => {
    const from = toDateStr(addDays(new Date(), -30));
    const { data } = await supabase
      .from('weight_log')
      .select('id, log_date, weight_kg')
      .gte('log_date', from)
      .order('log_date', { ascending: true })
      .order('logged_at', { ascending: true });

    // keep the latest entry per day
    const byDay = new Map<string, WeightEntry>();
    for (const row of (data ?? []) as WeightEntry[]) byDay.set(row.log_date, row);
    setWeights([...byDay.values()]);
  }, []);

  useEffect(() => {
    loadWeights();
  }, [loadWeights]);

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed === (profile.name ?? '')) return;
    await onUpdateProfile({ name: trimmed || null });
  };

  const logWeight = async () => {
    const v = parseFloat(weightInput);
    if (!Number.isFinite(v) || v <= 0) return;
    const kg = round1(profile.units === 'imperial' ? lbsToKg(v) : v);
    setSavingWeight(true);
    const { error } = await supabase
      .from('weight_log')
      .insert({ log_date: todayStr(), weight_kg: kg });
    setSavingWeight(false);
    if (error) {
      toast('Could not log weight');
      return;
    }
    setWeightInput('');
    toast('Weight logged');
    loadWeights();
  };

  const target = profile.calorie_override ?? profile.calorie_target;

  return (
    <div className="page">
      <header className="page-header">
        <div className="micro-label">Profile</div>
        <h1 className="page-title">{profile.name || 'Your stats'}</h1>
      </header>

      <section className="card">
        <div className="field">
          <label className="field-label">Name (optional)</label>
          <input
            className="input"
            placeholder="Add your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
          />
        </div>
      </section>

      <section className="card">
        <div className="micro-label">Current stats</div>
        <div className="stats-list">
          <div className="stats-item">
            <span className="caption">Height</span>
            <span>{formatHeight(profile.height_cm, profile.units)}</span>
          </div>
          <div className="stats-item">
            <span className="caption">Weight</span>
            <span>{formatWeight(profile.weight_kg, profile.units)}</span>
          </div>
          <div className="stats-item">
            <span className="caption">Age</span>
            <span>{profile.age}</span>
          </div>
          <div className="stats-item">
            <span className="caption">Sex</span>
            <span>{profile.sex === 'male' ? 'Male' : 'Female'}</span>
          </div>
          <div className="stats-item">
            <span className="caption">Goal</span>
            <span>{GOAL_LABELS[profile.goal]}</span>
          </div>
          <div className="stats-item">
            <span className="caption">Activity</span>
            <span>{ACTIVITY_LABELS[profile.activity_level]}</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="micro-label">Daily targets</div>
        <div className="targets-row">
          <div className="summary-stat">
            <div className="summary-value">{target}</div>
            <div className="micro-label">kcal</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{profile.protein_target_g}g</div>
            <div className="micro-label">Protein</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{profile.carbs_target_g}g</div>
            <div className="micro-label">Carbs</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{profile.fat_target_g}g</div>
            <div className="micro-label">Fat</div>
          </div>
        </div>
        {profile.calorie_override !== null && (
          <p className="caption muted">
            Manual override active — calculated target is {profile.calorie_target} kcal.
          </p>
        )}
        <button className="btn btn-secondary btn-block" onClick={() => setEditing(true)} type="button">
          Edit Profile
        </button>
      </section>

      <section className="card">
        <div className="micro-label">Weight log</div>
        <div className="manual-row">
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder={`Log today's weight (${profile.units === 'imperial' ? 'lbs' : 'kg'})`}
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
          />
          <button className="btn btn-primary" onClick={logWeight} disabled={savingWeight} type="button">
            Save
          </button>
        </div>
        <WeightChart entries={weights} units={profile.units} />
      </section>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Edit profile</h2>
            <ProfileWizard
              initial={{
                sex: profile.sex,
                age: profile.age,
                height_cm: profile.height_cm,
                weight_kg: profile.weight_kg,
                goal: profile.goal,
                activity_level: profile.activity_level,
              }}
              defaultUnits={profile.units}
              submitLabel="Recalculate targets"
              onCancel={() => setEditing(false)}
              onComplete={async (input) => {
                const ok = await onSaveProfile(input);
                if (ok) setEditing(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
