import { describe, expect, it } from 'vitest';
import { aggregateWeekly, isWeeklyPeriod, weekStartOf } from './trends';

describe('weekStartOf', () => {
  it('maps a Saturday to the preceding Monday', () => {
    // 2026-07-04 is a Saturday; that ISO week starts Monday 2026-06-29.
    expect(weekStartOf('2026-07-04')).toBe('2026-06-29');
  });

  it('maps a Monday to itself', () => {
    expect(weekStartOf('2026-06-29')).toBe('2026-06-29');
  });

  it('maps a Sunday to the Monday six days earlier', () => {
    // 2026-07-05 is a Sunday.
    expect(weekStartOf('2026-07-05')).toBe('2026-06-29');
  });

  it('crosses a year boundary backwards', () => {
    // 2026-01-01 is a Thursday; its week starts Monday 2025-12-29.
    expect(weekStartOf('2026-01-01')).toBe('2025-12-29');
  });
});

describe('aggregateWeekly', () => {
  it('averages points within the same week', () => {
    const out = aggregateWeekly([
      { date: '2026-06-29', value: 1000 }, // Mon
      { date: '2026-07-01', value: 2000 }, // Wed
      { date: '2026-07-05', value: 3000 }, // Sun — same ISO week
    ]);
    expect(out).toEqual([{ date: '2026-06-29', value: 2000 }]);
  });

  it('keeps separate weeks separate and sorts ascending', () => {
    const out = aggregateWeekly([
      { date: '2026-07-07', value: 10 }, // week of 07-06
      { date: '2026-06-30', value: 20 }, // week of 06-29
    ]);
    expect(out).toEqual([
      { date: '2026-06-29', value: 20 },
      { date: '2026-07-06', value: 10 },
    ]);
  });

  it('returns empty for empty input', () => {
    expect(aggregateWeekly([])).toEqual([]);
  });

  it('a single point becomes its own weekly mean', () => {
    expect(aggregateWeekly([{ date: '2026-03-31', value: 7 }])).toEqual([
      { date: '2026-03-30', value: 7 },
    ]);
  });

  it('averages across a year boundary into the old year week', () => {
    const out = aggregateWeekly([
      { date: '2025-12-29', value: 1 }, // Mon
      { date: '2026-01-02', value: 3 }, // Fri, same week
    ]);
    expect(out).toEqual([{ date: '2025-12-29', value: 2 }]);
  });
});

describe('isWeeklyPeriod', () => {
  it('is weekly only for 3M and ALL', () => {
    expect(isWeeklyPeriod('1W')).toBe(false);
    expect(isWeeklyPeriod('1M')).toBe(false);
    expect(isWeeklyPeriod('3M')).toBe(true);
    expect(isWeeklyPeriod('ALL')).toBe(true);
  });
});
