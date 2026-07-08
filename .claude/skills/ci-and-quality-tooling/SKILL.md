---
name: ci-and-quality-tooling
description: "Use when adding continuous integration, linting, formatting, or typecheck coverage to a repo that lacks them. Triggers: \"add CI\", \"set up GitHub Actions\", \"add ESLint/Prettier\", \"nothing checks pushes\", files excluded from typecheck."
---

# CI and Quality Tooling

A procedure for adding automated checks (typecheck, build, tests, lint, format)
to a repo that has none, one rung at a time. The core principle: **CI runs
exactly what a developer can run locally.** Add the local script first, the
workflow step second — always in that order. A command that exists only inside
a workflow file rots: nobody runs it before pushing, nobody notices when it
drifts, and its failures read as "CI is flaky" instead of "my change is broken".

## When to use / when not to use

Use this skill when:

- A repo has no CI and someone asks to "add CI" or "set up GitHub Actions".
- Pushes reach the default branch with nothing checking them.
- Adding or wiring up ESLint, Prettier, or equivalent lint/format tooling.
- You suspect (or discover) source files that no tsconfig covers — e.g. server
  functions that never get typechecked.

NOT for:

- **Creating the test suite itself** — use `test-harness-bootstrap`.
  Discriminating test: does `npm test` (or equivalent) exist and pass locally?
  No → bootstrap the harness there first; this skill only wires an *existing*
  test command into the ladder.
- **Proving one specific change works before calling it done** — use
  `verification-before-done`. Discriminating test: are you demonstrating a
  single change end-to-end (that skill), or automating the repeatable checks
  every future change must pass (this one)?
- **Commit/branch/PR mechanics** — use `git-workflow-hygiene`. Discriminating
  test: is the question "what should run on push?" (this skill) or "how do I
  structure the commits/PR?" (that one)?
- **Secrets handling in CI beyond "never echo or commit them"** — use
  `security-audit`. Discriminating test: are you deciding *whether* a step
  needs a secret (this skill covers skipping/stubbing it), or auditing how
  secrets are stored, scoped, and rotated (that one)?

## Prerequisites

- Read the project's CLAUDE.md first. You need three facts from it (or from
  asking): known typecheck gaps, whether the default branch auto-deploys
  (Vercel/Netlify git integration), and whether the team pushes straight to
  the default branch or works via PRs.
- `package.json` exists and you know the package manager (`package-lock.json`
  → npm; `pnpm-lock.yaml` → pnpm; adapt commands accordingly — examples below
  use npm).
- The repo is on GitHub (the workflow example is GitHub Actions; the ladder
  and principles transfer to any CI system).

## The procedure

### Step 1 — Establish the deployment reality

Does merging/pushing to the default branch auto-deploy to production?

```
Default branch auto-deploys (e.g. Vercel/Netlify watching main)?
├─ Yes → Be honest about what you are building: CI that runs on push to main
│        is ADVISORY-AFTER-THE-FACT. The deploy races the check; a red X
│        arrives after the broken build is already live. The real fix is
│        branch protection requiring the CI check to pass on a PR before
│        merge — but moving a team off direct-to-main pushes is a workflow
│        decision, the project's call, not yours. State the limitation, add
│        CI anyway (a late red X still beats silence), and record the
│        recommendation. Check CLAUDE.md for the project's stated norm.
└─ No  → Proceed; CI on push + PR is a genuine gate once branch protection
         requires it.
```

### Step 2 — Climb the adoption ladder, one rung at a time

Add checks in this order. **Each rung must be GREEN — locally and in CI —
before you start the next.** A four-rung workflow where three rungs fail
teaches everyone to ignore CI on day one.

1. **Typecheck** — cheapest signal, zero config beyond what exists, catches
   the largest class of push-breaking errors. Script: `"typecheck": "tsc --noEmit"`
   (or `tsc -p <config>` per config — see step 3).
2. **Build** — proves the artifact assembles; catches bundler-only failures
   (bad imports of assets, env-var references, plugin config) that `tsc`
   never sees.
3. **Tests** — behavioral correctness. Only wire in a suite that already
   exists and passes; creating one is `test-harness-bootstrap`'s job.
4. **Lint** — bug-adjacent static analysis (unused vars, unawaited promises,
   hook-dependency mistakes). Comes after tests because a lint failure should
   never be the thing blocking a genuinely broken push from being diagnosed.
5. **Format-check** — pure style (`prettier --check .`). Last because it has
   the worst signal-to-annoyance ratio until steps in "Introducing lint and
   format" below are done.

⛔ STOP: Before adding any rung to the workflow, run its exact script locally
on the whole repo and see it pass. If it fails locally, fix the repo (or defer
the rung) — never add a red rung to CI "to fix later".

