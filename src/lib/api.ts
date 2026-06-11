import type { FoodDraft, SearchResult } from '../types';

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function analyzeFoodImage(
  base64: string,
  mediaType: string,
  context?: string
): Promise<FoodDraft> {
  const data = await getJson('/api/analyze-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, media_type: mediaType, context, type: 'image' }),
  });
  return {
    food_name: String(data.food_name ?? 'Unknown food'),
    serving_size: String(data.serving_size ?? ''),
    calories: toNum(data.calories) ?? 0,
    protein_g: toNum(data.protein_g) ?? 0,
    carbs_g: toNum(data.carbs_g) ?? 0,
    fat_g: toNum(data.fat_g) ?? 0,
    source: 'ai_photo',
    confidence: ['high', 'medium', 'low'].includes(data.confidence) ? data.confidence : undefined,
    note: typeof data.note === 'string' ? data.note : undefined,
    perGram: null,
  };
}

interface BarcodeProduct {
  name: string;
  brand: string | null;
  serving_size: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  per_100g: { calories: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null } | null;
  has_macros: boolean;
}

export async function lookupBarcode(
  code: string
): Promise<{ found: false } | { found: true; draft: FoodDraft }> {
  const data = await getJson(`/api/search-food?barcode=${encodeURIComponent(code)}`);
  if (!data.found || !data.product) return { found: false };

  const p = data.product as BarcodeProduct;
  const perGram = p.per_100g
    ? {
        calories: p.per_100g.calories / 100,
        protein_g: (p.per_100g.protein_g ?? 0) / 100,
        carbs_g: (p.per_100g.carbs_g ?? 0) / 100,
        fat_g: (p.per_100g.fat_g ?? 0) / 100,
      }
    : null;

  return {
    found: true,
    draft: {
      food_name: p.brand ? `${p.name} (${p.brand})` : p.name,
      serving_size: p.serving_size ?? '',
      calories: p.calories,
      protein_g: p.protein_g,
      carbs_g: p.carbs_g,
      fat_g: p.fat_g,
      source: 'scan',
      has_macros: p.has_macros,
      perGram,
    },
  };
}

export async function searchFoods(query: string): Promise<SearchResult[]> {
  const data = await getJson(`/api/search-food?query=${encodeURIComponent(query)}`);
  return Array.isArray(data.results) ? data.results : [];
}

export function draftFromSearchResult(r: SearchResult): FoodDraft {
  const perGram =
    r.kcal_per_100g !== null
      ? {
          calories: r.kcal_per_100g / 100,
          protein_g: (r.protein_per_100g ?? 0) / 100,
          carbs_g: (r.carbs_per_100g ?? 0) / 100,
          fat_g: (r.fat_per_100g ?? 0) / 100,
        }
      : null;

  return {
    food_name: r.brand ? `${r.name} (${r.brand})` : r.name,
    serving_size: '100g',
    calories: r.kcal_per_100g,
    protein_g: r.protein_per_100g,
    carbs_g: r.carbs_per_100g,
    fat_g: r.fat_per_100g,
    source: 'search',
    has_macros: r.kcal_per_100g !== null,
    perGram,
  };
}
