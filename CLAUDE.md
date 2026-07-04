# NutriLog — Project Guide

Personal nutrition and calorie tracker: food logging (barcode scan, AI photo analysis,
text search, manual entry), micronutrient/fatty-acid tracking, supplements, activity
(calories burned; net = food − burned), weight trends, BMR/TDEE targets, and an AI
nutrition coach with Singapore food context.

**Live on Vercel for daily personal use. `main` is production — every push deploys.**
Agent sessions have no Supabase/Vercel/OpenRouter dashboard credentials: anything
requiring a dashboard must be written up as numbered steps for a human (see Ops runbook).

## Project map

```
api/                    Vercel serverless functions (the ONLY place secrets are used)
  analyze-food.ts       POST photo → OpenRouter vision model → nutrition JSON (max_tokens 750)
  coach.ts              POST chat turn → primary model, fallback on failure (max_tokens 400)
  search-food.ts        GET barcode/text → OpenFoodFacts proxy + unit normalization
src/
  App.tsx               App shell. NO router — manual tab state (useState<Tab>)
  types.ts              Central types. Row types mirror DB columns 1:1 — change with schema
  pages/                Today, History, CoachPage, Profile, Settings, Onboarding
  components/           22 presentational/interactive components (modals, charts, tabs)
  hooks/                ALL Supabase data access lives here (useFoodLog, useProfile,
                        useSupplementLog, useActivityLog, useCoach). UI never queries directly
  lib/
    supabase.ts         Client + ensureSession() (anonymous sign-in on first launch)
    api.ts              Client for the food endpoints (/api/analyze-food, /api/search-food);
                        coerces every LLM/upstream field. (useCoach.ts calls /api/coach itself)
    db.ts               Graceful-degradation helpers (missing column/table detection)
    calculations.ts     BMR (Mifflin-St Jeor), TDEE, goal adjustments, macro splits
    nutrientReference.ts Nutrient key registry (ALL_NUTRIENT_KEYS) + display groups
    date.ts, units.ts, image.ts   Date keys, metric/imperial, photo compression
supabase/
  schema.sql            CANONICAL full schema snapshot (see Database rules below)
  migrations/           Incremental migrations 002–004 (001 never existed)
```

Layering rules (enforced by convention, keep them):
- UI components → hooks → Supabase. No component queries Supabase directly.
- Client → serverless via `src/lib/api.ts` for food endpoints; the one exception is
  `useCoach.ts`, which fetches `/api/coach` directly (and best-effort logs each exchange
  to `coach_log` client-side — logging must never break the chat).
- `src/types.ts` mirrors the DB; any schema change updates it in the same commit.

## Commands

| Command | What it does | Caveats |
|---|---|---|
| `npm run dev` | Vite dev server, frontend only | **`/api/*` is NOT served** — scan/photo/search/coach fail. No Vite proxy exists. |
| `npx vercel dev` | Full stack incl. serverless functions | Needs `OPENROUTER_API_KEY` in `.env` |
| `npm run build` | `tsc && vite build` | Typecheck gates the build — **but only `src/`** (see warning) |
| `npm run preview` | Serve the built bundle | Frontend only, same `/api` caveat |
| `npm test` | `vitest run` — single-pass unit tests for `src/lib/*` | No lint script yet (see Known gaps). CI wiring not yet done — must be run locally. |

**Testing:** Vitest (chosen because Vite is already the toolchain — reuses `vite.config.ts`,
no separate transform pipeline). Tests are co-located as `<module>.test.ts` next to their
source, currently `src/lib/{calculations,units,date,db}.test.ts`. Run `npm test` (single
pass) or `npx vitest` (watch mode). **Adoption ratchet:** every bug fix gets a regression
test (written to fail on the pre-fix code); every new pure function in `src/lib/` gets
tests added with it. No numeric coverage target — the ratchet is the policy.

