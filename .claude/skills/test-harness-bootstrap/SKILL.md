---
name: test-harness-bootstrap
description: "Use when introducing automated tests to a repo that has none, or deciding what to test first in an under-tested codebase. Triggers: \"add tests\", \"set up vitest/jest\", \"this repo has no tests\", \"what should we test first\"."
---

# Test Harness Bootstrap

A procedure for standing up a test harness in an untested repo and spending the
first tests where they buy the most. Two core principles: **the test runner must
ride the toolchain the repo already has** (never introduce a second build
pipeline just to test), and **a test you have never seen fail proves nothing** —
you validate the harness itself by mutating an assertion and watching it go red.

## When to use / when not to use

Use this skill when:

- A repo has zero automated tests and you've been asked to add some ("add tests", "set up vitest", "set up jest").
- A repo has a handful of tests and you must decide where the next ones go ("what should we test first").
- You've just fixed a bug and need a regression test, but no harness exists to put it in.

NOT for:

- **Proving ONE finished change works right now** — use `verification-before-done`.
  Discriminating test: are you demonstrating a specific change manually today
  (that skill), or building durable infrastructure that future tests will run on
  (this one)? A one-off proof does not require a harness.
- **Wiring tests into CI, coverage reporting, or pre-commit hooks** — owned by
  `ci-and-quality-tooling`. Discriminating test: does the step edit a CI workflow
  or hook config rather than test code or the test runner's own config? Route it
  there. This skill ends at "tests pass locally via the manifest's `test` script".