For each rung: add the script to `package.json` `"scripts"` first, run it,
then add `- run: npm run <script>` to the workflow. Never write a command in
the workflow that has no corresponding script.

### Step 3 — Audit typecheck coverage (the classic silent gap)

"We typecheck" often means "we typecheck the client directory". A root
tsconfig with `"include": ["src"]` silently skips serverless functions in
`api/`, scripts in `scripts/`, etc. Those files get zero checking anywhere.
Check CLAUDE.md for known gaps first, then verify every source file is
covered by SOME tsconfig:

```bash
cd "$(git rev-parse --show-toplevel)"
# What the compiler actually checks (repeat per tsconfig, append with >>):
npx tsc -p tsconfig.json --noEmit --listFiles \
  | grep -v node_modules | sed "s|^$PWD/||" | sort > /tmp/checked.txt
# What exists:
git ls-files '*.ts' '*.tsx' | sort > /tmp/all.txt
# Files NO tsconfig covers:
comm -13 /tmp/checked.txt /tmp/all.txt
```

If `comm` prints anything (quick prose check: does any tsconfig's `include`
mention that directory?), group the uncovered files by runtime — server
functions (`api/`), build-tool configs (`vite.config.ts` and friends),
scripts — and give each group its own tsconfig rather than widening the
first: server and tooling code needs different `lib`/`types` (Node, not DOM),
and that separation is a feature. Example for serverless functions:

```jsonc
// tsconfig.api.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "lib": ["ES2022"], "types": ["node"], "noEmit": true },
  "include": ["api"]
}
```

```jsonc
// package.json — one script checks everything:
"typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.api.json"
```

Re-run the audit until `comm` prints nothing. Expect the newly covered files
to produce errors — they have never been checked; fix them as part of landing
this rung green. If an error looks alien (e.g. "property does not exist on
type `{}`" on code that reads fine), don't guess at the cause from the message:
reproduce it in an isolated probe file containing just the suspect pattern
under the new tsconfig, and shrink until the trigger is obvious — newly applied
`lib`/`types` settings change what globals like `fetch` return, and the probe
tells you whether the fix is a type annotation, a cast, or a config change.

### Step 4 — Write ONE workflow file

Keep a single workflow until there is a concrete reason for more (a matrix, a
deploy job with different permissions). Two files that must stay in sync is a
maintenance bug waiting to happen.

Before writing the workflow, confirm the Node version is actually pinned
somewhere the workflow can read: check for `.nvmrc`, or an `engines.node` field
in `package.json` (`grep -n '"engines"' package.json`). **If neither exists, add
`engines.node` to `package.json` now** — `setup-node`'s
`node-version-file: 'package.json'` below silently resolves nothing useful
without it, and that failure surfaces only once the workflow is pushed.
When the repo gives you no evidence for the value, derive it in this order:
(1) the deploy platform's build Node version if documented (CLAUDE.md or the
platform dashboard — the human step); (2) else `node --version` on the machine
where the project verifiably builds, pinned as `">=<that major>"` (e.g. local
v22 → `">=20"` only if `@types/node`/deps don't demand newer, otherwise
`">=22"`); and record in the commit body that the value is an inference to be
checked against the deploy platform.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]        # ← the repo's default branch
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Pin Node from a file the repo already owns — never a loose "20":
      # use '.nvmrc' if the repo has one, else 'package.json' (reads
      # "engines.node"; add that field if missing). cache: npm makes
      # setup-node cache ~/.npm keyed on package-lock.json.
      - uses: actions/setup-node@v4
        with:
          node-version-file: 'package.json'
          cache: 'npm'

      # npm ci, NEVER npm install in CI: ci installs the lockfile exactly
      # and fails on package.json/lockfile mismatch; install may resolve
      # new versions and silently paper over lockfile drift.
      - run: npm ci

      # The ladder — every line mirrors a script a developer runs locally.
      # Uncomment each rung only when it is green locally (step 2).
      - run: npm run typecheck
      - run: npm run build
      # - run: npm test
      # - run: npm run lint
      # - run: npm run format:check
