import { describe, it, expect } from 'vitest';
import {
  customFoodFromSaveFields,
  customFoodSummary,
  customFoodToDraft,
  filterCustomFoods,
  shouldSaveAsCustomFood,
} from '../customFoods';
import { ALL_NUTRIENT_KEYS } from '../nutrientReference';
import type { CustomFood, FoodSaveFields, NutrientValues } from '../../types';

function zeroMicros(): NutrientValues {
  const out = {} as NutrientValues;
  for (const k of ALL_NUTRIENT_KEYS) out[k] = 0;
  return out;
}

function makeCustomFood(overrides: Partial<CustomFood> = {}): CustomFood {
  return {
    id: 'cf-1',
    food_name: 'Mum’s Lasagne',
    serving_size: '1 slice',
    calories: 420,
    protein_g: 22,
    carbs_g: 35,
    fat_g: 20,
    use_count: 3,
    last_used_at: '2026-09-01T12:00:00Z',
    created_at: '2026-08-01T12:00:00Z',
    ...overrides,
  };
}

function makeSaveFields(overrides: Partial<FoodSaveFields> = {}): FoodSaveFields {
  return {
    food_name: 'Protein Pancakes',
    serving_size: '3 pancakes',
    meal: 'breakfast',
    calories: 350,
    protein_g: 30,
    carbs_g: 40,
    fat_g: 8,
    source: 'manual',
    ...zeroMicros(),
    ...overrides,
  };
}

describe('customFoodToDraft', () => {
  it('copies name, serving and macros into a manual-source draft', () => {
    const d = customFoodToDraft(makeCustomFood());
    expect(d.food_name).toBe('Mum’s Lasagne');
    expect(d.serving_size).toBe('1 slice');
    expect(d.calories).toBe(420);
    expect(d.protein_g).toBe(22);
    expect(d.carbs_g).toBe(35);
    expect(d.fat_g).toBe(20);
    expect(d.source).toBe('manual');
    expect(d.has_macros).toBe(true);
    expect(d.perGram).toBeNull();
  });

  it('carries the custom food id so re-logging can be told apart from a new entry', () => {
    expect(customFoodToDraft(makeCustomFood({ id: 'abc' })).custom_food_id).toBe('abc');
  });

  it('uses an empty string when serving_size is null', () => {
    expect(customFoodToDraft(makeCustomFood({ serving_size: null })).serving_size).toBe('');
  });

  it('includes only non-zero micronutrients', () => {
    const d = customFoodToDraft(makeCustomFood({ iron_mg: 4, calcium_mg: 0, vitamin_c_mg: null }));
    expect(d.micros).toEqual({ iron_mg: 4 });
  });
});

describe('customFoodFromSaveFields', () => {
  it('drops meal and source but keeps everything else', () => {
    const out = customFoodFromSaveFields(makeSaveFields({ iron_mg: 2 })) as Record<string, unknown>;
    expect(out).not.toHaveProperty('meal');
    expect(out).not.toHaveProperty('source');
    expect(out.food_name).toBe('Protein Pancakes');
    expect(out.serving_size).toBe('3 pancakes');
    expect(out.calories).toBe(350);
    expect(out.iron_mg).toBe(2);
  });

  it('keeps all 22 nutrient keys', () => {
    const out = customFoodFromSaveFields(makeSaveFields());
    for (const k of ALL_NUTRIENT_KEYS) expect(out).toHaveProperty(k);
  });
});

describe('shouldSaveAsCustomFood', () => {
  it('is true for manual entries with a name', () => {
    expect(shouldSaveAsCustomFood(makeSaveFields())).toBe(true);
  });

  it('is false for entries from scan, search or AI photo', () => {
    expect(shouldSaveAsCustomFood(makeSaveFields({ source: 'scan' }))).toBe(false);
    expect(shouldSaveAsCustomFood(makeSaveFields({ source: 'search' }))).toBe(false);
    expect(shouldSaveAsCustomFood(makeSaveFields({ source: 'ai_photo' }))).toBe(false);
  });

  it('is false when the name is blank', () => {
    expect(shouldSaveAsCustomFood(makeSaveFields({ food_name: '   ' }))).toBe(false);
  });
});

describe('filterCustomFoods', () => {
  const foods = [
    makeCustomFood({ id: '1', food_name: 'Protein Pancakes' }),
    makeCustomFood({ id: '2', food_name: 'Mum’s Lasagne' }),
    makeCustomFood({ id: '3', food_name: 'Banana Protein Shake' }),
  ];

  it('returns everything for an empty or whitespace query', () => {
    expect(filterCustomFoods(foods, '')).toHaveLength(3);
    expect(filterCustomFoods(foods, '   ')).toHaveLength(3);
  });

  it('matches case-insensitively on a substring', () => {
    expect(filterCustomFoods(foods, 'PROTEIN').map((f) => f.id)).toEqual(['1', '3']);
  });

  it('requires every term to match', () => {
    expect(filterCustomFoods(foods, 'protein shake').map((f) => f.id)).toEqual(['3']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterCustomFoods(foods, 'pizza')).toEqual([]);
  });

  it('preserves input order', () => {
    expect(filterCustomFoods(foods, 'a').map((f) => f.id)).toEqual(['1', '2', '3']);
  });
});

describe('customFoodSummary', () => {
  it('lists calories, serving and macros', () => {
    expect(customFoodSummary(makeCustomFood())).toBe('420 kcal · 1 slice · P 22 · C 35 · F 20');
  });

  it('omits the serving when null', () => {
    expect(customFoodSummary(makeCustomFood({ serving_size: null }))).toBe('420 kcal · P 22 · C 35 · F 20');
  });

  it('omits zero and null macros', () => {
    expect(customFoodSummary(makeCustomFood({ protein_g: 0, carbs_g: null }))).toBe('420 kcal · 1 slice · F 20');
  });

  it('rounds macros to one decimal', () => {
    expect(customFoodSummary(makeCustomFood({ protein_g: 22.26, carbs_g: 0, fat_g: 0 }))).toBe(
      '420 kcal · 1 slice · P 22.3'
    );
  });
});
