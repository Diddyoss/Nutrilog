# NutriLog

Personal nutrition and calorie tracker. Vite + React 18 + TypeScript, Supabase (Postgres + anonymous auth), AI food-photo analysis via OpenRouter (any vision model) through Vercel serverless functions, OpenFoodFacts barcode/search proxy.

## Setup

1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL editor, and enable **Authentication → Sign In / Up → Allow anonymous sign-ins**. Existing projects: apply any new files in `supabase/migrations/` in order (`005_add_custom_food.sql` saves manually entered foods for re-logging; `006_add_ai_usage.sql` enables the daily photo-analysis limit).
2. **Env vars**: copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Install & run**:

```bash
npm install
npm run dev          # frontend only (scan/photo/search lookups need the API)
npx vercel dev       # full stack — runs /api functions locally (needs OPENROUTER_API_KEY)
```

## Deploy (Vercel)

Import the repo into Vercel (framework preset: Vite) and set these environment variables:

- `OPENROUTER_API_KEY` — server-side only, used by `/api/analyze-food`
- `OPENROUTER_MODEL` — optional, any vision-capable model (defaults to `google/gemini-3-flash-preview`)
- `AI_DAILY_LIMIT` — optional, photo analyses allowed per user per rolling 24h (default `30`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The OpenRouter key is never bundled into the client — all AI calls go through `/api/analyze-food`, and all OpenFoodFacts calls go through `/api/search-food`.

`/api/analyze-food` spends paid credits, so it requires the caller's Supabase session token and caps each user at `AI_DAILY_LIMIT` analyses per 24h. It reads the Supabase URL and anon key from `SUPABASE_URL`/`SUPABASE_ANON_KEY`, falling back to the `VITE_` variables above, and refuses requests if neither is set. Until migration 006 is run the limit is not enforced (sign-in still is).
