# Skill Library Validation — Evidence Report

Date: 2026-07-04. This report records the live validation of the skill library
under `.claude/skills/`: not a re-review of the skill texts, but proof that the
skills drive real engineering work when followed by a **weaker executor model**
(all three executors ran on Claude Sonnet; the supervising session only built
fixtures, judged evidence, and verified independently). Method: each executor
got a realistic task + "follow the skill literally", and had to report evidence
in `verification-before-done`'s `verified:/NOT verified:` format. Every
executor claim below was then **re-verified independently** by the supervisor
before being committed.

## Leg 1 — `test-harness-bootstrap` on this repo (Sonnet executor)

Task as given: *"This repo has no tests — set up testing and write the first ones."*

| Skill gate | Executor evidence | Independent re-check |
|---|---|---|
| Prerequisite (no existing harness) | greps for `"test"` script / configs / test files → all empty | — |
| Framework tree | Vite in devDeps + `vite.config.ts` → **Vitest** branch; no second transform pipeline introduced; `vitest.config.ts` correctly NOT created (no jsdom needed yet) | confirmed by reading the diff |
| Mutation gate ×2 | first test mutated `1780→1234` → observed FAIL with expected/received diff → reverted → green; second gate self-applied to the first **fake-timer** test (`vi.setSystemTime`) — inferred from the skill's principle, not spelled out by it | supervisor independently mutated `toBe(1780)→toBe(9999)`: exactly 1 of 47 failed at the right test; reverted → 47/47 |
| Tier ranking | tier 1: `calculations` (Mifflin-St Jeor known-goods, `.5` macro rounding boundary), `units` (12-inch rollover), `date` (every meal-hour threshold, clamping, degraded fallbacks); tier 2/3: `db` (strip-list shape/immutability + PGRST204/42P01/PGRST205 detection) | spot-read: real business values, no filler, no snapshots |
| Result | **47 tests, 4 files, all green**; `npm run build` still green (prod-safe); ratchet recorded in CLAUDE.md | `npm test` → 47/47; `npm run build` → ✓ |

Committed as `d9b123d`.

## Leg 2 — `ci-and-quality-tooling` on this repo (Sonnet executor + supervisor canary)

Task as given: *"This repo has no CI — add it."* (typecheck/build/test rungs; lint/format deferred per plan.)

- **Coverage audit (the skill's literal `comm` procedure)** surfaced exactly the
  documented gap: `api/analyze-food.ts`, `api/coach.ts`, `api/search-food.ts`,
  `vite.config.ts` covered by no tsconfig. Fixed with `tsconfig.api.json` +
  `tsconfig.node.json`; audit re-run prints nothing (re-verified by supervisor).
- **The audit found real bugs**: the first-ever typecheck of `api/*.ts` produced
  8 genuine errors (untyped `r.json()` under Node lib types). Fixed with minimal
  typed casts naming only the fields read — no behavior change, `build` script
  untouched, production build re-verified green.
- **Workflow**: single `ci.yml`, push (any branch) + PR to `main`, node pinned
  via new `engines.node`, `npm ci`, then `typecheck`/`build`/`test` — each line
  a script proven green locally first.
- **Canary (the skill's "prove CI can fail" gate)**, run by the supervisor:
  branch `ci-canary` with a deliberate type error pushed; CI run observed
  **failing on the typecheck step** (see the run history for `ci-canary`,
  run #2 of the CI workflow); green-path run on the feature branch observed
  passing; canary branch deleted after confirmation.

Committed as `5224de7` (+ this report's commit records the canary outcome).

## Leg 3 — Portability: foreign project, zero context (Sonnet executor)

Fixture: `expense-cli`, a **plain-JS Node CLI** (no Vite, no TS, no deps — a
deliberately different stack and domain), built by the supervisor with a planted
boundary bug (`src/report.js`: month-end computed as the last day at midnight +
a strict `<` filter → every expense dated on a month's last day silently
dropped; March 2026 sample reported 7/$2106.30 instead of 9/$2203.45). The
`.claude/skills/` directory was copied in **verbatim**. The executor got only a
user-style bug report and "pick whichever skills match".

| Claim under test | Outcome |
|---|---|
| Skill **selection** works from descriptions alone | Picked `systematic-debugging`, `test-harness-bootstrap`, `verification-before-done`; correctly rejected the schema/API skills as inapplicable |
| Debugging procedure finds a planted bug | Symptom template filled (silent-failure form); reproduced; missing $97.15 isolated to the two month-end rows; **one hypothesis, falsified via a 6-line probe, then root cause stated with file:line (`src/report.js:9`/`:13`) BEFORE the fix** — the exact planted lines |
| Decision trees generalize (not memorized from this repo) | Framework tree took the **node:test branch** (plain Node → zero-dep runner), not the Vitest branch this repo uses |
| Regression pinning | 3 tests written to fail on pre-fix code (`# fail 3`) and pass post-fix (`# pass 3`); supervisor re-verified by stashing the fix (3 fail) and restoring it (3 pass) |
| Beyond-the-bug verification | leap-year Feb, 30/31-day months, Dec→Jan rollover all checked; sibling grep confirmed the boundary pattern occurs nowhere else |

## Skill defects surfaced by execution (the useful kind of finding)

Executors were required to report every place a skill left them guessing:

1. `test-harness-bootstrap`: no guidance on **locale/timezone-coupled functions**
   (`toLocaleDateString` with environment defaults). The executor tested against
   the runner's en-US/UTC and flagged the coupling in a comment. Known risk: a
   non-en-US CI image would fail those tests environmentally.
2. `test-harness-bootstrap`: "new kind of test" for the mutation gate has no
   taxonomy — the executor correctly inferred fake-timer tests qualify, but by
   principle, not instruction.
3. `ci-and-quality-tooling`: `engines.node` value can't be derived from repo
   evidence (no `.nvmrc`, no doc); `>=20` chosen from the local toolchain.
   Sanity-check against Vercel's build Node version at some point.
4. `ci-and-quality-tooling`: "expect errors in newly covered files, fix them"
   gives no diagnostic method — root-causing the `unknown`+`?.`→`{}` errors
   required probes outside the skill's steps.
5. Fixture leg: no guesses reported — both skills resolved unambiguously.

Items 1–4 are candidate refinements for a future `skill-library-maintenance`
pass ("methodology lesson learned → that skill's procedure or common-mistakes").
None blocked any executor from completing its task.

## Verdict

- verified: a Sonnet-class session, armed only with the skills and CLAUDE.md,
  bootstrapped a real 47-test harness and real CI on this repo — with every
  gate's evidence pasted and independently re-checked.
- verified: the same library, copied unmodified into a foreign project of a
  different stack, drove a zero-context Sonnet session to select the right
  skills, root-cause a planted bug at the exact line, and pin it with a
  regression test proven to fail pre-fix.
- NOT verified (out of scope / needs a human or time): behavior of the test
  suite on non-en-US CI images; Vercel's production Node version vs
  `engines.node`; lint/format rungs (deliberately deferred, still in Known gaps).
