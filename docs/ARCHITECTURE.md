# NutriLog Architecture

Companion to `CLAUDE.md` (which holds the operational facts: commands, env vars, DB
rules, runbook). This document explains how the system fits together and why it is
shaped the way it is. Update it when a data flow or a design decision changes.

## System overview

```
┌─────────────────────────────┐
│  Browser SPA (Vite/React)   │
│  src/pages → components     │
│  src/hooks  = data layer    │
└──────┬───────────────┬──────┘
       │               │
       │ supabase-js   │ fetch /api/*
       │ (RLS-scoped)  │ (no secrets in client)
       ▼               ▼
┌──────────────┐  ┌──────────────────────────┐
│   Supabase   │  │  Vercel serverless (api/) │
│  Postgres +  │  │  analyze-food ─┐          │
│  anon auth   │  │  coach ────────┼─► OpenRouter (LLMs)
│  6 tables,   │  │  search-food ──► OpenFoodFacts
│  RLS on all  │  └──────────────────────────┘
└──────────────┘
```

Two independent paths out of the client:
1. **Data path** — hooks talk straight to Postgres through `supabase-js`. There is no
   application server between the SPA and the database; Row-Level Security *is* the
   authorization layer.
2. **Integration path** — anything involving a secret or a third-party API goes through
   a Vercel function. The client never holds the OpenRouter key.

Identity: `ensureSession()` (`src/lib/supabase.ts`) signs in **anonymously** on first
launch. One device = one user. There are no accounts, no login UI.

## Data flow walkthroughs

### A. Photo → logged food

1. `PhotoTab.tsx` captures/uploads an image; `src/lib/image.ts` downscales and
   compresses it to keep the request small.
2. `analyzeFoodImage()` in `src/lib/api.ts` POSTs base64 + optional user context to
   `/api/analyze-food`.
3. `api/analyze-food.ts` prompts a vision model (env `OPENROUTER_MODEL`) demanding **raw
   JSON only** for the full nutrient schema, `max_tokens: 750`. It strips code fences,
   `JSON.parse`s, and returns 422 with the raw text if unparseable (client can show it).
4. Back in `lib/api.ts`, every field is coerced (`toNum`, whitelisted strings) into a
   `FoodDraft` — the model's types are never trusted.
5. `FoodModal.tsx` lets the user adjust; `useFoodLog.addEntry` inserts into `food_log`.
   If the insert fails with a missing-column error (migration not applied), it retries
   with nutrient fields stripped and toasts a migration notice (`src/lib/db.ts`).

### B. Coach turn

1. `CoachPage.tsx` → `useCoach.sendMessage`. The hook assembles context from live app
   state: profile (with `calorie_override ?? calorie_target`), today's totals + meals,
   recent-day totals, recent weights, and the **last 8 messages only** (deliberate token
   cap). Conversation lives in `sessionStorage` — survives tab switches, resets per session.
2. `useCoach` fetches `/api/coach` directly (the one endpoint not routed through
   `lib/api.ts`).
3. `api/coach.ts` builds one enriched user message embedding all numbers, prepends the
   system prompt (concise coach, ≤180 words, Singapore dishes are first-class,
   plain-prose output), and calls the primary model (`COACH_MODEL`), `max_tokens: 400`.
   On any failure it retries once with `COACH_FALLBACK_MODEL`; if both fail, 502 with
   truncated per-model detail. The response includes which model answered.
4. On success the client best-effort inserts the exchange into `coach_log`
   (`user_message`, `assistant_reply`, `model`, `total_tokens`) — a fire-and-forget
   usage/audit trail that must never break the chat.

### C. Barcode / text search → logged food

1. `ScanTab.tsx` (ZXing camera decode) or `SearchTab.tsx` → `lookupBarcode()` /
   `searchFoods()` in `lib/api.ts` → GET `/api/search-food?barcode=…|query=…`.
2. `api/search-food.ts` proxies OpenFoodFacts and normalizes units: kJ→kcal (÷4.184),
   OFF's gram-based micronutrients → our mg/mcg columns (`MICRO_MAP` factors), and
   derives `unsaturated_fat_g = fat − saturated − trans` (clamped ≥ 0).
3. `draftFromSearchResult()` prefers the product's **natural serving** over a flat 100g:
   per-serving nutrition if present → else per-100g scaled to the serving's grams
   (parsed from strings like "1 tbsp (14 g)") → else 100g fallback. A `perGram` basis
   rides along so `FoodModal` can rescale when the user edits the amount.

## Design decisions (and when to revisit them)

- **Anonymous auth, no accounts.** Right for a single-user personal app: zero friction,
  RLS still enforces isolation. Revisit the moment a second real user matters — see the
  `productionize-personal-app` skill; the migration path is *linking* the anonymous user
  to a permanent identity, never creating a fresh user (that orphans all data).
- **Client → Postgres direct (no API layer for CRUD).** Cuts an entire tier; RLS carries
  authorization. Trade-off: business rules live in the client, and the DB is only as
  safe as the policies. Revisit for multi-user (rate limits, server-side validation).
- **No router.** Six tabs, manual `useState<Tab>` in `App.tsx`. URLs don't deep-link.
  Fine at this size; adopt a router only when sharing/deep-linking becomes a feature.
- **Graceful schema degradation** (`lib/db.ts`). Exists because migrations are applied
  by hand and deploys are instant — the client can be *ahead of* the database. Writes
  must degrade (strip nutrient fields, toast) rather than fail. Keep this contract until
  migrations are automated.
- **Secrets only in serverless functions.** The `/api` tier exists almost entirely for
  this. Anything needing `OPENROUTER_API_KEY` (or any future paid/secret upstream) goes
  there; the endpoints are otherwise **unauthenticated** — cost caps (`max_tokens`,
  payload limits) are the blast-radius control. See `serverless-api-design` +
  `security-audit` skills.
- **Two models for the coach, one for vision.** Text coaching uses a cheap primary with
  an independent fallback (different provider) for availability; vision uses one model.
  All env-overridable so model churn never needs a code change.

## Roadmap context

Two tracks, interleaved (see `prioritization-and-roadmapping` skill for the method):

- **Track A — polish for personal use** (compounding daily value): reliability
  (✅ done 2026-07: Vitest harness on `lib/{calculations,units,date,db}` + CI running
  typecheck/build/test on every push — next rungs: lint/format, then widening test
  coverage per the tier list), insight features on already-logged data (trends,
  weekly summaries, coach awareness of micros), UX refinements.
- **Track B — grow toward multi-user** (option value): real auth with anonymous-account
  linking, server-mediated writes or per-user quotas for paid endpoints, rate limiting,
  error reporting, backups. The original gate — don't start Track B until Track A's
  safety net (tests + CI) exists — is now satisfied; Track B items are unblocked and
  compete on the normal prioritization rubric. Note: `/api/coach` and `/api/analyze-food`
  are unauthenticated paid endpoints live today (cost-capped but unmetered) — the
  security-audit validation flagged this as the top Track B candidate.

Rule of thumb inherited from the outgoing maintainer: reliability debt that bites
weekly outranks speculative scale work; a feature is only worth building if it will be
used weekly and can be maintained by one person.
