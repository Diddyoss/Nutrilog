import type { FoodEntry, NutrientKey, NutrientValues, SupplementEntry } from '../types';

export type NutrientGroup = 'vitamins' | 'minerals' | 'fats' | 'fatty_acids';

export const NUTRIENT_GROUPS: Record<NutrientGroup, NutrientKey[]> = {
  vitamins: [
    'vitamin_a_mcg',
    'vitamin_c_mg',
    'vitamin_d_mcg',
    'vitamin_e_mg',
    'vitamin_k_mcg',
    'vitamin_b6_mg',
    'vitamin_b12_mcg',
    'folate_mcg',
  ],
  minerals: ['calcium_mg', 'iron_mg', 'magnesium_mg', 'potassium_mg', 'zinc_mg', 'sodium_mg'],
  fats: ['saturated_fat_g', 'unsaturated_fat_g', 'trans_fat_g', 'fiber_g'],
  fatty_acids: ['omega_3_g', 'omega_6_g', 'monounsaturated_fat_g', 'polyunsaturated_fat_g'],
};

export const GROUP_LABELS: Record<NutrientGroup, string> = {
  vitamins: 'Vitamins',
  minerals: 'Minerals',
  fats: 'Fat Breakdown',
  fatty_acids: 'Fatty Acids',
};

export const ALL_NUTRIENT_KEYS: NutrientKey[] = [
  ...NUTRIENT_GROUPS.vitamins,
  ...NUTRIENT_GROUPS.minerals,
  ...NUTRIENT_GROUPS.fats,
  ...NUTRIENT_GROUPS.fatty_acids,
];

/** Vitamins, minerals, and the supplement-relevant omega fatty acids (fish oil). */
export const SUPPLEMENT_KEYS: NutrientKey[] = [
  ...NUTRIENT_GROUPS.vitamins,
  ...NUTRIENT_GROUPS.minerals,
  'omega_3_g',
  'omega_6_g',
];

export interface NutrientMeta {
  label: string;
  unit: 'mg' | 'mcg' | 'g';
  /** Standard adult daily reference intake (fats use reference/limit values). */
  rdi: number;
  /** Fixed distinct hue, consistent across sessions. */
  color: string;
}

export const NUTRIENT_META: Record<NutrientKey, NutrientMeta> = {
  // Vitamins
  vitamin_a_mcg: { label: 'Vitamin A', unit: 'mcg', rdi: 900, color: '#ff8c42' },
  vitamin_c_mg: { label: 'Vitamin C', unit: 'mg', rdi: 90, color: '#ffd23f' },
  vitamin_d_mcg: { label: 'Vitamin D', unit: 'mcg', rdi: 20, color: '#a3e048' },
  vitamin_e_mg: { label: 'Vitamin E', unit: 'mg', rdi: 15, color: '#48d97e' },
  vitamin_k_mcg: { label: 'Vitamin K', unit: 'mcg', rdi: 120, color: '#3fb6c9' },
  vitamin_b6_mg: { label: 'Vitamin B6', unit: 'mg', rdi: 1.3, color: '#4c9aff' },
  vitamin_b12_mcg: { label: 'Vitamin B12', unit: 'mcg', rdi: 2.4, color: '#8a7dff' },
  folate_mcg: { label: 'Folate', unit: 'mcg', rdi: 400, color: '#c86dd7' },
  // Minerals
  calcium_mg: { label: 'Calcium', unit: 'mg', rdi: 1000, color: '#e6e6e6' },
  iron_mg: { label: 'Iron', unit: 'mg', rdi: 18, color: '#ff5c5c' },
  magnesium_mg: { label: 'Magnesium', unit: 'mg', rdi: 420, color: '#ff7eb6' },
  potassium_mg: { label: 'Potassium', unit: 'mg', rdi: 3500, color: '#5ad1c4' },
  zinc_mg: { label: 'Zinc', unit: 'mg', rdi: 11, color: '#9aa0ff' },
  sodium_mg: { label: 'Sodium', unit: 'mg', rdi: 2300, color: '#ffa94d' },
  // Fat breakdown (reference/limit values, not strict RDIs)
  saturated_fat_g: { label: 'Saturated Fat', unit: 'g', rdi: 20, color: '#ff6b6b' },
  unsaturated_fat_g: { label: 'Unsaturated Fat', unit: 'g', rdi: 44, color: '#51cf66' },
  trans_fat_g: { label: 'Trans Fat', unit: 'g', rdi: 2, color: '#868e96' },
  fiber_g: { label: 'Fibre', unit: 'g', rdi: 30, color: '#4dabf7' },
  // Fatty acids (reference intakes)
  omega_3_g: { label: 'Omega-3', unit: 'g', rdi: 1.6, color: '#3bc9db' },
  omega_6_g: { label: 'Omega-6', unit: 'g', rdi: 17, color: '#9775fa' },
  monounsaturated_fat_g: { label: 'Monounsaturated', unit: 'g', rdi: 25, color: '#ffa94d' },
  polyunsaturated_fat_g: { label: 'Polyunsaturated', unit: 'g', rdi: 22, color: '#69db7c' },
};

type NutrientSource = Partial<Record<NutrientKey, number | null>>;

function val(row: NutrientSource, key: NutrientKey): number {
  const n = Number(row[key] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Sum every tracked nutrient across food entries + supplement entries. */
export function sumNutrients(foods: FoodEntry[], supplements: SupplementEntry[]): NutrientValues {
  const totals = {} as NutrientValues;
  for (const key of ALL_NUTRIENT_KEYS) {
    let sum = 0;
    for (const f of foods) sum += val(f, key);
    for (const s of supplements) sum += val(s, key);
    totals[key] = Math.round(sum * 100) / 100;
  }
  return totals;
}

export interface Contributor {
  name: string;
  context: string;
  amount: number;
}

/**
 * Contributors to one nutrient today: food entries (labelled by meal) and supplements
 * (labelled "Supplement") with a non-zero value, sorted by amount descending.
 */
export function contributorsFor(
  key: NutrientKey,
  foods: FoodEntry[],
  supplements: SupplementEntry[],
  mealLabel: (entry: FoodEntry) => string
): Contributor[] {
  const out: Contributor[] = [];
  for (const f of foods) {
    const amount = val(f, key);
    if (amount > 0) out.push({ name: f.food_name, context: mealLabel(f), amount });
  }
  for (const s of supplements) {
    const amount = val(s, key);
    if (amount > 0) out.push({ name: s.supplement_name, context: 'Supplement', amount });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export function formatAmount(value: number, unit: string): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}
