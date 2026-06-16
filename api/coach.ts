import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mirrors the fetch-based OpenRouter pattern in /api/analyze-food.ts.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are a concise, practical nutrition coach embedded in a food tracking app.
The user's profile and today's food log are provided with every message.
Rules:
- Always reference their actual numbers — never give generic advice
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY is not configured' });
  }

  const { profile, todayLog, conversationHistory, userMessage } = (req.body ?? {}) as {
    profile?: CoachProfile;
    todayLog?: TodayLog;
    conversationHistory?: HistoryMessage[];
    userMessage?: string;
  };

  if (!profile || !todayLog || !userMessage || !userMessage.trim()) {
    return res.status(400).json({ error: 'Missing profile, todayLog, or userMessage' });
  }

  const meals = Array.isArray(todayLog.meals) ? todayLog.meals : [];
  const mealsText =
    meals.map((m) => `${m.meal}: ${m.food_name} (${m.calories} kcal)`).join(', ') || 'none yet';
  const remaining = profile.calorie_target - todayLog.calories;

  const enrichedMessage = `Profile: ${profile.goal} goal | ${profile.calorie_target} kcal/day | ${profile.protein_target_g}g P / ${profile.carbs_target_g}g C / ${profile.fat_target_g}g F | ${profile.activity_level} | ${profile.age}y ${profile.sex} ${profile.weight_kg}kg

Today so far (${new Date().toLocaleDateString('en-SG')}):
Consumed: ${todayLog.calories} kcal | ${todayLog.protein_g}g P | ${todayLog.carbs_g}g C | ${todayLog.fat_g}g F
Remaining: ${remaining} kcal
Meals logged: ${mealsText}

User message: ${userMessage}`;

  const history = (Array.isArray(conversationHistory) ? conversationHistory : []).filter(
    (m): m is HistoryMessage =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );

  try {
    const r = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173',
        'X-Title': 'NutriLog Coach',
      },
      body: JSON.stringify({
        model: 'openrouter/fusion',
        max_tokens: 400,
        tool_choice: 'required', // forces Fusion to run on every request
        preset: 'general-budget', // Budget preset: Gemini 3 Flash + Kimi K2.6 + DeepSeek V4 Pro
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: enrichedMessage },
        ],
      }),
    });

    if (!r.ok) {
      const details = await r.text().catch(() => '');
      return res
        .status(502)
        .json({ error: 'Coach is unavailable right now — try again', details: details.slice(0, 500) });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({ error: 'Coach returned an empty response — try again' });
    }

    return res.status(200).json({
      reply: reply.trim(),
      usage: { totalTokens: data?.usage?.total_tokens ?? 0 },
    });
  } catch {
    return res.status(502).json({ error: 'Coach request failed — try again' });
  }
}

// Required env vars:
// - OPENROUTER_API_KEY  server-side OpenRouter key (already set in Vercel; the only new var needed)
// - VERCEL_URL          provided automatically by Vercel; optional, used for the HTTP-Referer header
