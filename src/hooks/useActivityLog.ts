import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isMissingTableError } from '../lib/db';
import { useToast } from '../components/Toast';
import type { ActivityEntry, ActivitySaveFields } from '../types';

export function useActivityLog(date: string, onChanged?: () => void) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('log_date', date)
      .order('logged_at', { ascending: true });
    if (error) {
      // Table may not exist yet (migration 004 not run) — fail soft.
      setEntries([]);
    } else {
      setEntries((data as ActivityEntry[]) ?? []);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const addEntry = useCallback(
    async (fields: ActivitySaveFields): Promise<boolean> => {
      const { error } = await supabase.from('activity_log').insert({ ...fields, log_date: date });
      if (error) {
        toast(
          isMissingTableError(error)
            ? 'Run the latest DB migration to enable activity logging'
            : 'Could not save activity'
        );
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    },
    [date, refresh, onChanged, toast]
  );

  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await supabase.from('activity_log').delete().eq('id', id);
      if (error) {
        toast('Could not delete activity');
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    },
    [refresh, onChanged, toast]
  );

  const totalBurned = useMemo(
    () => entries.reduce((sum, e) => sum + (e.calories_burned ?? 0), 0),
    [entries]
  );

  return { entries, totalBurned, loading, refresh, addEntry, deleteEntry };
}
