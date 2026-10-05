import { useMemo } from 'react';
import { useDailyLog } from './useDailyLog';
import type { DailyLogMessages } from './useDailyLog';
import type { ActivityEntry, ActivitySaveFields } from '../types';

const MESSAGES: DailyLogMessages = {
  saveFailed: 'Could not save activity',
  deleteFailed: 'Could not delete activity',
  tableMissing: 'Run the latest DB migration to enable activity logging',
};

export function useActivityLog(date: string, onChanged?: () => void) {
  const log = useDailyLog<ActivityEntry, ActivitySaveFields>('activity_log', MESSAGES, date, onChanged);
  const { entries } = log;
  const totalBurned = useMemo(
    () => entries.reduce((sum, e) => sum + (e.calories_burned ?? 0), 0),
    [entries]
  );
  return { ...log, totalBurned };
}
