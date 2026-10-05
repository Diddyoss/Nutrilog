import type { CustomFood, CustomFoodSaveFields, FoodDraft, FoodSaveFields } from '../types';
import { microsFromRow } from './nutrientReference';

/** Turn a saved custom food back into an editable draft for the Confirm Food modal. */
export function customFoodToDraft(cf: CustomFood): FoodDraft {
  return {
    food_name: cf.food_name,
    serving_size: cf.serving_size ?? '',
    calories: cf.calories,
    protein_g: cf.protein_g,
    carbs_g: cf.carbs_g,
    fat_g: cf.fat_g,
    source: 'manual',
    has_macros: true,
    perGram: null,
    micros: microsFromRow(cf),
    custom_food_id: cf.id,
  };
}

/** Fields worth remembering from a logged entry — drops the per-log bits (meal, source). */
export function customFoodFromSaveFields(fields: FoodSaveFields): CustomFoodSaveFields {
  const { meal: _meal, source: _source, ...rest } = fields;
  return rest;
}

/** True when logging this entry should create/refresh a saved custom food. */
export function shouldSaveAsCustomFood(fields: FoodSaveFields): boolean {
  return fields.source === 'manual' && fields.food_name.trim().length > 0;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Case-insensitive substring filter on name; every whitespace-separated term must match. */
export function filterCustomFoods(foods: CustomFood[], query: string): CustomFood[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return foods;
  return foods.filter((f) => {
    const name = normalize(f.food_name);
    return terms.every((t) => name.includes(t));
  });
}

/** One-line summary for a list row: "150 kcal · 1 cup · P 8 · C 12 · F 8". */
export function customFoodSummary(cf: CustomFood): string {
  const parts = [`${cf.calories} kcal`];
  if (cf.serving_size) parts.push(cf.serving_size);
  const macro = (label: string, v: number | null) =>
    v != null && v !== 0 ? `${label} ${Math.round(v * 10) / 10}` : null;
  for (const m of [macro('P', cf.protein_g), macro('C', cf.carbs_g), macro('F', cf.fat_g)]) {
    if (m) parts.push(m);
  }
  return parts.join(' · ');
}
