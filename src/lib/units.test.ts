import { describe, it, expect } from 'vitest';
import { kgToLbs, lbsToKg, cmToFtIn, ftInToCm, round1, formatWeight, formatHeight } from './units';

describe('kgToLbs / lbsToKg', () => {
  it('converts kg to lbs using the standard factor', () => {
    expect(kgToLbs(1)).toBeCloseTo(2.20462, 5);
  });

  it('round-trips lbsToKg(kgToLbs(x)) back to x', () => {
    expect(lbsToKg(kgToLbs(70))).toBeCloseTo(70, 5);
  });
});

describe('cmToFtIn', () => {
  it('converts a plain height with no rollover', () => {
    expect(cmToFtIn(170)).toEqual({ ft: 5, inch: 7 });
  });

  it('rolls over into the next foot when the rounded inches hit 12', () => {
    // 181.864cm = 71.6 total inches -> floor(71.6/12)=5ft, round(11.6)=12in,
    // which the naive implementation would report as "5'12"" instead of "6'0""
    expect(cmToFtIn(181.864)).toEqual({ ft: 6, inch: 0 });
  });
});

describe('ftInToCm', () => {
  it('converts feet+inches back to centimetres', () => {
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34, 5);
  });
});

describe('round1', () => {
  it('rounds to one decimal place', () => {
    expect(round1(154.3234)).toBe(154.3);
  });

  it('rounds a positive .05-at-the-10ths exact boundary up', () => {
    expect(round1(2.25)).toBe(2.3);
  });

  it('rounds a negative exact boundary toward positive infinity (Math.round asymmetry)', () => {
    // Math.round(-2.25*10)/10 = Math.round(-22.5)/10 = -22/10 = -2.2, not -2.3 --
    // a naive "rounds to nearest" assumption would expect symmetric behavior here
    expect(round1(-2.25)).toBe(-2.2);
  });
});

describe('formatWeight', () => {
  it('formats metric weight in kg', () => {
    expect(formatWeight(70, 'metric')).toBe('70 kg');
  });

  it('formats imperial weight converted to lbs, rounded to 1 decimal', () => {
    expect(formatWeight(70, 'imperial')).toBe('154.3 lbs');
  });
});

describe('formatHeight', () => {
  it('formats metric height in whole cm', () => {
    expect(formatHeight(180, 'metric')).toBe('180 cm');
  });

  it('formats imperial height as feet-and-inches', () => {
    expect(formatHeight(180, 'imperial')).toBe(`5'11"`);
  });
});
