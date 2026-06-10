# NutriLog

Personal nutrition and calorie tracker. Vite + React 18 + TypeScript, Supabase (Postgres + anonymous auth), Anthropic AI food-photo analysis via Vercel serverless functions, OpenFoodFacts barcode/search proxy.

## Setup

1. **Supabase**: create a project, run `supabase/schema.sql` in the SQL editor, and enable **Authentication → Sign In / Up → Allow anonymous sign-ins**.
2. **Env vars**: copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Install & run**:

```bash
npm install
npm run dev          # frontend only (scan/photo/search lookups need the API)
npx vercel dev       # full stack — runs /api functions locally (needs ANTHROPIC_API_KEY)
```

## Deploy (Vercel)

Import the repo into Vercel (framework preset: Vite) and set these environment variables:

- `ANTHROPIC_API_KEY` — server-side only, used by `/api/analyze-food`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The Anthropic key is never bundled into the client — all AI calls go through `/api/analyze-food`, and all OpenFoodFacts calls go through `/api/search-food`.
