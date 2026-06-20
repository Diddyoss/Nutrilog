import { ALL_NUTRIENT_KEYS } from './nutrientReference';

interface SupabaseLikeError {
  code?: string;
  message?: string;
}

/**
 * True when an insert/update failed because a column doesn't exist — i.e. a
 * nutrient migration hasn't been run yet. PostgREST reports this as PGRST204
 * with a "Could not find the 'X' column ... in the schema cache" message.
 */
export function isMissingColumnError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204') return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('schema cache') || (m.includes('could not find') && m.includes('column'));
}

/** Return a copy of the row with all micronutrient/fatty-acid fields removed. */
export function stripNutrientFields<T extends object>(fields: T): T {
  const out = { ...fields };
  for (const key of ALL_NUTRIENT_KEYS) delete (out as Record<string, unknown>)[key];
  return out;
}

/** True when an operation failed because the table doesn't exist (migration not run). */
export function isMissingTableError(error: SupabaseLikeError | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const m = (error.message ?? '').toLowerCase();
  return m.includes('does not exist') || m.includes('could not find the table');
}
