import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toDateStr,
  addDays,
  defaultMealForNow,
  dayProgress,
  formatShortDate,
  weekdayShort,
} from './date';

// formatShortDate/weekdayShort/formatLongDate use `toLocaleDateString(undefined, ...)`,
// i.e. the runner's default locale/timezone. This suite runs green under this
// sandbox's en-US/UTC default (confirmed via Intl.DateTimeFormat().resolvedOptions());
// a CI runner with a different default locale could format weekday/month names
// differently. Flagged as a real environment coupling, not asserted away.

describe('toDateStr', () => {
  it('pads single-digit months and days with a leading zero', () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('formats double-digit months and days without extra padding', () => {
    expect(toDateStr(new Date(2026, 10, 23))).toBe('2026-11-23');
  });
});

describe('addDays', () => {
  it('rolls over into the next month at a month boundary', () => {
    expect(toDateStr(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });

  it('rolls back into the previous year with a negative offset', () => {
    expect(toDateStr(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });
});

describe('defaultMealForNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns snacks just before the breakfast boundary (04:59)', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 4, 59));
    expect(defaultMealForNow()).toBe('snacks');
  });

  it('returns breakfast at the 05:00 boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 5, 0));
    expect(defaultMealForNow()).toBe('breakfast');
  });

  it('returns lunch at the 11:00 boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 11, 0));
    expect(defaultMealForNow()).toBe('lunch');
  });

  it('returns dinner at the 15:00 boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0));
    expect(defaultMealForNow()).toBe('dinner');
  });

  it('returns snacks again at the 21:00 boundary', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 21, 0));
    expect(defaultMealForNow()).toBe('snacks');
  });
});

describe('dayProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0.5 at the midpoint between wake and sleep', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0));
    expect(dayProgress('07:00', '23:00')).toBeCloseTo(0.5, 5);
  });

  it('returns 0 exactly at wake time', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 7, 0));
    expect(dayProgress('07:00', '23:00')).toBe(0);
  });

  it('clamps to 0 before wake time rather than going negative', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 5, 0));
    expect(dayProgress('07:00', '23:00')).toBe(0);
  });

  it('clamps to 1 after sleep time rather than exceeding 1', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 30));
    expect(dayProgress('07:00', '23:00')).toBe(1);
  });

  it('returns 0 when sleep time is not after wake time (misconfigured profile)', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0));
    expect(dayProgress('23:00', '07:00')).toBe(0);
  });

  it('falls back to the 07:00-23:00 default window when times are unparseable', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 15, 0));
    expect(dayProgress('not-a-time', 'also-not-a-time')).toBeCloseTo(0.5, 5);
  });
});

describe('formatShortDate / weekdayShort', () => {
  it('formats an ISO date string as a short weekday + day + month', () => {
    expect(formatShortDate('2026-07-04')).toBe('Sat, Jul 4');
  });

  it('returns just the short weekday name for the same date', () => {
    expect(weekdayShort('2026-07-04')).toBe('Sat');
  });
});
