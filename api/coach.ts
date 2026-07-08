import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mirrors the fetch-based OpenRouter pattern in /api/analyze-food.ts.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Text-only coaching task. DeepSeek V4 primary, Gemini 3 Flash fallback.
// Both overridable via env without a code change.
const PRIMARY_MODEL = process.env.COACH_MODEL || 'deepseek/deepseek-v4-flash';
const FALLBACK_MODEL = process.env.COACH_FALLBACK_MODEL || 'google/gemini-3-flash-preview';

const SYSTEM_PROMPT = `You are a concise, practical nutrition coach embedded in a food tracking app.
The user's profile and today's food log are provided with every message. You may also be given
their recent days (calorie/macro totals) and recent weight entries.
Rules:
- Always reference their actual numbers — never give generic advice
- When the question is about progress, consistency or trends, use the recent days and weight
  history (e.g. weekly averages, whether they trend over/under target, weight direction) rather
  than only today; for "what should I eat now" type questions, today's numbers are the priority
- Keep responses under 180 words
- Be direct and encouraging, not preachy or repetitive
- Singapore context: local dishes (chicken rice, laksa, roti prata, mixed rice,
  bak chor mee) are legitimate meals — treat them normally, calculate their macros
  if relevant, don't suggest replacing them with Western foods
- If the user asks something unrelated to nutrition or fitness, politely redirect
- Format: plain prose only, no bullet points, no markdown headers`;

interface CoachProfile {
  goal: string;
  activity_level: string;
  calorie_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  weight_kg: number;
  age: number;
  sex: string;
}

interface CoachMeal {
  meal: string;
  food_name: string;
  calories: number;
}

interface TodayLog {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: CoachMeal[];
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

type ChatMessage = { role: string; content: string };

type ModelResult =
  | { ok: true; reply: string; totalTokens: number }
  | { ok: false; detail: string };

/** Call a single OpenRouter model. Returns ok:false with a short detail on any failure. */
async function callModel(model: string, messages: ChatMessage[]): Promise<ModelResult> {
  try {
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173',
        'X-Title': 'NutriLog Coach',
      },
      body: JSON.stringify({ model, max_tokens: 400, messages }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return { ok: false, detail: text.slice(0, 300) || `HTTP ${r.status}` };
    }
    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) return { ok: false, detail: 'empty response' };
    return { ok: true, reply: reply.trim(), totalTokens: data?.usage?.total_tokens ?? 0 };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'request failed' };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
  }

  const { profile, todayLog, conversationHistory, userMessage, recentDays, recentWeights } =
    (req.body ?? {}) as {
      profile?: CoachProfile;
      todayLog?: TodayLog;
      conversationHistory?: HistoryMessage[];
      userMessage?: string;
      recentDays?: Array<{ date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>;
      recentWeights?: Array<{ date: string; weight_kg: number }>;
    };

  if (!profile || !todayLog || !userMessage || !userMessage.trim()) {
    return res.status(400).json({ error: 'Missing profile, todayLog, or userMessage' });
  }

  const meals = Array.isArray(todayLog.meals) ? todayLog.meals : [];
  const mealsText =
    meals.map((m) => `${m.meal}: ${m.food_name} (${m.calories} kcal)`).join(', ') || 'none yet';
  const remaining = profile.calorie_target - todayLog.calories;

  const days = Array.isArray(recentDays) ? recentDays : [];
  const recentBlock = days.length
    ? `\n\nRecent days (most recent first):\n` +
      days
        .map(
          (d) =>
            `${d.date}: ${Math.round(d.calories)} kcal | ${Math.round(d.protein_g)}g P | ${Math.round(d.carbs_g)}g C | ${Math.round(d.fat_g)}g F`
        )
        .join('\n')
    : '';

  const weights = Array.isArray(recentWeights) ? recentWeights : [];
  const weightBlock = weights.length
    ? `\n\nRecent weight: ` + weights.map((w) => `${w.weight_kg}kg (${w.date})`).join(', ')
    : '';

  const enrichedMessage = `Profile: ${profile.goal} goal | ${profile.calorie_target} kcal/day | ${profile.protein_target_g}g P / ${profile.carbs_target_g}g C / ${profile.fat_target_g}g F | ${profile.activity_level} | ${profile.age}y ${profile.sex} ${profile.weight_kg}kg

Today so far (${new Date().toLocaleDateString('en-SG')}):
Consumed: ${todayLog.calories} kcal | ${todayLog.protein_g}g P | ${todayLog.carbs_g}g C | ${todayLog.fat_g}g F
Remaining: ${remaining} kcal
Meals logged: ${mealsText}${recentBlock}${weightBlock}

User message: ${userMessage}`;

  const history = (Array.isArray(conversationHistory) ? conversationHistory : []).filter(
    (m): m is HistoryMessage =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: enrichedMessage },
  ];

  // Try DeepSeek V4 first; fall back to Gemini 3 Flash if it fails or returns nothing.
  const primary = await callModel(PRIMARY_MODEL, messages);
  if (primary.ok) {
    return res
      .status(200)
      .json({ reply: primary.reply, usage: { totalTokens: primary.totalTokens }, model: PRIMARY_MODEL });
  }

  const fallback = await callModel(FALLBACK_MODEL, messages);
  if (fallback.ok) {
    return res
      .status(200)
      .json({ reply: fallback.reply, usage: { totalTokens: fallback.totalTokens }, model: FALLBACK_MODEL });
  }

  return res.status(502).json({
    error: 'Coach is unavailable right now — try again',
    details: `${PRIMARY_MODEL}: ${primary.detail} | ${FALLBACK_MODEL}: ${fallback.detail}`,
  });
}

// Required env vars:
// - OPENROUTER_API_KEY     server-side OpenRouter key (already set in Vercel; the only required var)
// Optional env vars:
// - COACH_MODEL            primary model (default deepseek/deepseek-v4-flash)
// - COACH_FALLBACK_MODEL   fallback model (default google/gemini-3-flash-preview)
// - VERCEL_URL             provided automatically by Vercel; used for the HTTP-Referer header
