import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, toDateStr } from '../lib/date';
import { latestPerDay } from '../lib/stats';
import type { WeightEntry } from '../types';

/** Weigh-ins over the last `days` days, one (the latest) per day, oldest first. */
export function useWeightLog(days = 30) {
  const [weights, setWeights] = useState<WeightEntry[]>([]);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('weight_log')
      .select('id, log_date, weight_kg')
      .gte('log_date', toDateStr(addDays(new Date(), -days)))
      .order('log_date', { ascending: true })
      .order('logged_at', { ascending: true });
    setWeights(latestPerDay((data ?? []) as WeightEntry[]));
  }, [days]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { weights, reload };
}
