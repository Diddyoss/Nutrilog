import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayView } from '../components/DayView';
import { supabase } from '../lib/supabase';
import { addDays, formatShortDate, toDateStr, todayStr, weekdayShort } from '../lib/date';
import type { Profile } from '../types';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface WeekStats {
  avgCalories: number;
  avgProtein: number;
  bestDay: string | null;
  daysLogged: number;
}

export function History({ profile }: { profile: Profile }) {
  const today = todayStr();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState(today);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const loadWeek = useCallback(async () => {
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    const sunday = addDays(monday, 6);
    const target = profile.calorie_override ?? profile.calorie_target;

    const { data } = await supabase
      .from('food_log')
      .select('log_date, calories, protein_g')
      .gte('log_date', toDateStr(monday))
      .lte('log_date', toDateStr(sunday));

    const byDay = new Map<string, { kcal: number; protein: number }>();
    for (const row of (data ?? []) as { log_date: string; calories: number; protein_g: number | null }[]) {
      const day = byDay.get(row.log_date) ?? { kcal: 0, protein: 0 };
      day.kcal += row.calories ?? 0;
      day.protein += row.protein_g ?? 0;
      byDay.set(row.log_date, day);
    }

    const daysLogged = byDay.size;
    if (daysLogged === 0) {
      setWeekStats({ avgCalories: 0, avgProtein: 0, bestDay: null, daysLogged: 0 });
      return;
    }

    let totalKcal = 0;
    let totalProtein = 0;
    let bestDay: string | null = null;
    let bestPct = -1;
    for (const [date, day] of byDay) {
      totalKcal += day.kcal;
      totalProtein += day.protein;
      const pct = target > 0 ? day.kcal / target : 0;
      if (pct <= 1 && pct > bestPct) {
        bestPct = pct;
        bestDay = date;
      }
    }

    setWeekStats({
      avgCalories: Math.round(totalKcal / daysLogged),
      avgProtein: Math.round(totalProtein / daysLogged),
      bestDay: bestDay ? weekdayShort(bestDay) : null,
      daysLogged,
    });
  }, [profile]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth, refreshKey]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek, refreshKey]);

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
        canAdd={selected === today}
        onChanged={() => setRefreshKey((k) => k + 1)}
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
            <div className="summary-value">{weekStats?.bestDay ?? '—'}</div>
            <div className="micro-label">Best day</div>
          </div>
          <div className="summary-stat">
            <div className="summary-value">{weekStats ? `${weekStats.daysLogged} / 7` : '—'}</div>
            <div className="micro-label">Days logged</div>
          </div>
        </div>
      </section>
    </div>
  );
}