- **Finding why something is broken** — use `systematic-debugging`. Discriminating
  test: do you have a root cause with a file:line yet? No → debug first. Yes →
  come back here to pin it with a regression test (step 6 of that skill's
  aftermath is this skill's step 5).

## Prerequisites

- Confirm the repo truly has no harness before adding one (don't create a
  parallel setup next to a forgotten existing one):

  ```bash
  grep -E '"test"' package.json                      # test script in the manifest?
  ls vitest.config.* jest.config.* pytest.ini setup.cfg pyproject.toml 2>/dev/null
  git ls-files | grep -E '\.(test|spec)\.[jt]sx?$|(^|/)test_.*\.py$' | head
  ```

  If any hit: extend the existing setup instead of bootstrapping a new one.
- Check the project's CLAUDE.md for the package manager (npm/pnpm/yarn), run
  commands, and any prior testing decisions. Examples below use npm; substitute.

## The procedure

### Step 1 — Pick the framework from the EXISTING toolchain

Read the manifest and config files first (`package.json`, `vite.config.*`,
`pyproject.toml`). The runner is determined by what's already there:

```
What builds this code today?
├─ Vite (vite in devDependencies, vite.config.* exists)
│    → Vitest. It reuses the existing vite config and transform pipeline —
│      TS, JSX, path aliases all work with zero extra config.
├─ Plain Node / TS, no bundler
│    → node:test (zero dependencies, plain JS) or Vitest (if TS/ESM makes
│      node:test awkward on your Node version). Prefer node:test when it
│      runs your files as-is; prefer Vitest the moment you'd need a
│      transpile step to feed node:test.
├─ An ecosystem that ships its own preset (e.g. React Native's jest preset,
│  a framework template already configured for Jest)
│    → Jest. This is the ONLY case for Jest: the ecosystem demands it.
│      Don't pick Jest for a Vite app — that's a second transform pipeline
│      (babel/ts-jest) that will drift from the real build.
└─ Python
     → pytest. Not unittest boilerplate, not nose.
```

⛔ STOP: Your chosen runner must reuse the repo's existing build/transform
pipeline, or need none at all. If your setup plan includes installing babel,
ts-jest, or a second bundler config just to make tests compile, you picked the
wrong runner — go back up the tree.

### Step 2 — First-hour setup (literally executable)

Vitest path shown; node:test and pytest variants at the end of the step.

1. **Install the dev dependency:**

   ```bash
   npm install -D vitest
   ```

2. **Config:** for plain unit tests of pure functions, none — Vitest picks up
   `vite.config.*` automatically and defaults to the node environment. Only add
   a `vitest.config.ts` later when you actually need jsdom for DOM tests. Do
   not preemptively configure coverage, reporters, or environments.

3. **Write ONE trivially-green test of a real pure function.** Find a real
   exported function with no I/O (look in `src/lib/`, `src/utils/`, or
   wherever helpers live). Co-locate the test next to its source as
   `<module>.test.ts` unless the repo already has a `tests/` convention:

   ```ts
   // src/lib/pricing.test.ts
   import { describe, it, expect } from 'vitest';
   import { applyDiscount } from './pricing';

   describe('applyDiscount', () => {
     it('reduces a price by the given percentage', () => {
       expect(applyDiscount(100, 0.2)).toBeCloseTo(80, 2);
     });
   });
   ```

4. **Add the `test` script to the manifest** (`vitest run` = single pass,
   CI-friendly; bare `vitest` is watch mode — keep that for local use via
   `npx vitest`):

   ```json
   "scripts": { "test": "vitest run" }
   ```

5. **Run it:**

   ```bash
   npm test
   ```

6. **MUTATE the assertion to prove the harness can fail.** Change the expected
   value to something wrong (`toBeCloseTo(50, 2)`), run again, and read the
   failure output.

   ⛔ STOP: You have watched this test FAIL, with output that names the test,
   the expected value, and the received value — and then reverted the mutation
   and watched it pass again. If the mutated test still passed, the harness is
   not running your file (wrong glob, wrong script, stale process): fix that
   before writing any more tests. A test you've never seen fail proves nothing.

**node:test variant:** no install; name files `*.test.js`; script is
`"test": "node --test"`; assert with `assert.strictEqual` from `node:assert/strict`.
**pytest variant:** `pip install pytest` (add to dev requirements); file
`tests/test_units.py` with a plain `assert kg_to_lbs(1) == pytest.approx(2.20462)`;
run `pytest`. The mutation gate in item 6 applies identically to both.

### Step 3 — Rank what to test next

Do not test in file order or coverage order. Spend tests by value-per-harness-cost:

**Tier 1 — pure functions with business meaning** (calculations, unit
conversions, date/rounding logic). Why first: zero setup, deterministic,
and this is where silent wrong-answer bugs live — a miscalculation ships
without an error. A good first test pins known-good values, boundaries
included:

```ts
it('rounds up to the next dollar at the billing boundary', () => {
  // 19.995 rounds to 20.00, not truncates to 19.99 — the boundary the naive
  // implementation (Math.floor(x*100)/100) gets wrong
  expect(roundToCents(19.995)).toBe(20.00);
});
```

**Tier 2 — data transformation and parsing at boundaries** (API response
coercion, serialization, form-input normalization). Why second: this is where
the outside world's mess enters your types, and a shape change upstream breaks
you silently. Feed a captured-realistic raw payload in, assert the coerced shape:

```ts
it('coerces numeric strings from the API into numbers and drops unknown fields', () => {
  const raw = { calories: '240', name: 'Oats', _internal: 'x' };
  expect(parseProduct(raw)).toEqual({ calories: 240, name: 'Oats' });
});
```

**Tier 3 — error and degradation paths** (fallbacks, retry logic,
permission-denied branches). Why third: these branches almost never run in
manual testing, so they rot unnoticed until an outage exercises them. Drive
the failure input explicitly:

```ts
it('falls back to default targets when the stored profile is missing', () => {
  expect(resolveTargets(null)).toEqual(DEFAULT_TARGETS);
});
```

**Tier 4 — UI, last.** Why last: it needs the most harness (jsdom, a
testing-library, render setup) and it changes the most, so tests written here
first cost the most and die the fastest. When you get here, test user-visible
behavior ("submitting with an empty name shows the validation message"), never
render internals. Adding jsdom is the moment you finally create `vitest.config.ts`.

### Step 4 — Testing code that looks untestable

Prefer **extracting a pure function over mocking the world**. When logic is
buried in a component or a request handler, pull the decision/calculation part
into a plain exported function and test that; leave the thin I/O shell untested
for now. One extraction is cheaper and more durable than a mock stack.

When IS a network/DB mock worth it? Apply this test:

```
Is the logic under test the BRANCHING AROUND the boundary
(retry on 429, fallback on error, cache-hit vs miss)?
├─ Yes → stub the boundary with canned success/failure responses and
│        assert which branch ran. The mock is scaffolding; the branching
│        is the subject.
└─ No (the test would just check that you called fetch with the args
   you told the mock to expect)
     → don't write it. You'd only be testing the mock. Extract the
       request-building or response-parsing into a pure function (tier 2)
       and test that instead.
```

### Step 5 — Quality rules for every test you add

- **The name states the behavior**: `it('returns null for an expired token')`,
  never `it('works')` or `it('test1')`.
- **Arrange–act–assert**, visibly, in that order. One behavior per test.
- **No snapshot spam.** A snapshot asserts everything and explains nothing;
  its failures get rubber-stamp-updated. Assert the specific fields that
  constitute the behavior.
- **Test the contract, not the implementation**: inputs and observable outputs,
  never private helpers, internal call counts, or state shape. If a pure
  refactor (same behavior) breaks the test, the test was wrong.
- **Failure output must point at the cause.** Prefer `toEqual` on a small object
  over `toBe(true)` on a computed boolean — the diff is the diagnosis. If a
  failing run wouldn't tell a stranger what broke, rewrite the assertion.
- **Beware environment-coupled "pure" functions.** Anything calling
  `toLocaleDateString`/`toLocaleString` with the environment default locale, or
  reading the system timezone, is only pure relative to the machine it runs on —
  a CI image with a different locale/TZ fails the test for reasons unrelated to
  the code. Either pin the environment in the test (`TZ=UTC` in the test script,
  an explicit locale argument in the assertion helper), or assert structure
  rather than exact formatted strings. If you must assert against the runner's
  default, say so in a comment naming the assumed locale/TZ so the failure is
  diagnosable.

### Step 6 — Set the adoption rule, not a coverage goal

Do not announce "80% coverage by Q3" — big-bang targets stall and breed filler
tests. Instead install a ratchet, and record it in the project's CLAUDE.md:

> Every bug fix gets a regression test (written to fail on the pre-fix code —
> the mutation gate for free). Every new pure function gets tests with it.

Then hand off to `ci-and-quality-tooling` to wire `npm test` into CI so the
ratchet only turns one way. That skill owns the workflow file; you're done when
the script passes locally.

## Common mistakes

- **Never watching a new test fail.** A wrong glob, a stale watcher, or a test
  that asserts nothing all produce green. Corrective rule: the step-2 mutation
  gate applies to the first test of every new *kind* of test, and regression
  tests must fail on pre-fix code. "New kind" means any new harness
  *mechanism* — first DOM/jsdom test, first async test, first fake-timer test
  (`vi.setSystemTime`), first network-stub test — because a mis-wired mechanism
  degrades silently (e.g. a fake clock that isn't actually controlling the code
  under test still passes whenever real time happens to cooperate).
- **Snapshot tests as the default.** They assert everything, explain nothing,
  and train people to press "update". Corrective rule: snapshots only for
  output whose exact full shape IS the contract (e.g. a generated config file);
  otherwise assert named fields.
- **Testing the framework.** "Renders without crashing" and re-asserting that a
  library does what its docs say verify nothing about your code. Corrective
  rule: every test must be able to fail because of a plausible bug in *this
  repo's* logic — name that bug; if you can't, delete the test.
- **Mocking so much the test proves nothing.** Mock the client, mock the store,
  then assert the mocks were called — a tautology that survives real breakage.
  Corrective rule: apply the step-4 branching test; if the subject isn't the
  branching around the boundary, extract and test pure logic instead.
- **Big-bang coverage targets.** Teams write low-value tests to hit the number,
  then stall. Corrective rule: no numeric goal in the first quarter of a
  harness's life; the step-6 ratchet only.
- **Testing private internals.** Reaching into unexported helpers or asserting
  internal call order welds tests to the implementation, so honest refactors go
  red. Corrective rule: test only through the module's public exports; if a
  private helper deserves direct tests, that's the signal to promote it to an
  exported pure function.
- **Picking the fashionable runner over the fitting one.** Jest in a Vite app
  means a second transform pipeline whose config drifts from the real build.
  Corrective rule: step 1's tree is binding; any second build pipeline is a
  wrong turn.

## Done criteria

- [ ] Prerequisite grep confirmed no pre-existing harness (or the existing one was extended, not duplicated).
- [ ] Runner chosen via the step-1 tree; no second build pipeline was introduced (no babel/ts-jest alongside an existing bundler).
- [ ] At least one test of a real pure function exists and passes.
- [ ] `test` script exists in the manifest and `npm test` (or equivalent) passes from a clean checkout.
- [ ] Mutation gate performed: the first test was seen failing with cause-pointing output, then reverted to green.
- [ ] Next tests (if any were requested) were placed by the step-3 tier ranking, tier 1 first.
- [ ] Every test name states a behavior; no snapshot added without a written justification.
- [ ] The adoption ratchet (regression test per bug fix, tests per new pure function) is recorded in the project's CLAUDE.md.
- [ ] CI wiring handed off to `ci-and-quality-tooling` (not done here).
