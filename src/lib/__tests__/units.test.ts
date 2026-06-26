import { describe, it, expect } from 'vitest';
import { kgToLbs, lbsToKg, cmToFtIn, ftInToCm, round1, formatWeight, formatHeight } from '../units';

describe('kgToLbs', () => {
  it('converts 1 kg to ~2.205 lbs', () => {
    expect(kgToLbs(1)).toBeCloseTo(2.20462);
  });

  it('converts 100 kg', () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462);
  });

  it('returns 0 for 0', () => {
    expect(kgToLbs(0)).toBe(0);
  });
});

describe('lbsToKg', () => {
  it('converts 1 lb to ~0.4536 kg', () => {
    expect(lbsToKg(1)).toBeCloseTo(0.453592);
  });

  it('roundtrip: kgToLbs then lbsToKg returns original', () => {
    expect(lbsToKg(kgToLbs(75))).toBeCloseTo(75);
  });

  it('roundtrip: lbsToKg then kgToLbs returns original', () => {
    expect(kgToLbs(lbsToKg(165))).toBeCloseTo(165);
  });
});

describe('cmToFtIn', () => {
  it('converts 180 cm to 5ft 11in', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, inch: 11 });
  });

  it('converts 152.4 cm to exactly 5ft 0in', () => {
    // 152.4 cm = 60 in = 5ft 0in
    expect(cmToFtIn(152.4)).toEqual({ ft: 5, inch: 0 });
  });

  it('wraps 11.5 rounded inches (12) to next foot', () => {
    // The inch===12 branch: find a value where rounding pushes inch to 12
    // e.g. 182.9 cm = 72.0079... in -> 6ft 0.0079in, rounds to 0 — skip
    // 182.88 cm = 72in exactly = 6ft 0in
    // Construct a case: ft=5, totalIn close to 71.5 -> 5ft 11.5in -> rounds to 12 -> becomes 6ft 0in
    // 71.5 * 2.54 = 181.61 cm
    const result = cmToFtIn(181.61);
    expect(result.inch).toBeLessThan(12);
    expect(result.ft).toBeGreaterThanOrEqual(5);
  });

  it('returns 0ft 0in for 0 cm', () => {
    expect(cmToFtIn(0)).toEqual({ ft: 0, inch: 0 });
  });
});

describe('ftInToCm', () => {
  it('converts 6ft 0in to 182.88 cm', () => {
    expect(ftInToCm(6, 0)).toBeCloseTo(182.88);
  });

  it('converts 5ft 11in to ~180.34 cm', () => {
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34);
  });

  it('roundtrip: cmToFtIn then ftInToCm is within 0.5 cm', () => {
    const { ft, inch } = cmToFtIn(175);
    expect(ftInToCm(ft, inch)).toBeCloseTo(175, 0);
  });

  it('returns 0 for 0ft 0in', () => {
    expect(ftInToCm(0, 0)).toBe(0);
  });
});

describe('round1', () => {
  it('rounds to 1 decimal place', () => {
    expect(round1(3.14159)).toBe(3.1);
  });

  it('rounds up at .05', () => {
    expect(round1(1.05)).toBeCloseTo(1.1, 1);
  });

  it('returns integer values unchanged', () => {
    expect(round1(42)).toBe(42);
  });

  it('handles 0', () => {
    expect(round1(0)).toBe(0);
  });

  it('handles negative numbers', () => {
    // Math.round rounds toward +∞, so -3.75 * 10 = -37.5 → rounds to -37 → -3.7
    expect(round1(-3.75)).toBe(-3.7);
  });
});

describe('formatWeight', () => {
  it('formats metric weight with kg suffix', () => {
    expect(formatWeight(75, 'metric')).toBe('75 kg');
  });

  it('formats imperial weight with lbs suffix', () => {
    expect(formatWeight(75, 'imperial')).toBe(`${round1(kgToLbs(75))} lbs`);
  });

  it('rounds metric weight to 1 decimal', () => {
    expect(formatWeight(75.123, 'metric')).toBe('75.1 kg');
  });

  it('rounds imperial weight to 1 decimal', () => {
    const result = formatWeight(70, 'imperial');
    expect(result).toMatch(/^\d+(\.\d)? lbs$/);
  });
});

describe('formatHeight', () => {
  it('formats metric height as cm', () => {
    expect(formatHeight(175, 'metric')).toBe('175 cm');
  });

  it('rounds metric height to nearest cm', () => {
    expect(formatHeight(175.6, 'metric')).toBe('176 cm');
  });

  it('formats imperial height as ft\'in"', () => {
    const { ft, inch } = cmToFtIn(180);
    expect(formatHeight(180, 'imperial')).toBe(`${ft}'${inch}"`);
  });

  it('formats 152.4 cm as 5\'0"', () => {
    expect(formatHeight(152.4, 'imperial')).toBe(`5'0"`);
  });
});
