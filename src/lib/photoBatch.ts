import { ApiError } from './api';
import type { FoodDraft } from '../types';

/** Photos analysed per pick. Each costs one slot of the daily AI limit. */
export const MAX_PHOTOS_PER_BATCH = 6;

export interface BatchResult {
  drafts: FoodDraft[];
  /** Photos that failed for a per-photo reason (unreadable, bad AI reply). */
  failed: number;
  /** Photos never sent because the batch stopped or was over the cap. */
  notAnalysed: number;
  /** Set when a limit/session error stopped the batch: the server's message. */
  stoppedBy?: string;
}

/**
 * Analyse photos one at a time, keeping every success. Per-photo failures are
 * counted and skipped; a daily-limit or session error stops the batch, since
 * every later photo would fail the same way.
 */
export async function analyseBatch<T>(
  items: T[],
  analyse: (item: T) => Promise<FoodDraft>,
  onProgress?: (current: number, total: number) => void,
  max = MAX_PHOTOS_PER_BATCH
): Promise<BatchResult> {
  const batch = items.slice(0, max);
  const result: BatchResult = { drafts: [], failed: 0, notAnalysed: items.length - batch.length };
  for (let i = 0; i < batch.length; i++) {
    onProgress?.(i + 1, batch.length);
    try {
      result.drafts.push(await analyse(batch[i]));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 429)) {
        result.stoppedBy = e.message;
        result.notAnalysed += batch.length - i;
        break;
      }
      result.failed++;
    }
  }
  return result;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One short note about what didn't make it, or null when everything did. */
export function batchNotice(r: BatchResult): string | null {
  const parts: string[] = [];
  if (r.failed > 0) parts.push(`${plural(r.failed, 'photo')} couldn't be analysed`);
  if (r.notAnalysed > 0) {
    parts.push(
      r.stoppedBy
        ? `${plural(r.notAnalysed, 'photo')} skipped — ${r.stoppedBy}`
        : `only the first ${MAX_PHOTOS_PER_BATCH} photos were analysed`
    );
  }
  if (parts.length === 0) return null;
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
