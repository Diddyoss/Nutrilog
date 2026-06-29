# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install           # install dependencies
npm run dev           # frontend only (Vite dev server on :5173)
npx vercel dev        # full stack — runs /api/* serverless functions locally (needs OPENROUTER_API_KEY)
npm run build         # tsc + vite build
npm run preview       # preview the production build
```

There is no test suite and no linter configured.

## Architecture

NutriLog is a mobile-first SPA (Vite + React 18 + TypeScript) backed by Supabase (Postgres + anonymous auth) and Vercel serverless functions. The app structure:

```
src/
  App.tsx              — root: auth gate → onboarding gate → tab router
  types.ts             — all shared TypeScript types (single source of truth)
  pages/               — one component per tab (Today, History, CoachPage, Profile, Settings, Onboarding)
  components/          — shared UI pieces used across pages
  hooks/               — data-fetching hooks (one per Supabase table)
  lib/                 — pure utilities: api.ts, calculations.ts, db.ts, date.ts, image.ts, units.ts,
                         supabase.ts, nutrientReference.ts
api/
  analyze-food.ts      — POST: accepts base64 image → OpenRouter vision model → JSON nutrition
  search-food.ts       — GET: barcode lookup or text search via OpenFoodFacts
  coach.ts             — POST: nutrition coach chat (DeepSeek V4 primary, Gemini Flash fallback)
supabase/
  schema.sql           — full schema; run once in Supabase SQL editor
  migrations/          — incremental ALTER TABLE files for new columns (002 micros, 003 fatty acids, 004 activity)
```

### Data flow

1. **Auth**: `useProfile` calls `ensureSession()` on mount; this signs in anonymously if no session exists. All Supabase tables use RLS scoped to `auth.uid()`.
2. **Hooks**: each hook (`useFoodLog`, `useProfile`, `useActivityLog`, `useSupplementLog`, `useCoach`) owns its slice of data and exposes `add/update/delete` mutations that re-fetch after each write.
3. **Food entry pipeline**: user captures/searches food → produces a `FoodDraft` → `FoodModal` confirms/edits it → hook writes `FoodSaveFields` to `food_log`. The `FoodDraft` carries an optional `perGram` field so macros/micros rescale proportionally when the user changes serving size.
4. **Micronutrient fallback**: if a Supabase insert fails with PGRST204 ("column not found in schema cache"), `db.ts` strips nutrient fields and retries with core columns only. This keeps the app working when migrations haven't been run yet.
5. **Coach**: `useCoach` holds conversation in `sessionStorage` (resets per-session). Every message sends the full profile + today's log + recent days/weights to `/api/coach`. The API tries the primary model and falls back automatically.

### Key types (`src/types.ts`)

- `NutrientKey` — union of all trackable micronutrient column names; these are identical to DB column names (no remapping needed).
- `FoodDraft` — ephemeral in-flight food data before DB save; includes optional `perGram` for serving rescaling and `micros` for micronutrients.
- `FoodSaveFields` — fields actually written to `food_log`; macros required, all `NutrientValues` required (zeroed when unknown).
- `Profile` — mirrors `user_profile` table; `calorie_override` takes precedence over `calorie_target` when set.

### Serverless API conventions (`api/`)

- Functions use `@vercel/node` types (`VercelRequest`, `VercelResponse`).
- All AI calls go through OpenRouter using `OPENROUTER_API_KEY` (server-side only, never `VITE_`-prefixed).
- `analyze-food.ts` defaults to `anthropic/claude-3.5-sonnet`; overridable via `OPENROUTER_MODEL`.
- `coach.ts` uses DeepSeek V4 Flash primary with Gemini Flash fallback; overridable via `COACH_MODEL` / `COACH_FALLBACK_MODEL`.
- OpenFoodFacts values come in grams; `MICRO_MAP` in `search-food.ts` defines the conversion factors (×1000 for mg, ×1e6 for mcg).

### Database

Run `supabase/schema.sql` for a fresh setup. For existing databases, apply `supabase/migrations/` in order. The schema has five main tables: `user_profile`, `food_log`, `weight_log`, `supplement_log`, `activity_log`, and `coach_log`. All have RLS enabled; authenticated (including anonymous) users see only their own rows.

Calorie targets are calculated from BMR (Mifflin-St Jeor) × activity multiplier ± goal adjustment in `src/lib/calculations.ts` and stored on the profile. When saving core stats, `saveProfile` always recalculates and persists the targets; `updateProfile` patches other fields without recalculating.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client + server | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client + server | Supabase anon key |
| `OPENROUTER_API_KEY` | server only | AI calls (food photo + coach) |
| `OPENROUTER_MODEL` | server only | Vision model override (optional) |
| `COACH_MODEL` | server only | Coach primary model override (optional) |
| `COACH_FALLBACK_MODEL` | server only | Coach fallback model override (optional) |
