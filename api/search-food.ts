import type { VercelRequest, VercelResponse } from '@vercel/node';

const OFF_HEADERS = { 'User-Agent': 'NutriLog/1.0 (personal nutrition tracker)' };

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function kcalFrom(n: Record<string, unknown>, suffix: string): number | null {
  const kcal = num(n[`energy-kcal_${suffix}`]);
  if (kcal !== null) return kcal;
  const kj = num(n[`energy-kj_${suffix}`]);
  return kj !== null ? kj / 4.184 : null;
}

// [OpenFoodFacts field stem, our column, gram->unit factor].
// OFF normalises micronutrient _100g / _serving values to GRAMS, so convert:
// mg fields ×1000, mcg fields ×1_000_000, g fields ×1.
const MICRO_MAP: Array<[string, string, number]> = [
  ['vitamin-a', 'vitamin_a_mcg', 1e6],
  ['vitamin-c', 'vitamin_c_mg', 1e3],
  ['vitamin-d', 'vitamin_d_mcg', 1e6],
  ['vitamin-e', 'vitamin_e_mg', 1e3],
  ['vitamin-k', 'vitamin_k_mcg', 1e6],
  ['vitamin-b6', 'vitamin_b6_mg', 1e3],
  ['vitamin-b12', 'vitamin_b12_mcg', 1e6],
  ['folates', 'folate_mcg', 1e6],
  ['calcium', 'calcium_mg', 1e3],
  ['iron', 'iron_mg', 1e3],
  ['magnesium', 'magnesium_mg', 1e3],
  ['potassium', 'potassium_mg', 1e3],
  ['zinc', 'zinc_mg', 1e3],
  ['sodium', 'sodium_mg', 1e3],
  ['saturated-fat', 'saturated_fat_g', 1],
  ['trans-fat', 'trans_fat_g', 1],
  ['fiber', 'fiber_g', 1],
];

/** Extract micronutrients for a basis suffix ('100g' or 'serving'); missing fields are omitted. */
function microsFrom(n: Record<string, unknown>, suffix: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [stem, key, factor] of MICRO_MAP) {
    const v = num(n[`${stem}_${suffix}`]);
    if (v !== null) out[key] = Math.round(v * factor * 100) / 100;
  }
  // Unsaturated is rarely provided directly: fat - saturated - trans, clamped to 0.
  const fat = num(n[`fat_${suffix}`]);
  if (fat !== null) {
    const sat = out['saturated_fat_g'] ?? 0;
    const trans = out['trans_fat_g'] ?? 0;
    out['unsaturated_fat_g'] = Math.max(0, Math.round((fat - sat - trans) * 100) / 100);
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const barcode = typeof req.query.barcode === 'string' ? req.query.barcode : undefined;
  const query = typeof req.query.query === 'string' ? req.query.query : undefined;

  try {
    if (barcode) {
      const r = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
        { headers: OFF_HEADERS }
      );
      const data = await r.json();
      if (!data || data.status !== 1 || !data.product) {
        return res.status(200).json({ found: false });
      }

      const p = data.product;
      const n = (p.nutriments ?? {}) as Record<string, unknown>;

      const kcalServing = kcalFrom(n, 'serving');
      const kcal100 = kcalFrom(n, '100g');
      const micros100 = microsFrom(n, '100g');
      const microsServing = microsFrom(n, 'serving');
      const per100g =
        kcal100 !== null
          ? {
              calories: Math.round(kcal100),
              protein_g: num(n['proteins_100g']),
              carbs_g: num(n['carbohydrates_100g']),
              fat_g: num(n['fat_100g']),
              micros: micros100,
            }
          : null;

      const useServing = kcalServing !== null;
      const product = {
        name: p.product_name || p.generic_name || 'Unknown product',
        brand: p.brands || null,
        serving_size: useServing ? p.serving_size || '1 serving' : '100g',
        calories: useServing ? Math.round(kcalServing) : per100g?.calories ?? null,
        protein_g: useServing ? num(n['proteins_serving']) : per100g?.protein_g ?? null,
        carbs_g: useServing ? num(n['carbohydrates_serving']) : per100g?.carbs_g ?? null,
        fat_g: useServing ? num(n['fat_serving']) : per100g?.fat_g ?? null,
        micros: useServing && Object.keys(microsServing).length > 0 ? microsServing : micros100,
        per_100g: per100g,
        has_macros: useServing || per100g !== null,
      };

      return res.status(200).json({ found: true, product });
    }

    if (query) {
      const url =
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
        `&search_simple=1&action=process&json=1&page_size=20`;
      const r = await fetch(url, { headers: OFF_HEADERS });
      const data = await r.json();

      const results = (Array.isArray(data?.products) ? data.products : [])
        .map((p: Record<string, unknown>) => {
          const n = (p.nutriments ?? {}) as Record<string, unknown>;
          const kcal100 = kcalFrom(n, '100g');
          const kcalServing = kcalFrom(n, 'serving');
          return {
            name: (p.product_name as string) || (p.generic_name as string) || '',
            brand: (p.brands as string) || null,
            serving_size: (p.serving_size as string) || null,
            kcal_per_100g: kcal100 !== null ? Math.round(kcal100) : null,
            protein_per_100g: num(n['proteins_100g']),
            carbs_per_100g: num(n['carbohydrates_100g']),
            fat_per_100g: num(n['fat_100g']),
            kcal_serving: kcalServing !== null ? Math.round(kcalServing) : null,
            protein_serving: num(n['proteins_serving']),
            carbs_serving: num(n['carbohydrates_serving']),
            fat_serving: num(n['fat_serving']),
            micros_per_100g: microsFrom(n, '100g'),
            micros_serving: microsFrom(n, 'serving'),
          };
        })
        .filter((p: { name: string }) => p.name);

      return res.status(200).json({ results });
    }

    return res.status(400).json({ error: 'Provide a barcode or query parameter' });
  } catch {
    return res.status(502).json({ error: 'Food lookup failed' });
  }
}
