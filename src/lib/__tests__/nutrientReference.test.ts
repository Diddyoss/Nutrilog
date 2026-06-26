import { describe, it, expect } from 'vitest';
import { sumNutrients, contributorsFor, formatAmount } from '../nutrientReference';
import type { FoodEntry, SupplementEntry } from '../../types';

function makeFood(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: '1',
    log_date: '2024-01-01',
    meal: 'lunch',
    food_name: 'Test Food',
    serving_size: '100g',
    calories: 200,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    source: 'manual',
    logged_at: '2024-01-01T12:00:00Z',
    ...overrides,
  };
}

function makeSupplement(overrides: Partial<SupplementEntry> = {}): SupplementEntry {
  return {
    id: '1',
    log_date: '2024-01-01',
    supplement_name: 'Test Supplement',
    dose: '1 tablet',
    logged_at: '2024-01-01T12:00:00Z',
    ...overrides,
  };
}

describe('sumNutrients', () => {
  it('returns all-zero totals for empty arrays', () => {
    const result = sumNutrients([], []);
    for (const v of Object.values(result)) {
      expect(v).toBe(0);
    }
  });

  it('sums a single food entry nutrient', () => {
    const food = makeFood({ vitamin_c_mg: 80 });
    const result = sumNutrients([food], []);
    expect(result.vitamin_c_mg).toBe(80);
  });

  it('sums a single supplement entry nutrient', () => {
    const supp = makeSupplement({ calcium_mg: 500 });
    const result = sumNutrients([], [supp]);
    expect(result.calcium_mg).toBe(500);
  });

  it('sums nutrients across multiple food entries', () => {
    const f1 = makeFood({ iron_mg: 5 });
    const f2 = makeFood({ iron_mg: 3 });
    const result = sumNutrients([f1, f2], []);
    expect(result.iron_mg).toBe(8);
  });

  it('sums nutrients across foods and supplements together', () => {
    const food = makeFood({ magnesium_mg: 100 });
    const supp = makeSupplement({ magnesium_mg: 200 });
    const result = sumNutrients([food], [supp]);
    expect(result.magnesium_mg).toBe(300);
  });

  it('treats null values as 0', () => {
    const food = makeFood({ vitamin_d_mcg: null });
    const result = sumNutrients([food], []);
    expect(result.vitamin_d_mcg).toBe(0);
  });

  it('treats undefined nutrient fields as 0', () => {
    const food = makeFood(); // no vitamin_a_mcg set
    const result = sumNutrients([food], []);
    expect(result.vitamin_a_mcg).toBe(0);
  });

  it('rounds result to 2 decimal places', () => {
    const f1 = makeFood({ omega_3_g: 1.005 });
    const f2 = makeFood({ omega_3_g: 1.005 });
    const result = sumNutrients([f1, f2], []);
    // 2.01 — verify it's rounded, not 2.009999...
    expect(result.omega_3_g).toBe(Math.round(2.01 * 100) / 100);
  });

  it('covers all 22 tracked nutrient keys', () => {
    const result = sumNutrients([], []);
    expect(Object.keys(result)).toHaveLength(22);
  });
});

describe('contributorsFor', () => {
  const mealLabel = (entry: FoodEntry) => entry.meal;

  it('returns empty array when no entries have the nutrient', () => {
    const food = makeFood({ vitamin_c_mg: 0 });
    expect(contributorsFor('vitamin_c_mg', [food], [], mealLabel)).toEqual([]);
  });

  it('includes food entries with a positive nutrient value', () => {
    const food = makeFood({ food_name: 'Orange', vitamin_c_mg: 70, meal: 'breakfast' });
    const result = contributorsFor('vitamin_c_mg', [food], [], mealLabel);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Orange', context: 'breakfast', amount: 70 });
  });

  it('includes supplement entries with a positive nutrient value', () => {
    const supp = makeSupplement({ supplement_name: 'Vitamin C', vitamin_c_mg: 500 });
    const result = contributorsFor('vitamin_c_mg', [], [supp], mealLabel);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Vitamin C', context: 'Supplement', amount: 500 });
  });

  it('excludes entries with zero or null values', () => {
    const f1 = makeFood({ food_name: 'Broccoli', vitamin_c_mg: 90 });
    const f2 = makeFood({ food_name: 'Chicken', vitamin_c_mg: 0 });
    const f3 = makeFood({ food_name: 'Rice', vitamin_c_mg: null });
    const result = contributorsFor('vitamin_c_mg', [f1, f2, f3], [], mealLabel);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Broccoli');
  });

  it('sorts contributors by amount descending', () => {
    const f1 = makeFood({ food_name: 'Apple', vitamin_c_mg: 10 });
    const f2 = makeFood({ food_name: 'Orange', vitamin_c_mg: 70 });
    const f3 = makeFood({ food_name: 'Kiwi', vitamin_c_mg: 93 });
    const result = contributorsFor('vitamin_c_mg', [f1, f2, f3], [], mealLabel);
    expect(result.map(c => c.name)).toEqual(['Kiwi', 'Orange', 'Apple']);
  });

  it('mixes food and supplement contributors sorted together', () => {
    const food = makeFood({ food_name: 'Salmon', omega_3_g: 1.5 });
    const supp = makeSupplement({ supplement_name: 'Fish Oil', omega_3_g: 1.0 });
    const result = contributorsFor('omega_3_g', [food], [supp], mealLabel);
    expect(result[0].name).toBe('Salmon');
    expect(result[1].name).toBe('Fish Oil');
  });
});

describe('formatAmount', () => {
  it('rounds values >= 10 to nearest integer', () => {
    expect(formatAmount(15.7, 'mg')).toBe('16mg');
  });

  it('rounds values < 10 to 1 decimal place', () => {
    expect(formatAmount(1.23, 'mg')).toBe('1.2mg');
  });

  it('appends the unit string', () => {
    expect(formatAmount(5, 'mcg')).toBe('5mcg');
  });

  it('handles exactly 10', () => {
    expect(formatAmount(10, 'g')).toBe('10g');
  });

  it('handles 0', () => {
    expect(formatAmount(0, 'mg')).toBe('0mg');
  });

  it('handles values just below 10 with rounding', () => {
    expect(formatAmount(9.95, 'mg')).toBe('10mg');
  });
});
