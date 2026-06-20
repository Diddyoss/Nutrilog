import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isMissingColumnError, stripNutrientFields } from '../lib/db';
import { useToast } from '../components/Toast';
import type { FoodEntry, FoodSaveFields, Meal } from '../types';

const MIGRATION_NOTICE = 'Saved core values — run the latest DB migration to store micronutrients';

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function useFoodLog(date: string, onChanged?: () => void) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('food_log')
      .select('*')
      .eq('log_date', date)
      .order('logged_at', { ascending: true });
    if (error) {
      toast('Could not load food log');
    } else {
      setEntries((data as FoodEntry[]) ?? []);
    }
    setLoading(false);
  }, [date, toast]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const addEntry = useCallback(
    async (fields: FoodSaveFields): Promise<boolean> => {
      const row = { ...fields, log_date: date };
      let { error } = await supabase.from('food_log').insert(row);
      // If nutrient columns are missing (migration not run), retry with core fields only.
      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase.from('food_log').insert(stripNutrientFields(row)));
        if (!error) toast(MIGRATION_NOTICE);
      }
      if (error) {
        toast('Could not save entry');
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    },
    [date, refresh, onChanged, toast]
  );

  const updateEntry = useCallback(
    async (id: string, fields: FoodSaveFields): Promise<boolean> => {
      let { error } = await supabase.from('food_log').update(fields).eq('id', id);
      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase.from('food_log').update(stripNutrientFields(fields)).eq('id', id));
        if (!error) toast(MIGRATION_NOTICE);
      }
      if (error) {
        toast('Could not update entry');
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    },
    [refresh, onChanged, toast]
  );

  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('food_log').delete().eq('id', id);
      if (error) {
        toast('Could not delete entry');
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    },
    [refresh, onChanged, toast]
  );

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
    for (const e of entries) {
      if (map[e.meal]) map[e.meal].push(e);
    }
    return map;
  }, [entries]);

  return { entries, byMeal, totals, loading, refresh, addEntry, updateEntry, deleteEntry };
}
