import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a nutrition expert. Analyse the food in this image and return ONLY
a raw JSON object — no markdown, no code fences, no explanation. Structure:
{
  "food_name": "descriptive name",
  "serving_size": "estimated portion e.g. 1 bowl / 200g / 1 cup",
  "calories": 000,
  "protein_g": 00,
  "carbs_g": 00,
  "fat_g": 00,
  "confidence": "high | medium | low",
  "note": "one short sentence about the estimate"
}
Rules: if multiple foods are visible, estimate the total for the whole meal.
Never return null for numeric fields — use 0 if unknown. All numbers are integers.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, description, media_type } = (req.body ?? {}) as {
    image?: string;
    description?: string;
    media_type?: string;
  };

  if (!image && !description) return res.status(400).json({ error: 'No image provided' });

  const mediaType: 'image/jpeg' | 'image/png' = media_type === 'image/png' ? 'image/png' : 'image/jpeg';

  const content = image
    ? [
        { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: image } },
        { type: 'text' as const, text: 'Analyse this food and return the JSON.' },
      ]
    : [
        {
          type: 'text' as const,
          text: `Analyse this food description and return the JSON. Description: "${description}"`,
        },
      ];

  try {
    const response = await client.messages.create({
      model: 'claude-fable-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const block = response.content[0];
    const text = block && block.type === 'text' ? block.text : '';

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
