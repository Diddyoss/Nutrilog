import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Access control
//
// Every request must carry the caller's Supabase session token. Because the
// app signs people in anonymously, a token alone is cheap to obtain, so each
// user is also capped at AI_DAILY_LIMIT analyses per rolling 24h (ai_usage
// table, migration 006). Kept in this file on purpose: no relative imports,
// so nothing depends on how Vercel resolves ESM paths.
// ---------------------------------------------------------------------------

export const DEFAULT_DAILY_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export interface AccessDeps {
  /** User id for a valid session token, or null if invalid/expired. */
  getUserId(token: string): Promise<string | null>;
  /** Analyses recorded since `sinceIso`, or 'no-table' if migration 006 hasn't run. */
  countSince(sinceIso: string): Promise<number | 'no-table'>;
  /** Record one analysis against the caller. */
  record(): Promise<void>;
}

export function bearerToken(header: string | string[] | undefined): string | null {
  const h = Array.isArray(header) ? header[0] : header;
  const m = h?.match(/^Bearer\s+(\S+)\s*$/i);
  return m ? m[1] : null;
}

export function dailyLimitFrom(value: string | undefined): number {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

export async function authorizePhotoAnalysis(
  token: string | null,
  deps: AccessDeps,
  limit: number,
  now: Date = new Date()
): Promise<AccessResult> {
  if (!token) return { ok: false, status: 401, error: 'Sign-in required' };
  const userId = await deps.getUserId(token);
  if (!userId) {
    return { ok: false, status: 401, error: 'Session expired — reopen the app and try again' };
  }
  const used = await deps.countSince(new Date(now.getTime() - DAY_MS).toISOString());
  if (used === 'no-table') {
    // Fail open so photo analysis keeps working before the migration is run;
    // the auth check above still applies.
    console.warn('ai_usage table missing — run migration 006 to enforce the daily photo limit');
    return { ok: true, userId };
  }
  if (used >= limit) {
    return {
      ok: false,
      status: 429,
      error: `Daily photo limit reached (${limit} per 24h) — use Search or Manual for now`,
    };
  }
  await deps.record();
  return { ok: true, userId };
}

function supabaseConfig(): { url: string; anonKey: string } | null {
  // Vercel exposes every env var to functions, so the VITE_ ones set for the
  // frontend work here too; SUPABASE_* take precedence if defined.
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/** Supabase-backed deps; queries run as the caller, so RLS scopes them to their rows. */
function supabaseDeps(cfg: { url: string; anonKey: string }, token: string): AccessDeps {
  const db = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return {
    async getUserId(t) {
      const { data, error } = await db.auth.getUser(t);
      return error || !data.user ? null : data.user.id;
    },
    async countSince(sinceIso) {
      // Not a HEAD request: HEAD errors carry no body, so the missing-table code would be lost.
      const { count, error } = await db
        .from('ai_usage')
        .select('id', { count: 'exact' })
        .gte('created_at', sinceIso)
        .limit(1);
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return 'no-table';
        throw error;
      }
      return count ?? 0;
    },
    async record() {
      const { error } = await db.from('ai_usage').insert({ kind: 'photo' });
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------

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

  // Auth + daily limit before any paid work, after cheap validation so a
  // malformed request never uses up a slot. Fails closed if Supabase isn't configured.
  const cfg = supabaseConfig();
  if (!cfg) return res.status(500).json({ error: 'Supabase is not configured on the server' });
  const token = bearerToken(req.headers.authorization);
  try {
    const access = await authorizePhotoAnalysis(
      token,
      supabaseDeps(cfg, token ?? ''),
      dailyLimitFrom(process.env.AI_DAILY_LIMIT)
    );
    if (!access.ok) return res.status(access.status).json({ error: access.error });
  } catch (e) {
    console.error('Access check failed', e);
    return res.status(503).json({ error: 'Could not verify your session — try again' });
  }

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
      // Upstream detail goes to the server log only, never to the client.
      console.error('OpenRouter error', r.status, detail.slice(0, 600));
      return res.status(502).json({ error: 'AI analysis failed — try again' });
    }

    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content;
    const text = typeof raw === 'string' ? raw : '';

    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch {
      console.error('Unparseable AI response', text.slice(0, 600));
      return res.status(422).json({ error: 'Could not read the AI response — try another photo' });
    }
  } catch {
    return res.status(502).json({ error: 'AI analysis failed — try again' });
  }
}
