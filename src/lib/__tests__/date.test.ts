import { describe, it, expect, vi, afterEach } from 'vitest';
import { toDateStr, addDays, defaultMealForNow, dayProgress } from '../date';

afterEach(() => {
  vi.useRealTimers();
});

describe('toDateStr', () => {
  it('formats a date as YYYY-MM-DD using local time', () => {
    const d = new Date(2024, 0, 5); // Jan 5 2024 local
    expect(toDateStr(d)).toBe('2024-01-05');
  });

  it('zero-pads month and day', () => {
    const d = new Date(2024, 2, 9); // Mar 9
    expect(toDateStr(d)).toBe('2024-03-09');
  });

  it('handles December (month 11)', () => {
    const d = new Date(2024, 11, 31);
    expect(toDateStr(d)).toBe('2024-12-31');
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const d = new Date(2024, 0, 10);
    expect(toDateStr(addDays(d, 5))).toBe('2024-01-15');
  });

  it('subtracts days with negative value', () => {
    const d = new Date(2024, 0, 10);
    expect(toDateStr(addDays(d, -3))).toBe('2024-01-07');
  });

  it('crosses month boundary', () => {
    const d = new Date(2024, 0, 30); // Jan 30
    expect(toDateStr(addDays(d, 3))).toBe('2024-02-02');
  });

  it('crosses year boundary', () => {
    const d = new Date(2024, 11, 31); // Dec 31 2024
    expect(toDateStr(addDays(d, 1))).toBe('2025-01-01');
  });

  it('does not mutate the original date', () => {
    const d = new Date(2024, 0, 10);
    const original = d.getTime();
    addDays(d, 5);
    expect(d.getTime()).toBe(original);
  });

  it('adding 0 days returns the same date', () => {
    const d = new Date(2024, 5, 15);
    expect(toDateStr(addDays(d, 0))).toBe('2024-06-15');
  });
});

describe('defaultMealForNow', () => {
  function setHour(hour: number) {
    const now = new Date();
    now.setHours(hour, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);
  }

  it('returns snacks before 5am (hour 0)', () => {
    setHour(0);
    expect(defaultMealForNow()).toBe('snacks');
  });

  it('returns snacks at 4am', () => {
    setHour(4);
    expect(defaultMealForNow()).toBe('snacks');
  });

  it('returns breakfast at 5am', () => {
    setHour(5);
    expect(defaultMealForNow()).toBe('breakfast');
  });

  it('returns breakfast at 10am', () => {
    setHour(10);
    expect(defaultMealForNow()).toBe('breakfast');
  });

  it('returns lunch at 11am', () => {
    setHour(11);
    expect(defaultMealForNow()).toBe('lunch');
  });

  it('returns lunch at 14 (2pm)', () => {
    setHour(14);
    expect(defaultMealForNow()).toBe('lunch');
  });

  it('returns dinner at 15 (3pm)', () => {
    setHour(15);
    expect(defaultMealForNow()).toBe('dinner');
  });

  it('returns dinner at 20 (8pm)', () => {
    setHour(20);
    expect(defaultMealForNow()).toBe('dinner');
  });

  it('returns snacks at 21 (9pm)', () => {
    setHour(21);
    expect(defaultMealForNow()).toBe('snacks');
  });

  it('returns snacks at 23 (11pm)', () => {
    setHour(23);
    expect(defaultMealForNow()).toBe('snacks');
  });
});

describe('dayProgress', () => {
  function setTime(hour: number, minute = 0) {
    const now = new Date();
    now.setHours(hour, minute, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(now);
  }

  it('returns 0 before wake time', () => {
    setTime(6, 0); // before 7:00 wake
    expect(dayProgress('7:00', '23:00')).toBe(0);
  });

  it('returns 0 exactly at wake time', () => {
    setTime(7, 0);
    expect(dayProgress('7:00', '23:00')).toBe(0);
  });

  it('returns 1 at or after sleep time', () => {
    setTime(23, 0);
    expect(dayProgress('7:00', '23:00')).toBe(1);
  });

  it('returns 1 after sleep time', () => {
    setTime(23, 30);
    expect(dayProgress('7:00', '23:00')).toBe(1);
  });

  it('returns 0.5 exactly at the midpoint', () => {
    // wake 8:00, sleep 22:00 -> midpoint at 15:00
    setTime(15, 0);
    expect(dayProgress('8:00', '22:00')).toBeCloseTo(0.5);
  });

  it('returns a value between 0 and 1 during the day', () => {
    setTime(12, 0);
    const p = dayProgress('7:00', '23:00');
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it('returns 0 when sleep <= wake (invalid window)', () => {
    setTime(12, 0);
    expect(dayProgress('23:00', '7:00')).toBe(0);
  });

  it('falls back to 7:00 wake for invalid time string', () => {
    setTime(6, 0); // before fallback 7:00 wake
    expect(dayProgress('bad', '23:00')).toBe(0);
  });

  it('falls back to 23:00 sleep for invalid time string', () => {
    setTime(23, 30); // after fallback 23:00 sleep
    expect(dayProgress('7:00', 'bad')).toBe(1);
  });
});
