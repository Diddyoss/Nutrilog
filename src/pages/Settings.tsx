import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '../components/Toast';
import { supabase } from '../lib/supabase';
import { todayStr } from '../lib/date';
import type { FoodEntry, Profile, Units } from '../types';

interface SettingsPageProps {
  profile: Profile;
  onUpdateProfile: (patch: Partial<Profile>) => Promise<boolean>;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function SettingsPage({ profile, onUpdateProfile }: SettingsPageProps) {
  const [override, setOverride] = useState(
    profile.calorie_override !== null ? String(profile.calorie_override) : ''
  );
  const [resetArmed, setResetArmed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!resetArmed) return;
    const t = setTimeout(() => setResetArmed(false), 3000);
    return () => clearTimeout(t);
  }, [resetArmed]);

  const setUnits = (units: Units) => {
    if (units !== profile.units) onUpdateProfile({ units });
  };

  const saveOverride = async () => {
    const trimmed = override.trim();
    if (!trimmed) {
      if (profile.calorie_override !== null) {
        const ok = await onUpdateProfile({ calorie_override: null });
        if (ok) toast('Using calculated target');
      }
      return;
    }
    const v = parseInt(trimmed, 10);
    if (!Number.isFinite(v) || v < 800 || v > 10000) {
      toast('Enter a target between 800 and 10000 kcal');
      return;
    }
    if (v !== profile.calorie_override) {
      const ok = await onUpdateProfile({ calorie_override: v });
      if (ok) toast('Calorie target updated');
    }
  };

  const resetToday = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResetArmed(false);
    const { error } = await supabase.from('food_log').delete().eq('log_date', todayStr());
    toast(error ? 'Could not reset log' : "Today's log cleared");
  };

  const exportCsv = async () => {
    setExporting(true);
    const { data, error } = await supabase
      .from('food_log')
      .select('log_date, meal, food_name, serving_size, calories, protein_g, carbs_g, fat_g, source, logged_at')
      .order('log_date', { ascending: true })
      .order('logged_at', { ascending: true });
    setExporting(false);

    if (error) {
      toast('Export failed');
      return;
    }

    const header = 'date,meal,food_name,serving_size,calories,protein_g,carbs_g,fat_g,source,logged_at';
    const rows = ((data ?? []) as FoodEntry[]).map((e) =>
      [e.log_date, e.meal, e.food_name, e.serving_size, e.calories, e.protein_g, e.carbs_g, e.fat_g, e.source, e.logged_at]
        .map(csvEscape)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrilog-export-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="micro-label">Settings</div>
        <h1 className="page-title">Preferences</h1>
      </header>

      <section className="card">
        <div className="field">
          <label className="field-label">Units</label>
          <div className="segmented">
            <button
              type="button"
              className={profile.units === 'metric' ? 'active' : ''}
              onClick={() => setUnits('metric')}
            >
              Metric
            </button>
            <button
              type="button"
              className={profile.units === 'imperial' ? 'active' : ''}
              onClick={() => setUnits('imperial')}
            >
              Imperial
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="field">
          <label className="field-label">Daily calorie goal override</label>
          <div className="manual-row">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              placeholder={`Calculated: ${profile.calorie_target} kcal`}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
            <button className="btn btn-primary" onClick={saveOverride} type="button">
              Save
            </button>
          </div>
          <p className="caption muted">Leave empty to use your calculated target.</p>
        </div>
      </section>

      <section className="card">
        <div className="micro-label">Day progress ring</div>
        <div className="grid-2">
          <div className="field">
            <label className="field-label">Wake time</label>
            <input
              className="input"
              type="time"
              value={profile.wake_time}
              onChange={(e) => onUpdateProfile({ wake_time: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label">Sleep time</label>
            <input
              className="input"
              type="time"
              value={profile.sleep_time}
              onChange={(e) => onUpdateProfile({ sleep_time: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="micro-label">Data</div>
        <button
          className={`btn ${resetArmed ? 'btn-primary' : 'btn-secondary'} btn-block`}
          onClick={resetToday}
          type="button"
        >
          {resetArmed ? "Tap again to clear today's log" : "Reset today's log"}
        </button>
        <button className="btn btn-secondary btn-block" onClick={exportCsv} disabled={exporting} type="button">
          <Download size={16} />
          {exporting ? 'Exporting…' : 'Export data as CSV'}
        </button>
      </section>
    </div>
  );
}
