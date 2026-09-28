import { describe, it, expect } from 'vitest';
import {
  calculateBMR,
  calculateTargets,
  ACTIVITY_MULTIPLIERS,
  isValidWeightKg,
  toProfileInput,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
} from '../calculations';
import type { Profile, ProfileInput } from '../../types';

describe('calculateBMR', () => {
  it('uses Mifflin-St Jeor formula for males (+5)', () => {
    // base = 10*80 + 6.25*175 - 5*30 = 800 + 1093.75 - 150 = 1743.75 + 5 = 1748.75
    expect(calculateBMR('male', 80, 175, 30)).toBeCloseTo(1748.75);
  });

  it('uses Mifflin-St Jeor formula for females (-161)', () => {
    // base = 10*60 + 6.25*165 - 5*25 = 600 + 1031.25 - 125 = 1506.25 - 161 = 1345.25
    expect(calculateBMR('female', 60, 165, 25)).toBeCloseTo(1345.25);
  });

  it('returns higher BMR for male vs female with identical inputs', () => {
    expect(calculateBMR('male', 70, 170, 30)).toBeGreaterThan(calculateBMR('female', 70, 170, 30));
  });

  it('difference between male and female is exactly 166', () => {
    const diff = calculateBMR('male', 70, 170, 30) - calculateBMR('female', 70, 170, 30);
    expect(diff).toBeCloseTo(166);
  });

  it('BMR increases with weight', () => {
    expect(calculateBMR('male', 90, 175, 30)).toBeGreaterThan(calculateBMR('male', 70, 175, 30));
  });

  it('BMR increases with height', () => {
    expect(calculateBMR('male', 80, 185, 30)).toBeGreaterThan(calculateBMR('male', 80, 165, 30));
  });

  it('BMR decreases with age', () => {
    expect(calculateBMR('male', 80, 175, 40)).toBeLessThan(calculateBMR('male', 80, 175, 30));
  });
});

describe('calculateTargets', () => {
  const baseInput: ProfileInput = {
    sex: 'male',
    age: 30,
    height_cm: 175,
    weight_kg: 80,
    goal: 'maintenance',
    activity_level: 'sedentary',
  };

  it('calorie_target is TDEE rounded for maintenance', () => {
    const bmr = calculateBMR('male', 80, 175, 30);
    const tdee = bmr * ACTIVITY_MULTIPLIERS.sedentary;
    const { calorie_target } = calculateTargets(baseInput);
    expect(calorie_target).toBe(Math.round(tdee));
  });

  it('cutting target is 500 kcal below maintenance', () => {
    const maintenance = calculateTargets(baseInput).calorie_target;
    const cutting = calculateTargets({ ...baseInput, goal: 'cutting' }).calorie_target;
    expect(maintenance - cutting).toBe(500);
  });

  it('bulking target is 300 kcal above maintenance', () => {
    const maintenance = calculateTargets(baseInput).calorie_target;
    const bulking = calculateTargets({ ...baseInput, goal: 'bulking' }).calorie_target;
    expect(bulking - maintenance).toBe(300);
  });

  it('protein_target_g uses 4 kcal/g conversion', () => {
    const { calorie_target, protein_target_g } = calculateTargets(baseInput);
    // maintenance split: 30% protein / 4 kcal per gram
    expect(protein_target_g).toBe(Math.round((calorie_target * 0.3) / 4));
  });

  it('carbs_target_g uses 4 kcal/g conversion', () => {
    const { calorie_target, carbs_target_g } = calculateTargets(baseInput);
    // maintenance split: 45% carbs / 4 kcal per gram
    expect(carbs_target_g).toBe(Math.round((calorie_target * 0.45) / 4));
  });

  it('fat_target_g uses 9 kcal/g conversion', () => {
    const { calorie_target, fat_target_g } = calculateTargets(baseInput);
    // maintenance split: 25% fat / 9 kcal per gram
    expect(fat_target_g).toBe(Math.round((calorie_target * 0.25) / 9));
  });

  it('athlete multiplier produces higher calories than sedentary', () => {
    const sedentary = calculateTargets(baseInput).calorie_target;
    const athlete = calculateTargets({ ...baseInput, activity_level: 'athlete' }).calorie_target;
    expect(athlete).toBeGreaterThan(sedentary);
  });

  it('cutting uses higher protein ratio (0.4) than maintenance (0.3)', () => {
    const cutting = calculateTargets({ ...baseInput, goal: 'cutting' });
    const maintenance = calculateTargets(baseInput);
    // Even though cutting has fewer calories, protein fraction is higher
    const cuttingProteinFraction = (cutting.protein_target_g * 4) / cutting.calorie_target;
    const mainProteinFraction = (maintenance.protein_target_g * 4) / maintenance.calorie_target;
    expect(cuttingProteinFraction).toBeGreaterThan(mainProteinFraction);
  });
});

describe('isValidWeightKg', () => {
  it('accepts the bounds and values between them', () => {
    expect(isValidWeightKg(WEIGHT_KG_MIN)).toBe(true);
    expect(isValidWeightKg(72.4)).toBe(true);
    expect(isValidWeightKg(WEIGHT_KG_MAX)).toBe(true);
  });

  it('rejects typos outside the range', () => {
    expect(isValidWeightKg(7.2)).toBe(false); // missing digit
    expect(isValidWeightKg(724)).toBe(false); // extra digit
  });

  it('rejects non-finite values', () => {
    expect(isValidWeightKg(NaN)).toBe(false);
    expect(isValidWeightKg(Infinity)).toBe(false);
  });
});

describe('toProfileInput', () => {
  const profile: Profile = {
    id: 'p1',
    user_id: 'u1',
    name: 'Sam',
    sex: 'female',
    age: 34,
    height_cm: 168,
    weight_kg: 64.5,
    goal: 'cutting',
    activity_level: 'moderate',
    calorie_target: 1800,
    protein_target_g: 180,
    carbs_target_g: 135,
    fat_target_g: 60,
    calorie_override: 1700,
    units: 'metric',
    wake_time: '07:00',
    sleep_time: '23:00',
  };

  it('keeps exactly the stats targets are calculated from', () => {
    expect(toProfileInput(profile)).toEqual({
      sex: 'female',
      age: 34,
      height_cm: 168,
      weight_kg: 64.5,
      goal: 'cutting',
      activity_level: 'moderate',
    });
  });

  it('a new weight changes the calculated calorie target', () => {
    const before = calculateTargets(toProfileInput(profile)).calorie_target;
    const after = calculateTargets({ ...toProfileInput(profile), weight_kg: 60.5 }).calorie_target;
    // Mifflin-St Jeor: 10 kcal/kg BMR x 1.55 (moderate) x 4 kg = 62 kcal
    expect(before - after).toBe(62);
  });
});