⚠️ **Typecheck gap:** `tsconfig.json` has `include: ["src"]`, so `api/*.ts` is never
typechecked locally — errors there surface only when Vercel builds the deploy. Until CI
fixes this (skill: `ci-and-quality-tooling`), check the functions explicitly after editing:

```bash
npx tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler api/*.ts
```

## Environment contract

| Var | Side | Required | Default / notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client (bundled) | yes | Safe to expose only because of RLS |
| `VITE_SUPABASE_ANON_KEY` | client (bundled) | yes | Same |
| `OPENROUTER_API_KEY` | server only | yes | Used by `analyze-food` + `coach` |
| `OPENROUTER_MODEL` | server only | no | Vision model for photo analysis; default `google/gemini-3-flash-preview` |
| `COACH_MODEL` | server only | no | Coach primary; default `deepseek/deepseek-v4-flash` |
| `COACH_FALLBACK_MODEL` | server only | no | Coach fallback; default `google/gemini-3-flash-preview` |
| `VERCEL_URL` | server, auto | — | Set by Vercel; used for HTTP-Referer |

Rules:
- A server-side var must **never** gain a `VITE_` prefix — `VITE_*` is bundled into the
  client and public. This is the whole reason `/api` exists.
- This table is the authoritative env list (`.env.example` currently omits the two
  `COACH_*` vars; they are documented in a comment at the bottom of `api/coach.ts`).
- `src/lib/supabase.ts` falls back to `http://localhost:54321` / `'missing-key'` when
  unset — misconfiguration fails at **runtime**, not build time.

## Database — read before touching schema

Six tables, all with RLS + owner policy + `user_id uuid not null default auth.uid()`:
`user_profile`, `food_log`, `weight_log`, `supplement_log`, `activity_log`, `coach_log`.
`food_log`/`supplement_log` carry ~20 micronutrient/fatty-acid columns each. Indexes on
`(user_id, log_date)` (coach_log: `(user_id, created_at)`).

Hard rules (skill: `database-schema-evolution`):
1. `supabase/schema.sql` is the **canonical snapshot**. Any migration must update it in
   the same commit so a fresh install from schema.sql alone reaches the same end state.
2. `supabase/migrations/` is incremental and partial: **001 never existed** (baseline =
   schema.sql) and **coach_log has no migration** (it shipped via schema.sql). Numbering
   continues from 005.
3. Migrations are **applied by a human pasting SQL into the Supabase dashboard SQL
   editor** — there is no runner, no Supabase CLI config. Therefore every migration must
   be idempotent (`create table if not exists`, `add column if not exists`) and safe to
   re-run, and any change that includes one must end with explicit human steps.
4. Every new table: `enable row level security` + one `for all to authenticated` policy
   with BOTH `using` and `with check` on `auth.uid() = user_id`, and `user_id` defaulting
   to `auth.uid()` server-side. A table without a policy is invisible to the app, not open.
5. **Degradation contract:** deployed clients may run against a DB whose migration hasn't
   been applied yet. `src/lib/db.ts` detects missing columns (PGRST204 / "schema cache")
   and missing tables (42P01 / PGRST205); write hooks retry with nutrient fields stripped
   and toast a migration notice. New nutrient columns MUST be added to `ALL_NUTRIENT_KEYS`
   in `src/lib/nutrientReference.ts` or stripping (and micro coercion in `lib/api.ts`)
   won't know about them.

## Ops runbook (human steps — sessions have no dashboard access)

- **Deploy:** push to `main`; Vercel auto-builds and deploys (framework preset: Vite).
  There is no staging environment. Verify locally before pushing (skill:
  `verification-before-done`).
- **Apply a migration:** (human) Supabase dashboard → SQL Editor → paste the migration
  file → Run → then verify in the app that the migration notice toast stops appearing.
