import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { isMissingColumnError, stripNutrientFields } from '../lib/db';
import { useToast } from '../components/Toast';
import type { SupplementEntry, SupplementSaveFields } from '../types';

export function useSupplementLog(date: string, onChanged?: () => void) {
  const [entries, setEntries] = useState<SupplementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('supplement_log')
      .select('*')
      .eq('log_date', date)
      .order('logged_at', { ascending: true });
    if (error) {
      // Table may not exist yet (migration 002 not run) — fail soft, no toast spam.
      setEntries([]);
    } else {
      setEntries((data as SupplementEntry[]) ?? []);
    }
    setLoading(false);
  }, [date]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const addEntry = useCallback(
    async (fields: SupplementSaveFields): Promise<boolean> => {
      const row = { ...fields, log_date: date };
      let { error } = await supabase.from('supplement_log').insert(row);
      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase.from('supplement_log').insert(stripNutrientFields(row)));
        if (!error) toast('Saved name only — run the latest DB migration for supplement nutrients');
      }
      if (error) {
        toast('Could not save supplement');
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
      const { error } = await supabase.from('supplement_log').delete().eq('id', id);
      if (error) {
        toast('Could not delete supplement');
        return false;
      }
      await refresh();
      onChanged?.();
      return true;
    },
    [refresh, onChanged, toast]
  );

  return { entries, loading, refresh, addEntry, deleteEntry };
}
