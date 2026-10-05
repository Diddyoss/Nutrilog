import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isMissingTableError, writeWithNutrientFallback } from '../lib/db';
import { useToast } from '../components/Toast';

export interface DailyLogMessages {
  /** Toast when loading fails. Omit to fail soft (the table may not exist yet). */
  loadFailed?: string;
  saveFailed: string;
  updateFailed?: string;
  deleteFailed: string;
  /** Toast when a save only succeeded with micronutrient columns dropped. */
  savedWithoutNutrients?: string;
  /** Toast when saving fails because the table's migration hasn't run. */
  tableMissing?: string;
}

/**
 * One day's rows from a per-day log table (food, supplements, activity):
 * load, add, update and delete, refreshing and notifying `onChanged` after
 * each write. `messages` must be a stable (module-level) object.
 */
export function useDailyLog<Entry, Fields extends object>(
  table: string,
  messages: DailyLogMessages,
  date: string,
  onChanged?: () => void
) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('log_date', date)
      .order('logged_at', { ascending: true });
    if (!error) setEntries((data as Entry[]) ?? []);
    else if (messages.loadFailed) toast(messages.loadFailed);
    else setEntries([]);
    setLoading(false);
  }, [table, messages, date, toast]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const afterWrite = useCallback(async () => {
    await refresh();
    onChanged?.();
  }, [refresh, onChanged]);

  const addEntry = useCallback(
    async (fields: Fields): Promise<boolean> => {
      const { error, stripped } = await writeWithNutrientFallback(
        (row) => supabase.from(table).insert(row),
        { ...fields, log_date: date }
      );
      if (error) {
        toast(messages.tableMissing && isMissingTableError(error) ? messages.tableMissing : messages.saveFailed);
        return false;
      }
      if (stripped && messages.savedWithoutNutrients) toast(messages.savedWithoutNutrients);
      await afterWrite();
      return true;
    },
    [table, messages, date, toast, afterWrite]
  );

  const updateEntry = useCallback(
    async (id: string, fields: Fields): Promise<boolean> => {
      const { error, stripped } = await writeWithNutrientFallback(
        (row) => supabase.from(table).update(row).eq('id', id),
        fields
      );
      if (error) {
        toast(messages.updateFailed ?? messages.saveFailed);
        return false;
      }
      if (stripped && messages.savedWithoutNutrients) toast(messages.savedWithoutNutrients);
      await afterWrite();
      return true;
    },
    [table, messages, toast, afterWrite]
  );

  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        toast(messages.deleteFailed);
        return false;
      }
      await afterWrite();
      return true;
    },
    [table, messages, toast, afterWrite]
  );

  return { entries, loading, refresh, addEntry, updateEntry, deleteEntry };
}
