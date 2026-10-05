import { describe, it, expect } from 'vitest';
import {
  burnedByDay,
  currentWeekDates,
  intakeByDay,
  lastNDates,
  latestPerDay,
  netCalories,
  netCalorieSeries,
  weekSummary,
} from '../stats';

describe('intakeByDay', () => {
  it('sums calories and protein per date, treating nulls as 0', () => {
    const m = intakeByDay([
      { log_date: '2026-10-01', calories: 500, protein_g: 30 },
      { log_date: '2026-10-01', calories: 300, protein_g: null },
      { log_date: '2026-10-02', calories: null, protein_g: 10 },
    ]);
    expect(m.get('2026-10-01')).toEqual({ kcal: 800, protein: 30 });
    expect(m.get('2026-10-02')).toEqual({ kcal: 0, protein: 10 });
  });
});

describe('burnedByDay', () => {
  it('sums burn per date', () => {
    const m = burnedByDay([
      { log_date: '2026-10-01', calories_burned: 200 },
      { log_date: '2026-10-01', calories_burned: 150 },
      { log_date: '2026-10-02', calories_burned: null },
    ]);
    expect(m.get('2026-10-01')).toBe(350);
    expect(m.get('2026-10-02')).toBe(0);
  });
});

describe('netCalories', () => {
  it('subtracts burn and clamps at zero', () => {
    expect(netCalories({ kcal: 2000, protein: 0 }, 300)).toBe(1700);
    expect(netCalories({ kcal: 200, protein: 0 }, 500)).toBe(0);
    expect(netCalories(undefined, undefined)).toBe(0);
  });
});

describe('lastNDates', () => {
  it('returns N dates ending today, oldest first', () => {
    expect(lastNDates(3, new Date(2026, 9, 2))).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('currentWeekDates', () => {
  it('runs Monday to Sunday', () => {
    // Sunday 4 Oct 2026 belongs to the week starting Monday 28 Sep.
    const week = currentWeekDates(new Date(2026, 9, 4));
    expect(week[0]).toBe('2026-09-28');
    expect(week[6]).toBe('2026-10-04');
  });

  it('starts on the same day when today is Monday', () => {
    expect(currentWeekDates(new Date(2026, 9, 5))[0]).toBe('2026-10-05');
  });

  it('always fits inside the 14-day trend window History fetches', () => {
    for (let d = 5; d <= 11; d++) {
      const today = new Date(2026, 9, d);
      expect(lastNDates(14, today)).toContain(currentWeekDates(today)[0]);
    }
  });
});

describe('netCalorieSeries', () => {
  it('zero-fills dates with nothing logged', () => {
    const intake = intakeByDay([{ log_date: '2026-10-02', calories: 1800, protein_g: 100 }]);
    const burned = burnedByDay([{ log_date: '2026-10-02', calories_burned: 300 }]);
    expect(netCalorieSeries(intake, burned, ['2026-10-01', '2026-10-02'])).toEqual([
      { date: '2026-10-01', calories: 0 },
      { date: '2026-10-02', calories: 1500 },
    ]);
  });
});

describe('weekSummary', () => {
  const week = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

  it('returns zeros when nothing is logged', () => {
    expect(weekSummary(new Map(), new Map(), week, 2000)).toEqual({
      avgCalories: 0,
      avgProtein: 0,
      bestDate: null,
      daysLogged: 0,
    });
  });

  it('averages net calories and protein over logged days only', () => {
    const intake = intakeByDay([
      { log_date: '2026-09-28', calories: 2000, protein_g: 120 },
      { log_date: '2026-09-30', calories: 1600, protein_g: 80 },
    ]);
    const burned = burnedByDay([{ log_date: '2026-09-28', calories_burned: 400 }]);
    const s = weekSummary(intake, burned, week, 2000);
    expect(s.daysLogged).toBe(2);
    expect(s.avgCalories).toBe(1600); // (1600 net + 1600) / 2
    expect(s.avgProtein).toBe(100);
  });

  it('picks the day closest to target without going over', () => {
    const intake = intakeByDay([
      { log_date: '2026-09-28', calories: 1500, protein_g: 0 },
      { log_date: '2026-09-29', calories: 1950, protein_g: 0 },
      { log_date: '2026-09-30', calories: 2400, protein_g: 0 }, // over target
    ]);
    expect(weekSummary(intake, new Map(), week, 2000).bestDate).toBe('2026-09-29');
  });

  it('counts activity: an over-target day brought under by exercise can be best', () => {
    const intake = intakeByDay([
      { log_date: '2026-09-28', calories: 1500, protein_g: 0 },
      { log_date: '2026-09-29', calories: 2300, protein_g: 0 },
    ]);
    const burned = burnedByDay([{ log_date: '2026-09-29', calories_burned: 350 }]); // net 1950
    expect(weekSummary(intake, burned, week, 2000).bestDate).toBe('2026-09-29');
  });

  it('ignores rows outside the week', () => {
    const intake = intakeByDay([{ log_date: '2026-09-27', calories: 1800, protein_g: 0 }]);
    expect(weekSummary(intake, new Map(), week, 2000).daysLogged).toBe(0);
  });

  it('breaks ties by the earliest day', () => {
    const intake = intakeByDay([
      { log_date: '2026-10-01', calories: 1800, protein_g: 0 },
      { log_date: '2026-09-28', calories: 1800, protein_g: 0 },
    ]);
    expect(weekSummary(intake, new Map(), week, 2000).bestDate).toBe('2026-09-28');
  });
});

describe('latestPerDay', () => {
  it('keeps the last weigh-in of each day, in date order', () => {
    const rows = [
      { id: 'a', log_date: '2026-10-01', weight_kg: 80 },
      { id: 'b', log_date: '2026-10-01', weight_kg: 79.6 },
      { id: 'c', log_date: '2026-10-02', weight_kg: 79.4 },
    ];
    expect(latestPerDay(rows).map((r) => r.id)).toEqual(['b', 'c']);
  });
});
