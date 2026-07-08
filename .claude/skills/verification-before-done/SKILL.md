---
name: verification-before-done
description: "Use before declaring any change complete, especially in projects with no automated tests — proving a change works by exercising it, not by reading it. Triggers: \"done\", \"ready to commit\", \"does this work\", any diff about to be committed in a repo without tests."
---

# Verification Before Done

A procedure for proving a change works before you call it done. The core
principle: **compilation is not verification.** "It typechecks" proves the types
agree with each other, nothing more — a function nobody calls typechecks, a
handler that returns the wrong data typechecks. The minimum bar for "done" is
typecheck + build + **observed runtime behavior of the changed path**. You either
watched the change work, or you hand the human a numbered checklist saying
exactly what you could not watch and why.

## When to use / when not to use

Use this skill when:

- You are about to say "done", "ready", "this should work", or write a commit message.
- The user asks "does this work?" and you have not run it since the last edit.
- Any diff is about to be committed in a repo without automated tests — there is
  no safety net below you; this skill IS the safety net.
- `systematic-debugging` step 7 hands off to you after a fix: it re-ran the one
  recorded repro; you prove the change is complete (build, types, adjacent flows,
  degraded paths).

NOT for:

- **Finding out WHY something is broken** — use `systematic-debugging`.
  Discriminating test: are you hunting for the cause of a failure (that skill),
  or demonstrating that there isn't one (this skill)? If a matrix row in step 3
  fails, you switch: hand the failing row to `systematic-debugging` as its step-1
  symptom, fix, then return here and re-run the whole matrix.
- **Writing durable automated tests** — use `test-harness-bootstrap`.
  Discriminating test: will the artifact outlive this change as a test file the
  next person runs? Then it's that skill. This skill is the manual discipline
  that substitutes for tests until they exist — and once they do exist, running
  the relevant tests becomes the first row of your matrix, not a replacement
  for it (tests rarely cover the environment reality check in step 4).
- **Judging whether the code is GOOD** — use `code-review-standards`.
  Discriminating test: "is this readable / consistent / secure / well-factored?"
  is review; "does it observably do the right thing at runtime?" is this skill.
  A diff can pass review and fail here, and vice versa. Before committing
  nontrivial work, do both.

## Prerequisites

- The change is complete in your working tree — you believe you are done. If you
  are mid-implementation, finish first; verifying half a change wastes both runs.
- You know which run command serves which layers of this project. Check the
  project's CLAUDE.md — many dev servers serve only part of the stack (e.g. a
  frontend-only dev server that never runs API routes), and verifying in the
  wrong one produces confident nonsense.

## The procedure

### Step 1 — Typecheck and build

Run the project's typecheck and build (commands in CLAUDE.md; typically):

```bash
npm run build        # or the project's equivalent
```

Then check one thing juniors always miss: **does the build actually typecheck
every file you changed?** Some tsconfigs `include` only part of the repo (e.g.
`src/` but not `api/` or `scripts/`). If any changed file is outside the checked
set, typecheck it explicitly — CLAUDE.md should document the command; if not:

```bash
npx tsc --noEmit <path/to/changed-file.ts>   # add the flags the project's build uses
```

A clean build here earns you nothing except the right to proceed. Do not report
anything yet.

### Step 2 — Build the verification plan FROM THE DIFF

The plan comes from what you actually changed, not from what you remember
intending. Look at the real diff:

```bash
git diff --stat            # staged + unstaged as appropriate: add HEAD / --staged
git diff                   # then read it
```

For EVERY changed file, fill in one block:

```
FILE:               <path>
BEHAVIOR AFFECTED:  <the user-visible or caller-visible behavior this file change alters —
                     what someone using the app or calling this code would notice>
HOW I WILL EXERCISE IT: <the exact click-path, command, or request that runs the changed lines>
```

Rules:

- "BEHAVIOR AFFECTED: none" is only legal for comments, docs, and dead code —
  and "dead code" is a claim you must support (who imports it?).
- If you cannot fill in a block from the diff, **you do not understand your own
  change**. Stop and re-read the diff line by line until you can say what each
  hunk does to an observer. Do not proceed on vibes.
- Files changed as pure plumbing (a type, a constant) still get a block: the
  behavior they affect lives in their callers — name the caller flow you'll exercise.

### Step 3 — Write the manual test matrix

For the behaviors named in step 2, write the matrix before running anything.
Minimum rows:

