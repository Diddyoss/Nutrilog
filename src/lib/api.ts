import type { FoodDraft, NutrientKey, NutrientValues, SearchResult } from '../types';
import { ALL_NUTRIENT_KEYS } from './nutrientReference';

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

type MicroSource = Record<string, unknown> | null | undefined;

/** Pull known micronutrient keys out of an arbitrary object as numbers. */
function coerceMicros(src: MicroSource): Partial<NutrientValues> {
  const out: Partial<NutrientValues> = {};
  if (!src) return out;
  for (const k of ALL_NUTRIENT_KEYS) {
    const v = toNum(src[k]);
    if (v !== null) out[k] = v;
  }
  return out;
}

/** Convert per-100g micros to a per-gram basis for proportional rescaling. */
function microsPerGram(src: MicroSource): Partial<Record<NutrientKey, number>> {
  const out: Partial<Record<NutrientKey, number>> = {};
  if (!src) return out;
  for (const k of ALL_NUTRIENT_KEYS) {
    const v = toNum(src[k]);
    if (v !== null) out[k] = v / 100;
  }
  return out;
}

/** Scale per-100g micros to a gram serving. */
function microsForGrams(src: MicroSource, grams: number): Partial<NutrientValues> {
  const out: Partial<NutrientValues> = {};
  if (!src) return out;
  for (const k of ALL_NUTRIENT_KEYS) {
    const v = toNum(src[k]);
    if (v !== null) out[k] = Math.round((v * grams) / 100 * 10) / 10;
  }
  return out;
}

export async function analyzeFoodImage(
  base64: string,
  mediaType: string,
  context?: string
): Promise<FoodDraft> {
  const data = await getJson('/api/analyze-food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, media_type: mediaType, context }),
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
    micros: coerceMicros(data),
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
  micros?: Record<string, number>;
  per_100g: {
    calories: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    micros?: Record<string, number>;
  } | null;
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
        ...microsPerGram(p.per_100g.micros),
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
      micros: coerceMicros(p.micros),
    },
  };
}

export async function searchFoods(query: string): Promise<SearchResult[]> {
  const data = await getJson(`/api/search-food?query=${encodeURIComponent(query)}`);
  return Array.isArray(data.results) ? data.results : [];
}

/** Empty draft for manual entry — all fields blank/editable in the Confirm Food modal. */
export function blankManualDraft(): FoodDraft {
  return {
    food_name: '',
    serving_size: '',
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    source: 'manual',
    perGram: null,
    micros: {},
  };
}

/** Grams in a serving string, e.g. "30 g" or "1 tbsp (14 g)" -> 30 / 14. */
function servingGrams(s: string): number | null {
  const paren = s.match(/\(\s*([\d.,]+)\s*(?:g|ml)\s*\)/i);
  if (paren) return parseFloat(paren[1].replace(',', '.'));
  const plain = s.match(/([\d.,]+)\s*(?:g|ml)\b/i);
  return plain ? parseFloat(plain[1].replace(',', '.')) : null;
}

export function draftFromSearchResult(r: SearchResult): FoodDraft {
  const name = r.brand ? `${r.name} (${r.brand})` : r.name;
  const perGram =
    r.kcal_per_100g !== null
      ? {
          calories: r.kcal_per_100g / 100,
          protein_g: (r.protein_per_100g ?? 0) / 100,
          carbs_g: (r.carbs_per_100g ?? 0) / 100,
          fat_g: (r.fat_per_100g ?? 0) / 100,
          ...microsPerGram(r.micros_per_100g),
        }
      : null;

  // 1) Prefer the product's natural serving with its own per-serving nutrition
  //    (e.g. "1 tbsp", "1 plate", "30 g") instead of a flat 100g.
  if (r.serving_size && r.kcal_serving !== null) {
    const servingMicros = coerceMicros(r.micros_serving);
    return {
      food_name: name,
      serving_size: r.serving_size,
      calories: r.kcal_serving,
      protein_g: r.protein_serving,
      carbs_g: r.carbs_serving,
      fat_g: r.fat_serving,
      source: 'search',
      has_macros: true,
      perGram,
      micros: Object.keys(servingMicros).length > 0 ? servingMicros : coerceMicros(r.micros_per_100g),
    };
  }

  // 2) Natural serving expressed in grams but only per-100g nutrition known —
  //    scale per-100g down to the serving so the default still isn't a flat 100g.
  const grams = r.serving_size ? servingGrams(r.serving_size) : null;
  if (r.serving_size && grams && grams > 0 && perGram) {
    return {
      food_name: name,
      serving_size: r.serving_size,
      calories: Math.round(perGram.calories * grams),
      protein_g: Math.round(perGram.protein_g * grams * 10) / 10,
      carbs_g: Math.round(perGram.carbs_g * grams * 10) / 10,
      fat_g: Math.round(perGram.fat_g * grams * 10) / 10,
      source: 'search',
      has_macros: true,
      perGram,
      micros: microsForGrams(r.micros_per_100g, grams),
    };
  }

  // 3) Fallback: 100g basis (keeps macros consistent with the label).
  return {
    food_name: name,
    serving_size: '100g',
    calories: r.kcal_per_100g,
    protein_g: r.protein_per_100g,
    carbs_g: r.carbs_per_100g,
    fat_g: r.fat_per_100g,
    source: 'search',
    has_macros: r.kcal_per_100g !== null,
    perGram,
    micros: coerceMicros(r.micros_per_100g),
  };
}
