import { describe, it, expect } from 'vitest';
import { calculateBMR, calculateTargets } from './calculations';
import type { ProfileInput } from '../types';

describe('calculateBMR', () => {
  it('computes the Mifflin-St Jeor BMR for a male', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateBMR('male', 80, 180, 30)).toBe(1780);
  });

  it('computes the Mifflin-St Jeor BMR for a female (subtracts 161 instead of adding 5)', () => {
    // 10*65 + 6.25*165 - 5*25 - 161 = 650 + 1031.25 - 125 - 161 = 1395.25
    expect(calculateBMR('female', 65, 165, 25)).toBeCloseTo(1395.25, 5);
  });
});

describe('calculateTargets', () => {
  const base: ProfileInput = {
    sex: 'male',
    age: 30,
    height_cm: 180,
    weight_kg: 80,
    goal: 'maintenance',
    activity_level: 'sedentary',
  };

  it('applies the sedentary activity multiplier and maintenance macro split', () => {
    // BMR 1780 * 1.2 (sedentary) = 2136 tdee; maintenance adjustment is 0
    expect(calculateTargets(base)).toEqual({
      calorie_target: 2136,
      protein_target_g: 160, // round(2136*0.3/4) = round(160.2)
      carbs_target_g: 240, // round(2136*0.45/4) = round(240.3)
      fat_target_g: 59, // round(2136*0.25/9) = round(59.33)
    });
  });

  it('subtracts 500 calories and applies the higher-protein cutting split', () => {
    const targets = calculateTargets({ ...base, goal: 'cutting' });
    expect(targets).toEqual({
      calorie_target: 1636, // 2136 - 500
      protein_target_g: 164, // round(1636*0.4/4) = round(163.6)
      carbs_target_g: 123, // round(1636*0.3/4) = round(122.7)
      fat_target_g: 55, // round(1636*0.3/9) = round(54.53)
    });
  });

  it('adds 300 calories and applies the carb-heavy bulking split, rounding the .5 carb boundary up', () => {
    const targets = calculateTargets({ ...base, goal: 'bulking' });
    expect(targets).toEqual({
      calorie_target: 2436, // 2136 + 300
      protein_target_g: 152, // round(2436*0.25/4) = round(152.25)
      carbs_target_g: 305, // round(2436*0.5/4) = round(304.5) -- exact .5 boundary, rounds up
      fat_target_g: 68, // round(2436*0.25/9) = round(67.67)
    });
  });
});
