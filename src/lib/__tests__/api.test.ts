import { describe, it, expect, vi, afterEach } from 'vitest';

const session = vi.hoisted(() => ({ current: { access_token: 'tok-123' } as { access_token: string } | null }));
vi.mock('../supabase', () => ({ ensureSession: async () => session.current, supabase: {} }));

import { analyzeFoodImage, ApiError, blankManualDraft, draftFromSearchResult } from '../api';
import type { SearchResult } from '../../types';

describe('blankManualDraft', () => {
  it('returns a draft with source set to manual', () => {
    expect(blankManualDraft().source).toBe('manual');
  });

  it('returns a draft with empty strings for name and serving', () => {
    const draft = blankManualDraft();
    expect(draft.food_name).toBe('');
    expect(draft.serving_size).toBe('');
  });

  it('returns null for all macro fields', () => {
    const draft = blankManualDraft();
    expect(draft.calories).toBeNull();
    expect(draft.protein_g).toBeNull();
    expect(draft.carbs_g).toBeNull();
    expect(draft.fat_g).toBeNull();
  });

  it('returns null perGram', () => {
    expect(blankManualDraft().perGram).toBeNull();
  });

  it('returns empty micros object', () => {
    expect(blankManualDraft().micros).toEqual({});
  });

  it('returns a new object each call (no shared reference)', () => {
    const a = blankManualDraft();
    const b = blankManualDraft();
    expect(a).not.toBe(b);
  });
});

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    name: 'Oats',
    brand: null,
    serving_size: null,
    kcal_per_100g: 389,
    protein_per_100g: 17,
    carbs_per_100g: 66,
    fat_per_100g: 7,
    kcal_serving: null,
    protein_serving: null,
    carbs_serving: null,
    fat_serving: null,
    ...overrides,
  };
}

describe('draftFromSearchResult', () => {
  describe('path 1: has serving_size + kcal_serving', () => {
    it('uses per-serving nutrition and serving_size', () => {
      const r = makeSearchResult({
        name: 'Milk',
        brand: 'Organic',
        serving_size: '240 ml',
        kcal_serving: 150,
        protein_serving: 8,
        carbs_serving: 12,
        fat_serving: 8,
      });
      const draft = draftFromSearchResult(r);
      expect(draft.food_name).toBe('Milk (Organic)');
      expect(draft.serving_size).toBe('240 ml');
      expect(draft.calories).toBe(150);
      expect(draft.protein_g).toBe(8);
      expect(draft.carbs_g).toBe(12);
      expect(draft.fat_g).toBe(8);
      expect(draft.source).toBe('search');
      expect(draft.has_macros).toBe(true);
    });

    it('sets food_name without brand when brand is null', () => {
      const r = makeSearchResult({
        name: 'Water',
        brand: null,
        serving_size: '500 ml',
        kcal_serving: 0,
        protein_serving: 0,
        carbs_serving: 0,
        fat_serving: 0,
      });
      expect(draftFromSearchResult(r).food_name).toBe('Water');
    });
  });

  describe('path 2: serving_size in grams but only per-100g nutrition known', () => {
    it('scales per-100g nutrition down to the gram serving', () => {
      const r = makeSearchResult({
        name: 'Oats',
        brand: null,
        serving_size: '40g',
        kcal_per_100g: 400,
        protein_per_100g: 14,
        carbs_per_100g: 68,
        fat_per_100g: 8,
        kcal_serving: null,   // forces path 2
        protein_serving: null,
        carbs_serving: null,
        fat_serving: null,
      });
      const draft = draftFromSearchResult(r);
      expect(draft.serving_size).toBe('40g');
      expect(draft.calories).toBe(Math.round((400 / 100) * 40)); // 160
      expect(draft.has_macros).toBe(true);
      expect(draft.source).toBe('search');
    });

    it('extracts grams from a parenthetical like "1 tbsp (14 g)"', () => {
      const r = makeSearchResult({
        serving_size: '1 tbsp (14 g)',
        kcal_per_100g: 884,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 100,
        kcal_serving: null,
        protein_serving: null,
        carbs_serving: null,
        fat_serving: null,
      });
      const draft = draftFromSearchResult(r);
      expect(draft.serving_size).toBe('1 tbsp (14 g)');
      expect(draft.calories).toBe(Math.round((884 / 100) * 14)); // 124
    });
  });

  describe('path 3: fallback to 100g', () => {
    it('uses 100g as serving_size when no gram info available', () => {
      const r = makeSearchResult({
        serving_size: null,
        kcal_per_100g: 389,
        protein_per_100g: 17,
        carbs_per_100g: 66,
        fat_per_100g: 7,
        kcal_serving: null,
        protein_serving: null,
        carbs_serving: null,
        fat_serving: null,
      });
      const draft = draftFromSearchResult(r);
      expect(draft.serving_size).toBe('100g');
      expect(draft.calories).toBe(389);
      expect(draft.has_macros).toBe(true);
    });

    it('sets has_macros to false when kcal_per_100g is null', () => {
      const r = makeSearchResult({
        serving_size: null,
        kcal_per_100g: null,
        protein_per_100g: null,
        carbs_per_100g: null,
        fat_per_100g: null,
        kcal_serving: null,
        protein_serving: null,
        carbs_serving: null,
        fat_serving: null,
      });
      const draft = draftFromSearchResult(r);
      expect(draft.has_macros).toBe(false);
    });

    it('builds perGram from per-100g values', () => {
      const r = makeSearchResult({
        kcal_per_100g: 200,
        protein_per_100g: 10,
        carbs_per_100g: 30,
        fat_per_100g: 5,
      });
      const draft = draftFromSearchResult(r);
      expect(draft.perGram).not.toBeNull();
      expect(draft.perGram!.calories).toBeCloseTo(2);
      expect(draft.perGram!.protein_g).toBeCloseTo(0.1);
    });

    it('sets perGram to null when kcal_per_100g is null', () => {
      const r = makeSearchResult({ kcal_per_100g: null, protein_per_100g: null, carbs_per_100g: null, fat_per_100g: null });
      expect(draftFromSearchResult(r).perGram).toBeNull();
    });
  });
});

describe('analyzeFoodImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    session.current = { access_token: 'tok-123' };
  });

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('sends the session token as a Bearer header', async () => {
    const fetchMock = stubFetch(200, { food_name: 'Toast', calories: 120 });
    await analyzeFoodImage('aGVsbG8=', 'image/jpeg');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('omits the header when there is no session', async () => {
    session.current = null;
    const fetchMock = stubFetch(200, { food_name: 'Toast', calories: 120 });
    await analyzeFoodImage('aGVsbG8=', 'image/jpeg');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers as Record<string, string>).not.toHaveProperty('Authorization');
  });

  it('throws an ApiError carrying the status and server message on a 429', async () => {
    stubFetch(429, { error: 'Daily photo limit reached (30 per 24h)' });
    const err = await analyzeFoodImage('aGVsbG8=', 'image/jpeg').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.message).toContain('Daily photo limit');
  });

  it('maps a successful reply into an ai_photo draft', async () => {
    stubFetch(200, { food_name: 'Toast', serving_size: '2 slices', calories: '120', protein_g: 4, confidence: 'high' });
    const d = await analyzeFoodImage('aGVsbG8=', 'image/jpeg');
    expect(d).toMatchObject({ food_name: 'Toast', serving_size: '2 slices', calories: 120, protein_g: 4, source: 'ai_photo', confidence: 'high' });
  });
});
