import { useDailyLog } from './useDailyLog';
import type { DailyLogMessages } from './useDailyLog';
import type { SupplementEntry, SupplementSaveFields } from '../types';

const MESSAGES: DailyLogMessages = {
  saveFailed: 'Could not save supplement',
  deleteFailed: 'Could not delete supplement',
  savedWithoutNutrients: 'Saved name only — run the latest DB migration for supplement nutrients',
  tableMissing: 'Run the latest DB migration to enable supplements',
};

export function useSupplementLog(date: string, onChanged?: () => void) {
  return useDailyLog<SupplementEntry, SupplementSaveFields>('supplement_log', MESSAGES, date, onChanged);
}