- **Change/add an env var:** (human) Vercel dashboard → Project → Settings → Environment
  Variables → add/edit → **redeploy** (env changes don't apply to existing deployments).
  Update `.env.example` and the table above in the same PR.
- **Fresh Supabase project:** run `supabase/schema.sql` in the SQL editor (NOT the
  migrations — schema.sql is the complete baseline), then enable
  Authentication → Sign In / Up → **Allow anonymous sign-ins**.
- **Health check without credentials:** `curl -s https://<prod-domain>/api/search-food?query=apple`
  should return JSON results; `curl -s -X POST https://<prod-domain>/api/coach` should
  return a 400 JSON error (proves the function is up). The SPA loading = frontend fine.
- **Cost monitoring:** (human) OpenRouter dashboard → usage. In-app: `coach_log` stores
  `model` + `total_tokens` per exchange and is queryable via the app's own Supabase access.

## Conventions

- **TypeScript strict**, no `any`. `tsconfig` is strict; keep it that way.
- **Commits:** imperative capitalized subject (≤ ~65 chars), descriptive multi-line body
  explaining why. Linear history, no merge commits. Direct-to-main is the current norm
  for verified small changes; branch for risky/schema/security work (skill:
  `git-workflow-hygiene`).
- **Never trust LLM output:** every field from `/api/analyze-food` and search results is
  coerced (`toNum`, string checks) in `src/lib/api.ts`. Keep that pattern for new fields.
- **Cost caps are deliberate:** `max_tokens: 750` (analyze-food), `max_tokens: 400`
  (coach). Preserve or consciously re-decide them when editing these calls (skill:
  `llm-feature-engineering`).
- **Errors to users are friendly strings**, upstream detail is truncated (`slice(0, 300)`
  / `slice(0, 600)`) — never pass raw upstream bodies through.
- **Singapore context** in the coach system prompt (local dishes are first-class) is a
  product decision, not an accident. Don't "clean it up".

## Known gaps (each has a skill that fixes it)

| Gap | Fix with |
|---|---|
| Harness exists (Vitest) with first tests in `lib/{calculations,units,date,db}.ts`; other `src/lib/*` and all of `src/hooks/`, `src/components/`, `src/pages/`, `api/*` still untested | `test-harness-bootstrap` (rank next tests by the tier list; hooks/components are Tier 4 — extract pure logic first) |
| No CI — nothing gates pushes to prod, incl. the new `npm test` | `ci-and-quality-tooling` |
| `api/*.ts` untypechecked locally | `ci-and-quality-tooling` (tsconfig audit step) |
| No lint/format config | `ci-and-quality-tooling` (adopt after CI is green) |
| `coach_log` missing from `migrations/` | `database-schema-evolution` (backfill as 005 if older deployments matter) |
| `.env.example` missing `COACH_*` vars | trivial doc fix; keep table above in sync |

## Skill index — when to reach for what

| Situation | Skill |
|---|---|
| First session / unfamiliar area of the code | `codebase-orientation` |
| Bug, error, regression, "why does this fail" | `systematic-debugging` |
| New user-facing feature spanning layers | `vertical-feature-implementation` |
| About to say "done" / commit any change | `verification-before-done` |
| Adding the first tests / deciding what to test | `test-harness-bootstrap` |
| Adding CI, lint, format, typecheck coverage | `ci-and-quality-tooling` |
| Any schema/migration/RLS change | `database-schema-evolution` |
| New/changed serverless endpoint | `serverless-api-design` |
| Prompt, model choice, LLM cost/output issues | `llm-feature-engineering` |
| Reviewing a diff (incl. your own before commit) | `code-review-standards` |
| Auth/secrets/RLS/user-data change, "is this secure" | `security-audit` |
| Committing, branching, PRs | `git-workflow-hygiene` |
| "What should I build next", triage, roadmap | `prioritization-and-roadmapping` |
| Multi-user, real accounts, launch readiness | `productionize-personal-app` |
| Adding/editing skills or this file | `skill-library-maintenance` |

Architecture narrative, data-flow walkthroughs, and roadmap context: `docs/ARCHITECTURE.md`.
