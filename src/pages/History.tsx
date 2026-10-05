import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayView } from '../components/DayView';
import { CaloriesChart } from '../components/CaloriesChart';
import { WeightChart } from '../components/WeightChart';
import { useWeightLog } from '../hooks/useWeightLog';
import { supabase } from '../lib/supabase';
import { formatShortDate, toDateStr, todayStr, weekdayShort } from '../lib/date';
import {
  burnedByDay,
  currentWeekDates,
  intakeByDay,
  lastNDates,
  netCalorieSeries,
  weekSummary,
} from '../lib/stats';
import type { BurnRow, FoodRow, WeekStats } from '../lib/stats';
import type { Profile } from '../types';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const TREND_DAYS = 14;

interface HistoryProps {
  profile: Profile;
  /** The nav + asked to log food — for the selected day while on History. */
  addRequested: boolean;
  onAddHandled: () => void;
}

export function History({ profile, addRequested, onAddHandled }: HistoryProps) {
  const today = todayStr();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);
  const [dailyCalories, setDailyCalories] = useState<{ date: string; calories: number }[]>([]);
  const { weights } = useWeightLog(30);
  const [refreshKey, setRefreshKey] = useState(0);

  const calTarget = profile.calorie_override ?? profile.calorie_target;

  const loadMonth = useCallback(async () => {
    const from = toDateStr(month);
    const to = toDateStr(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const { data } = await supabase
      .from('food_log')
      .select('log_date')
      .gte('log_date', from)
      .lte('log_date', to);
    setLoggedDates(new Set((data ?? []).map((d: { log_date: string }) => d.log_date)));
  }, [month]);

  // One fetch of the last 14 days feeds both the trend chart and this week's
  // stats (this week's Monday is never more than 6 days back). Activity is
  // subtracted to match the net calories shown on the ring; it fails soft if
  // the activity table doesn't exist yet.
  const loadStats = useCallback(async () => {
    const dates = lastNDates(TREND_DAYS);
    const [{ data: food }, { data: activity }] = await Promise.all([
      supabase.from('food_log').select('log_date, calories, protein_g').gte('log_date', dates[0]),
      supabase.from('activity_log').select('log_date, calories_burned').gte('log_date', dates[0]),
    ]);
    const intake = intakeByDay((food ?? []) as FoodRow[]);
    const burned = burnedByDay((activity ?? []) as BurnRow[]);
    setDailyCalories(netCalorieSeries(intake, burned, dates));
    setWeekStats(weekSummary(intake, burned, currentWeekDates(), calTarget));
  }, [calTarget]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth, refreshKey]);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-start grid
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(toDateStr(new Date(month.getFullYear(), month.getMonth(), d)));
    }
    return out;
  }, [month]);

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const isCurrentMonth =
    month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();

  return (
    <div className="page">
      <header className="page-header">
        <div className="micro-label">History</div>
        <h1 className="page-title">{formatShortDate(selected)}</h1>
      </header>

      <section className="card calendar">
        <div className="cal-header">
          <button
            className="icon-btn"
            aria-label="Previous month"
            type="button"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="cal-month">{monthLabel}</span>
          <button
            className="icon-btn"
            aria-label="Next month"
            type="button"
            disabled={isCurrentMonth}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="cal-grid">
          {DOW.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells.map((date, i) =>
            date === null ? (
              <div key={`blank-${i}`} />
            ) : (
              <button
                key={date}
                type="button"
                className={`cal-day${date === selected ? ' selected' : ''}${date === today ? ' today' : ''}`}
                disabled={date > today}
                onClick={() => setSelected(date)}
              >
                <span>{parseInt(date.slice(8), 10)}</span>
                {loggedDates.has(date) && <span className="cal-dot" />}
              </button>
            )
          )}
        </div>
      </section>

      <DayView
        key={selected}
        date={selected}
        profile={profile}
        canAdd={selected <= today}
        onChanged={() => setRefreshKey((k) => k + 1)}
        addRequested={addRequested}
        onAddHandled={onAddHandled}
      />

      <section className="card">
        <div className="micro-label">This week</div>
        <div className="summary-grid">
          <div className="summary-stat">
            <div className="summary-value">{weekStats ? weekStats.avgCalories : '—'}</div>
            <div className="micro-label">Avg calories</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{weekStats ? `${weekStats.avgProtein}g` : '—'}</div>
            <div className="micro-label">Avg protein</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{weekStats?.bestDate ? weekdayShort(weekStats.bestDate) : '—'}</div>
            <div className="micro-label">Best day</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{weekStats ? `${weekStats.daysLogged} / 7` : '—'}</div>
            <div className="micro-label">Days logged</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="micro-label">Net calorie trend · 14 days</div>
        <CaloriesChart days={dailyCalories} target={calTarget} />
      </section>

      <section className="card">
        <div className="micro-label">Weight trend · 30 days</div>
        <WeightChart entries={weights} units={profile.units} />
      </section>
    </div>
  );
}
