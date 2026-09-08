import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isMissingTableError } from '../lib/db';
import { useToast } from '../components/Toast';
import type { CustomFood, CustomFoodSaveFields } from '../types';

const MIGRATION_NOTICE = 'Run DB migration 005 to save foods to My Foods';

/**
 * The user's personal food library: manually entered foods that were logged at
 * least once. Sorted by most recently used.
 */
export function useCustomFoods() {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const warned = useRef(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_food')
      .select('*')
      .order('last_used_at', { ascending: false });
    if (error) {
      // Table may not exist yet (migration 005 not run) — fail soft.
      setFoods([]);
      setAvailable(!isMissingTableError(error));
    } else {
      setFoods((data as CustomFood[]) ?? []);
      setAvailable(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const warnOnce = useCallback(() => {
    if (warned.current) return;
    warned.current = true;
    toast(MIGRATION_NOTICE);
  }, [toast]);

  /** Insert or update by name, and mark as just used. */
  const save = useCallback(
    async (fields: CustomFoodSaveFields): Promise<boolean> => {
      const existing = foods.find(
        (f) => f.food_name.trim().toLowerCase() === fields.food_name.trim().toLowerCase()
      );
      const row = {
        ...fields,
        food_name: existing?.food_name ?? fields.food_name.trim(),
        last_used_at: new Date().toISOString(),
        use_count: (existing?.use_count ?? 0) + 1,
      };
      const { error } = await supabase.from('custom_food').upsert(row, { onConflict: 'user_id,food_name' });
      if (error) {
        if (isMissingTableError(error)) warnOnce();
        return false;
      }
      await refresh();
      return true;
    },
    [foods, refresh, warnOnce]
  );

  /** Bump usage for a food re-logged from the library (values unchanged). */
  const touch = useCallback(
    async (id: string): Promise<void> => {
      const existing = foods.find((f) => f.id === id);
      if (!existing) return;
      const { error } = await supabase
        .from('custom_food')
        .update({ last_used_at: new Date().toISOString(), use_count: existing.use_count + 1 })
        .eq('id', id);
      if (!error) await refresh();
    },
    [foods, refresh]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('custom_food').delete().eq('id', id);
      if (error) {
        toast('Could not remove food');
        return false;
      }
      setFoods((prev) => prev.filter((f) => f.id !== id));
      return true;
    },
    [toast]
  );

  return { foods, loading, available, refresh, save, touch, remove };
}
