import { addDays, toDateStr } from './date';
import type { WeightEntry } from '../types';

export interface FoodRow {
  log_date: string;
  calories: number | null;
  protein_g: number | null;
}

export interface BurnRow {
  log_date: string;
  calories_burned: number | null;
}

export interface DayIntake {
  kcal: number;
  protein: number;
}

export interface WeekStats {
  avgCalories: number;
  avgProtein: number;
  /** Date (YYYY-MM-DD) closest to target without going over, or null. */
  bestDate: string | null;
  daysLogged: number;
}

export function intakeByDay(rows: FoodRow[]): Map<string, DayIntake> {
  const out = new Map<string, DayIntake>();
  for (const r of rows) {
    const d = out.get(r.log_date) ?? { kcal: 0, protein: 0 };
    d.kcal += r.calories ?? 0;
    d.protein += r.protein_g ?? 0;
    out.set(r.log_date, d);
  }
  return out;
}

export function burnedByDay(rows: BurnRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.log_date, (out.get(r.log_date) ?? 0) + (r.calories_burned ?? 0));
  return out;
}

/** Food minus activity for a day, never below zero — matches the calorie ring. */
export function netCalories(intake: DayIntake | undefined, burned: number | undefined): number {
  return Math.max(0, (intake?.kcal ?? 0) - (burned ?? 0));
}

/** The `count` dates ending today, oldest first. */
export function lastNDates(count: number, today: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => toDateStr(addDays(today, i - (count - 1))));
}

/** Monday–Sunday of the week containing `today`. */
export function currentWeekDates(today: Date = new Date()): string[] {
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => toDateStr(addDays(monday, i)));
}

/** Net calories per date, zero-filled so the chart has no gaps. */
export function netCalorieSeries(
  intake: Map<string, DayIntake>,
  burned: Map<string, number>,
  dates: string[]
): { date: string; calories: number }[] {
  return dates.map((date) => ({ date, calories: netCalories(intake.get(date), burned.get(date)) }));
}

/** Averages over days with food logged; earliest day wins ties for best. */
export function weekSummary(
  intake: Map<string, DayIntake>,
  burned: Map<string, number>,
  weekDates: string[],
  target: number
): WeekStats {
  let kcal = 0;
  let protein = 0;
  let days = 0;
  let bestDate: string | null = null;
  let bestPct = -1;
  for (const date of weekDates) {
    const day = intake.get(date);
    if (!day) continue;
    const net = netCalories(day, burned.get(date));
    kcal += net;
    protein += day.protein;
    days++;
    const pct = target > 0 ? net / target : 0;
    if (pct <= 1 && pct > bestPct) {
      bestPct = pct;
      bestDate = date;
    }
  }
  if (days === 0) return { avgCalories: 0, avgProtein: 0, bestDate: null, daysLogged: 0 };
  return {
    avgCalories: Math.round(kcal / days),
    avgProtein: Math.round(protein / days),
    bestDate,
    daysLogged: days,
  };
}

/** Keep the last weigh-in per day. Rows must be ordered by date, then time. */
export function latestPerDay(rows: WeightEntry[]): WeightEntry[] {
  const byDay = new Map<string, WeightEntry>();
  for (const r of rows) byDay.set(r.log_date, r);
  return [...byDay.values()];
}
