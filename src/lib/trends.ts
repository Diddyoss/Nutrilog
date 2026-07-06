/** Chart period selection and weekly aggregation for trend charts. */

export type ChartPeriod = '1W' | '1M' | '3M' | 'ALL';

export const CHART_PERIODS: ChartPeriod[] = ['1W', '1M', '3M', 'ALL'];

/** Days of history each period covers; null = everything. */
export const PERIOD_DAYS: Record<ChartPeriod, number | null> = {
  '1W': 7,
  '1M': 30,
  '3M': 91,
  ALL: null,
};

/** Long periods show weekly means instead of daily points. */
export function isWeeklyPeriod(period: ChartPeriod): boolean {
  return period === '3M' || period === 'ALL';
}

export interface DatedValue {
  /** YYYY-MM-DD date key. */
  date: string;
  value: number;
}

/** Monday (ISO week start) of the week containing the given date key. */
export function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/**
 * Collapse daily points into weekly means keyed by each ISO week's Monday,
 * ordered ascending by week. Weeks with no points are omitted (no zero-fill —
 * the caller decides whether missing days count as zeroes by pre-filling).
 */
export function aggregateWeekly(points: DatedValue[]): DatedValue[] {
  const weeks = new Map<string, { sum: number; n: number }>();
  for (const p of points) {
    const wk = weekStartOf(p.date);
    const w = weeks.get(wk) ?? { sum: 0, n: 0 };
    w.sum += p.value;
    w.n += 1;
    weeks.set(wk, w);
  }
  return [...weeks.entries()]
    .map(([date, { sum, n }]) => ({ date, value: sum / n }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
