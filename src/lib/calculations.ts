import type { ActivityLevel, Goal, ProfileInput, Sex, Targets } from '../types';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  very: 'Very Active',
  athlete: 'Athlete',
};

export const GOAL_LABELS: Record<Goal, string> = {
  cutting: 'Cutting',
  maintenance: 'Maintenance',
  bulking: 'Bulking',
};

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  cutting: -500,
  maintenance: 0,
  bulking: 300,
};

const MACRO_SPLITS: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  cutting: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  maintenance: { protein: 0.3, carbs: 0.45, fat: 0.25 },
  bulking: { protein: 0.25, carbs: 0.5, fat: 0.25 },
};

export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function calculateTargets(input: ProfileInput): Targets {
  const bmr = calculateBMR(input.sex, input.weight_kg, input.height_cm, input.age);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[input.activity_level];
  const calories = Math.round(tdee + GOAL_ADJUSTMENTS[input.goal]);
  const split = MACRO_SPLITS[input.goal];
  return {
    calorie_target: calories,
    protein_target_g: Math.round((calories * split.protein) / 4),
    carbs_target_g: Math.round((calories * split.carbs) / 4),
    fat_target_g: Math.round((calories * split.fat) / 9),
  };
}
