import { describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ ensureSession: async () => null, supabase: {} }));

import { ApiError } from '../api';
import { analyseBatch, batchNotice, MAX_PHOTOS_PER_BATCH } from '../photoBatch';
import type { FoodDraft } from '../../types';

const draft = (name: string): FoodDraft => ({
  food_name: name,
  serving_size: '1 plate',
  calories: 400,
  protein_g: 20,
  carbs_g: 40,
  fat_g: 15,
  source: 'ai_photo',
  perGram: null,
  micros: {},
});

describe('analyseBatch', () => {
  it('analyses every photo in order and reports progress', async () => {
    const progress = vi.fn();
    const r = await analyseBatch(['a', 'b', 'c'], async (x) => draft(x), progress);
    expect(r.drafts.map((d) => d.food_name)).toEqual(['a', 'b', 'c']);
    expect(r).toMatchObject({ failed: 0, notAnalysed: 0 });
    expect(progress.mock.calls).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('runs one at a time (no parallel spend against the daily limit)', async () => {
    let inFlight = 0;
    let peak = 0;
    await analyseBatch([1, 2, 3], async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return draft(String(n));
    });
    expect(peak).toBe(1);
  });

  it('skips a photo that fails and keeps going', async () => {
    const r = await analyseBatch(['a', 'bad', 'c'], async (x) => {
      if (x === 'bad') throw new ApiError('Could not read the AI response', 422);
      return draft(x);
    });
    expect(r.drafts.map((d) => d.food_name)).toEqual(['a', 'c']);
    expect(r.failed).toBe(1);
    expect(r.stoppedBy).toBeUndefined();
  });

  it('stops at the daily limit, keeping what already succeeded', async () => {
    const analyse = vi.fn(async (x: string) => {
      if (x === 'c') throw new ApiError('Daily photo limit reached (30 per 24h)', 429);
      return draft(x);
    });
    const r = await analyseBatch(['a', 'b', 'c', 'd', 'e'], analyse);
    expect(r.drafts).toHaveLength(2);
    expect(r.notAnalysed).toBe(3); // c, d, e
    expect(r.stoppedBy).toContain('Daily photo limit');
    expect(analyse).toHaveBeenCalledTimes(3); // d and e never sent
  });

  it('stops on an expired session too', async () => {
    const r = await analyseBatch(['a', 'b'], async () => {
      throw new ApiError('Session expired', 401);
    });
    expect(r).toMatchObject({ drafts: [], notAnalysed: 2, stoppedBy: 'Session expired' });
  });

  it(`analyses at most ${MAX_PHOTOS_PER_BATCH} and counts the rest`, async () => {
    const analyse = vi.fn(async (n: number) => draft(String(n)));
    const r = await analyseBatch([1, 2, 3, 4, 5, 6, 7, 8], analyse);
    expect(analyse).toHaveBeenCalledTimes(MAX_PHOTOS_PER_BATCH);
    expect(r.notAnalysed).toBe(8 - MAX_PHOTOS_PER_BATCH);
  });
});

describe('batchNotice', () => {
  const base = { drafts: [], failed: 0, notAnalysed: 0 };

  it('is null when every photo worked', () => {
    expect(batchNotice(base)).toBeNull();
  });

  it('mentions per-photo failures', () => {
    expect(batchNotice({ ...base, failed: 1 })).toBe("1 photo couldn't be analysed");
    expect(batchNotice({ ...base, failed: 2 })).toBe("2 photos couldn't be analysed");
  });

  it('explains photos skipped by a limit with the server message', () => {
    expect(batchNotice({ ...base, notAnalysed: 3, stoppedBy: 'Daily photo limit reached' })).toBe(
      '3 photos skipped — Daily photo limit reached'
    );
  });

  it('explains photos over the per-pick cap', () => {
    expect(batchNotice({ ...base, notAnalysed: 2 })).toBe(
      `Only the first ${MAX_PHOTOS_PER_BATCH} photos were analysed`
    );
  });

  it('combines both', () => {
    expect(batchNotice({ ...base, failed: 1, notAnalysed: 2 })).toBe(
      `1 photo couldn't be analysed; only the first ${MAX_PHOTOS_PER_BATCH} photos were analysed`
    );
  });
});
