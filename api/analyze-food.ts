import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Any vision-capable OpenRouter model. Override with OPENROUTER_MODEL.
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';

const SYSTEM_PROMPT = `You are a nutrition expert. Analyse the food in this image and return ONLY
a raw JSON object — no markdown, no code fences, no explanation. Structure:
{
  "food_name": "descriptive name",
  "serving_size": "estimated portion e.g. 1 bowl / 200g / 1 cup",
  "calories": 000,
  "protein_g": 00,
  "carbs_g": 00,
  "fat_g": 00,
  "saturated_fat_g": 00,
  "unsaturated_fat_g": 00,
  "trans_fat_g": 00,
  "fiber_g": 00,
  "omega_3_g": 0.0,
  "omega_6_g": 0.0,
  "monounsaturated_fat_g": 00,
  "polyunsaturated_fat_g": 00,
  "vitamin_a_mcg": 00,
  "vitamin_c_mg": 00,
  "vitamin_d_mcg": 00,
  "vitamin_e_mg": 00,
  "vitamin_k_mcg": 00,
  "vitamin_b6_mg": 00,
  "vitamin_b12_mcg": 00,
  "folate_mcg": 00,
  "calcium_mg": 00,
  "iron_mg": 00,
  "magnesium_mg": 00,
  "potassium_mg": 00,
  "zinc_mg": 00,
  "sodium_mg": 00,
  "confidence": "high | medium | low",
  "note": "one short sentence about the estimate"
}
Rules: if multiple foods are visible, estimate the total for the whole meal.
Macro grams (protein/carbs/fat) and calories are integers.
Micronutrient values are rough estimates based on typical composition of the identified food —
treat them as directional, not lab-precise. Never return null; use 0 if a nutrient is genuinely
absent or unknown.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
  }

  const { image, media_type, context } = (req.body ?? {}) as {
    image?: string;
    media_type?: string;
    context?: string;
  };

  if (!image) return res.status(400).json({ error: 'No image provided' });

  const mediaType = media_type === 'image/png' ? 'image/png' : 'image/jpeg';
  const contextNote =
    typeof context === 'string' && context.trim()
      ? ` Additional context from the user: "${context.trim().slice(0, 300)}"`
      : '';

  // OpenAI-compatible content blocks (OpenRouter uses image_url with a data URL).
  const userContent = [
    { type: 'text', text: `Analyse this food and return the JSON.${contextNote}` },
    { type: 'image_url', image_url: { url: `data:${mediaType};base64,${image}` } },
  ];

  try {
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'NutriLog',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 750,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('OpenRouter error', r.status, detail);
      return res
        .status(502)
        .json({ error: 'AI analysis failed — try again', status: r.status, detail: detail.slice(0, 600) });
    }

    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data?.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : '';

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch {
      return res.status(422).json({ error: 'Could not parse AI response', raw: text });
    }
  } catch {
    return res.status(502).json({ error: 'AI analysis failed — try again' });
  }
}