```
| # | Case          | Input / trigger                          | Expected observation           | Observed (verbatim) |
|---|---------------|------------------------------------------|--------------------------------|---------------------|
| 1 | Happy path    | <normal input>                           | <what success looks like>      |                     |
| 2 | Empty state   | <no data / empty string / zero rows>     | <graceful behavior, not crash> |                     |
| 3 | Error path    | <invalid input / failing dependency>     | <the intended error behavior>  |                     |
| 4 | Boundary      | <edge values the diff touches: 0, max,   | <correct at the exact edge>    |                     |
|   |               |  off-by-one, unicode, today/midnight>    |                                |                     |
| 5 | Degraded path | <fallback / retry / cache-miss branch,   | <fallback engages, visibly>    |                     |
|   |               |  IF the code has one>                    |                                |                     |
```

- If automated tests exist for this area, `run them` is row 0 — then keep going;
  passing tests do not exercise the environment (step 4).
- **The degraded path never triggers itself.** Fallback branches, retry loops,
  and catch blocks only run when something fails, so you must make something
  fail deliberately: point the upstream URL at an unreachable host, stub the
  dependency to return a 500 or malformed body, throw at the top of the primary
  path, disconnect the network. If your diff has a `catch`, a `||`, a `?.`
  chain feeding a default, or a fallback model/endpoint — it has row 5.
- **If the diff itself changes an error or fallback path** (common for fixes),
  the roles flip: triggering the failure IS your happy path (row 1), and you
  must also confirm the normal path still works untouched (regression row).
- ⚠ Any failure-injection you add (a thrown error, a sabotaged URL) is
  temporary scaffolding. Revert it before the STOP gate — `git diff` must show
  only the intended change.

### Step 4 — Environment reality check

Now decide WHERE each row runs. The iron rule: verify in an environment that
actually **executes the changed code**. A frontend dev server that never runs
serverless functions cannot verify a serverless function change, no matter how
good the UI looks. CLAUDE.md documents which command serves which layers — read
that table before choosing.

```
Can the changed code path run in an environment available to you right now?
├─ Yes → run the matrix there. Confirm the environment serves the changed layer
│        (right command per CLAUDE.md) and runs your current code (rebuild /
│        restart the dev server / hard-reload — stale bundles verify old code).
└─ No — full stack can't run locally (missing secrets, prod-only services, no local runner):
         Can you isolate the pure logic and drive it directly?
         ├─ Yes → do that. Import the function and call it with the matrix inputs:
         │          npx tsx -e "import {f} from './src/lib/thing'; console.log(f(<row input>))"
         │        Pure logic (parsing, calculation, formatting) never needed the stack.
         └─ No → Can you stub the boundary — fake the response shape the missing
                 service would return (including its failure shapes, for row 5)?
                 ├─ Yes → stub it (mock fetch, a local fake server, a hardcoded
                 │        fixture), run the matrix against the stub, and SAY SO:
                 │        every such row is recorded as "verified against stub",
                 │        never as plain "verified".
                 └─ No → Can you exercise the layer directly below or above the change?
                          ├─ Yes → do that (e.g. curl the deployed endpoint the client
                          │        change calls, or drive the client against the old
                          │        server). Record it as PARTIAL verification with an
                          │        explicit NOT-verified note for the remainder.
                          └─ No → write a numbered manual-verification checklist for a
                                  human, one step per unverified matrix row, with the
                                  exact action and the exact expected observation. This
                                  checklist is PART OF THE DELIVERABLE, not an apology —
                                  include it in your final report / PR description.
```

Concrete pattern for the common hard case — a serverless/API handler you can't
run for lack of secrets: the handler is usually just a function. Invoke it
directly with a fake request/response object and stub the outbound call:

```bash
npx tsx -e "
globalThis.fetch = async () => new Response('upstream down', { status: 500 });  // row-5 trigger

const { default: handler } = await import('./api/<endpoint>.ts');

const req = { method: 'POST', body: { /* <row input, e.g. the malformed-input case> */ } };
const res = {
  status(code) { console.log('STATUS', code); return this; },
  json(body)   { console.log('BODY', JSON.stringify(body)); return this; },
};

await handler(req, res);
"
```

The `req`/`res` doubles above are the whole trick — a bare object literal with
just enough shape for the handler to call `.status(n).json(body)` on it, printed
instead of sent. Build one double per matrix row (vary `req.body` and the stubbed
`fetch` per row) rather than trying to share one; each row is one line change to
`req.body` or the `globalThis.fetch` stub above the import. Adapt the doubles to
the project's actual handler signature (some frameworks pass `(req, res)`, others
a single `Request` returning a `Response` — match what step 2's diff shows). This
verifies your logic and your error mapping; it does not verify deployment config
or real upstream shapes — say so in the evidence.

