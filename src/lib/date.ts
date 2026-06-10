import type { Meal } from '../types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date as YYYY-MM-DD (never UTC — log dates follow the user's clock). */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function weekdayShort(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

export function defaultMealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 5) return 'snacks';
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snacks';
}

function parseTimeToMinutes(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Fraction of the waking day (wake → sleep) elapsed right now, clamped 0–1. */
export function dayProgress(wakeTime: string, sleepTime: string): number {
  const wake = parseTimeToMinutes(wakeTime) ?? 7 * 60;
  const sleep = parseTimeToMinutes(sleepTime) ?? 23 * 60;
  if (sleep <= wake) return 0;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return Math.min(1, Math.max(0, (mins - wake) / (sleep - wake)));
}