```

Env-less CI cannot run steps that need secrets. If `npm run build` needs env
vars (common with Vite/Next public vars), either add repo Actions secrets, or
inject explicit dummies (`env: { VITE_API_URL: 'http://ci-stub.invalid' }`) if
the step only needs the var to *exist*, or skip the step with a loud comment
saying why. Never let it fail mysteriously, and never echo secret values in
workflow logs. (How secrets should be stored and scoped is `security-audit`'s
territory.)

### Step 5 — ⛔ STOP gate: prove CI can fail

⛔ STOP: A gate that cannot fail is not a gate — it is decoration. Before
declaring CI done, push a deliberately broken commit to a scratch branch and
watch CI go RED:

```bash
git checkout -b ci-canary
echo 'const x: number = "not a number";' >> src/ci-canary-probe.ts
git add -A && git commit -m "ci canary: must fail typecheck"
git push -u origin ci-canary
gh run list --branch ci-canary        # copy the run id, then:
gh run watch <run-id>
```

Confirm the run fails on the expected step (typecheck), not on setup. Then
clean up:

```bash
git checkout -
git branch -D ci-canary
git push origin --delete ci-canary
```

A green canary means your workflow is
skipping the check (wrong branch filter, wrong script name, `|| true`
somewhere) — fix and re-probe before adding more rungs.

### Step 6 — Introduce lint/format without a 5,000-line diff

The naive path — add ESLint+Prettier, autofix, and refactor in one commit —
produces an unreviewable diff where real logic changes hide inside mechanical
ones. Instead:

1. **Config first.** Add the config files starting from the recommended
   ruleset (`eslint` recommended + framework plugin's recommended; Prettier
   defaults). Add individual rules only with a written reason; every
   deviation from recommended is a maintenance liability.
2. **One isolated autofix commit.** Run `npx eslint --fix .` and
   `npx prettier --write .` and commit the result alone, message like
   `"chore: apply eslint/prettier autofix (mechanical, no logic changes)"`.
   ZERO logic changes in this commit — reviewers must be able to skim it.
   Fix remaining non-autofixable errors in separate, ordinary commits.
3. **Only then enforce in CI** — uncomment the lint/format rungs once both
   commands are green locally on the whole repo.

Configure lint to fail on warnings (`eslint --max-warnings 0`) or configure
rules as `error`/`off` and never `warn`. A warning that doesn't fail the
build trains everyone to scroll past it — until a real one is buried in the
noise.

## Common mistakes

- **CI-only scripts.** A check invoked as a raw command in the workflow with
  no `package.json` script twin. Developers can't run it, so it drifts from
  local reality and its failures get blamed on CI. Corrective rule: every
  workflow `run:` line for a quality check is `npm run <script>`; the script
  is the source of truth.
- **`npm install` in CI.** It may re-resolve dependencies and mask
  package.json/lockfile drift, so CI tests different versions than developers
  have. Corrective rule: `npm ci` (or `pnpm install --frozen-lockfile` /
  `yarn install --immutable`), which installs the lockfile exactly and fails
  loudly on mismatch.
- **Treating lint warnings as noise.** Warnings that don't fail CI accumulate
  until the one real bug-warning is invisible. Corrective rule: fail on
  warnings (`--max-warnings 0`) or configure the rule to `error`/`off` — a
  check either gates or it doesn't exist.
- **Mixing the giant autofix commit with logic changes.** One commit with
  4,900 mechanical lines and 100 behavioral ones is unreviewable and
  unbisectable. Corrective rule: the autofix commit contains autofix output
  and nothing else (step 6.2); logic fixes go in their own commits.
- **Never verifying CI can fail.** Wrong branch filter, misspelled script, a
  stray `|| true` — the workflow runs green forever while checking nothing.
  Corrective rule: the canary push in step 5 is mandatory, not optional.
- **Assuming CI has the developer's environment.** Steps needing secrets or
  env vars fail (or worse, silently no-op) in the env-less runner. Corrective
  rule: for each step, decide explicitly — real secret, documented dummy
  value, or a commented-out step with the reason. No implicit dependence.
- **Believing CI on an auto-deploying default branch is a gate.** The deploy
  fires on push; CI's red X arrives after production is already broken.
  Corrective rule: say so honestly, recommend branch protection + required
  PR checks, and defer the direct-to-main norm to the project (CLAUDE.md).

## Done criteria

- [ ] Every check in the workflow has an identical `package.json` script a developer can run locally.
- [ ] The typecheck-coverage audit (step 3 `comm`) prints nothing — every tracked `.ts`/`.tsx` file is covered by some tsconfig.
- [ ] Exactly one workflow file, triggering on push AND pull_request to the default branch.
- [ ] Node version pinned via `node-version-file` (`.nvmrc` or `package.json` engines), dependencies installed with `npm ci`, cache enabled.
- [ ] Every enabled rung is green in CI; no rung was enabled while failing.
- [ ] Canary probe pushed, CI observed RED on the expected step, branch deleted.
- [ ] If lint/format were introduced: recommended ruleset as base, autofix landed in one logic-free commit, warnings fail the build.
- [ ] If the default branch auto-deploys: the advisory-after-the-fact limitation and the branch-protection recommendation are stated to the user, with the norm decision left to the project.