### Step 5 — Execute and record evidence, verbatim

Run every row. For each, record what you RAN and what you OBSERVED — copy-paste,
don't summarize:

```
ROW <n> — <case>
RAN:      <exact command | exact click-path ("Settings → Units → tap Imperial")>
OBSERVED: <output snippet / HTTP status + body / what the UI showed — verbatim>
VERDICT:  verified | verified against stub | NOT verified: <what remains and why>
```

Vocabulary rules — these are banned in your report: "should work", "looks
right", "probably fine", "I believe this works". There are exactly two
reportable states:

- `verified: <evidence>` — you observed it.
- `NOT verified: <what remains and why>` — you didn't, and here is the human
  checklist item covering it.

If a row FAILS: that finding is the deliverable. Do not shrink the matrix, do
not reword the expectation to match the observation, do not commit "and fix
later". Report the failure, route it to `systematic-debugging`, fix, and re-run
the full matrix (the fix may have broken another row).

### Step 6 — ⛔ STOP gate: the done-claim

⛔ STOP: Before saying "done", "ready to commit", or writing the commit — check
all of the following. If any is false, you are not done; go back to the step
that fails.

1. Every row of the step-3 matrix has an OBSERVED entry, or is explicitly
   listed in the human checklist with an exact action + expected observation.
2. No row's verdict is a failure you are quietly living with. (Honesty rule: a
   found failure is a successful verification — report it as the outcome.)
3. All failure-injection scaffolding is reverted: `git diff` shows only the
   intended change.
4. Your report states, for the whole change: `verified: <evidence>` or
   `NOT verified: <remaining items>` — never "should work".

## Common mistakes

- **"It typechecks, ship it."** The compiler proves internal consistency, not
  behavior — wrong endpoint URLs, inverted conditions, and unhandled empty
  states all typecheck. Corrective rule: the minimum bar is typecheck + build +
  observed runtime behavior of the changed path; step 1 alone never justifies a
  done-claim.
- **Testing only the happy path.** One successful normal-input run, declared
  done — while the empty state renders `NaN` and the error path crashes.
  Corrective rule: the matrix has five row types; a matrix with only row 1 is
  not a matrix.
- **Verifying in an environment that doesn't run the changed code.** Clicking
  through a frontend-only dev server while the diff is in a serverless function:
  the changed lines never executed, and the green result is about the old code
  or no code. Corrective rule: step 4 first question — does this environment
  execute the changed layer, per CLAUDE.md's command table? Also applies to
  stale builds: restart/rebuild before trusting any observation.
- **Claiming verification that wasn't performed.** Writing "tested and working"
  because the code reads correctly. This is the most damaging failure in this
  skill's domain: it spends the user's trust on a guess. Corrective rule: every
  "verified" must have a RAN/OBSERVED pair behind it; if you can't paste the
  evidence, the word is "NOT verified".
- **Verifying the demo scenario instead of the boundary the diff moved.** The
  change altered rounding at zero, and you verified with the same comfortable
  mid-range value you always use. Corrective rule: step 2 derives the plan FROM
  THE DIFF — row 4's boundary values are the exact edges the changed lines
  touch, not generic inputs.
- **Forgetting the degraded/fallback branch.** The diff adds a fallback (retry,
  secondary model, cached default) and verification only exercises the primary
  path — so the fallback ships having never once run. Corrective rule: fallback
  code requires deliberately triggered failure (row 5); "the catch block is
  simple" is not a substitute for watching it catch.

## Done criteria

- [ ] Typecheck and build pass, including changed files outside the build's default typecheck scope.
- [ ] Step-2 block filled in for every file in `git diff --stat` — behavior affected + how exercised.
- [ ] Test matrix written with happy / empty / error / boundary rows, plus degraded-path row if the code has one.
- [ ] Every row run in an environment that executes the changed code, or routed through the step-4 tree (isolated logic, labeled stub, partial + note, or human checklist).
- [ ] Every row has verbatim RAN/OBSERVED evidence, or a numbered human-checklist item with exact action and expected observation.
- [ ] Any row that failed is reported as the outcome and routed to `systematic-debugging` — not papered over; matrix fully re-run after the fix.
- [ ] All failure-injection scaffolding reverted; `git diff` shows only the intended change.
- [ ] Final report uses only `verified: <evidence>` / `NOT verified: <what remains and why>` — no "should work".
