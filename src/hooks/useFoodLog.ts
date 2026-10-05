import { useMemo } from 'react';
import { useDailyLog } from './useDailyLog';
import type { DailyLogMessages } from './useDailyLog';
import type { FoodEntry, FoodSaveFields, Meal } from '../types';

const MESSAGES: DailyLogMessages = {
  loadFailed: 'Could not load food log',
  saveFailed: 'Could not save entry',
  updateFailed: 'Could not update entry',
  deleteFailed: 'Could not delete entry',
  savedWithoutNutrients: 'Saved core values — run the latest DB migration to store micronutrients',
};

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function useFoodLog(date: string, onChanged?: () => void) {
  const log = useDailyLog<FoodEntry, FoodSaveFields>('food_log', MESSAGES, date, onChanged);
  const { entries } = log;

  const totals: DayTotals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          calories: acc.calories + (e.calories ?? 0),
          protein: acc.protein + (e.protein_g ?? 0),
          carbs: acc.carbs + (e.carbs_g ?? 0),
          fat: acc.fat + (e.fat_g ?? 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [entries]
  );

  const byMeal = useMemo(() => {
    const map: Record<Meal, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    for (const e of entries) map[e.meal]?.push(e);
    return map;
  }, [entries]);

  return { ...log, totals, byMeal };
}
