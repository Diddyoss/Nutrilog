---
name: systematic-debugging
description: "Use when investigating any bug, error, regression, or unexplained behavior — before proposing a fix. Triggers: \"X is broken\", \"why does this fail\", error messages, stack traces, \"it worked before\"."
---

# Systematic Debugging

A procedure for finding the actual cause of a failure before changing any code.
The core principle: **never edit code you haven't proven guilty.** You earn the
right to write a fix by (1) reproducing the failure, (2) locating the failing
layer with evidence, and (3) stating the root cause with a file:line citation.
Everything before that point is observation, not modification.

## When to use / when not to use

Use this skill when:

- Something errors, crashes, or returns wrong output ("X is broken", a stack trace, a failing request).
- Behavior is silently wrong (nothing saved, stale data shown, no error anywhere).
- A regression: "it worked before", "it works on my machine but not deployed".

NOT for:

- **Proving a finished change works** — use `verification-before-done`. Discriminating test: are you hunting for *why* it's broken (this skill), or demonstrating that it *isn't* (that one)? The moment your fix is written, hand off.
- **Building a mental model of unfamiliar code with no defect suspected** — use `codebase-orientation`. Discriminating test: is there a concrete misbehavior to explain? No misbehavior → orientation, not debugging.
- **Judging whether a diff is good** — use `code-review-standards`. Discriminating test: your input is a diff to evaluate, not a runtime symptom to explain.
- **Remedying schema-cache / missing-column / missing-table errors** — this skill will help you *identify* that class of error (step 3), but the remedy (migrations, cache reload, degradation handling) is owned by `database-schema-evolution`. Route there once identified.

## Prerequisites

- You can run the app, or at least the failing layer, locally. Check the project's
  CLAUDE.md for run commands, env-var contract, and any caveats (e.g. some dev
  servers do not serve serverless functions — a "broken" API locally may be a
  known limitation, not a bug).
- The reporter's exact words for the symptom, or your own observation of it.

## The procedure

### Step 1 — Capture the symptom verbatim

Fill this in before touching anything. Copy-paste, don't paraphrase:

```
SYMPTOM:        <one sentence: what happens>
EXACT ERROR:    <full error text / stack trace, copy-pasted — or "silent: no error, and <what you observed instead>">
EXPECTED:       <what should happen>
REPRO STEPS:    <numbered clicks/commands, exact inputs>
LAST KNOWN GOOD: <commit/date/"never worked"/"unknown">
```

A silent failure still has "exact error" content: write down precisely what you
*did* observe ("no error, no network request fired, no row in the table"). Read
the whole stack trace — the true origin is usually the deepest frame in *your*
code, not the top frame in a library.

### Step 2 — Reproduce it yourself

Run the repro steps. Watch it fail with your own eyes (or in your own terminal).

⛔ STOP: You have personally observed the failure, using the exact steps written
in step 1. If not, do NOT proceed to code changes — never fix what you can't
reproduce. Instead:

```
Can you reproduce locally?
├─ Yes → step 3.
└─ No  → Does the failing environment differ from yours?
         ├─ Env/config differs (env vars, secrets, feature flags, versions)
         │    → diff them. Compare your local env file against the project's
         │      documented env contract (CLAUDE.md) and the deployed settings.
         │      Reproduce by matching the failing env's values locally.
         ├─ Data shape differs (their account/rows vs yours)
         │    → fetch or reconstruct the failing input: log the exact payload in
         │      the failing env, or query the store for the failing record, then
         │      replay that exact data locally.
         └─ Neither identifiable
              → instrument first, guess never: add structured logging around the
                suspect path (inputs, branches taken, outputs), deploy/ship it,
                trigger the failure, read the logs. Evidence before edits.
```

If "it worked before" and you have a last known good commit, bisect instead of guessing:

```bash
git bisect start
git bisect bad HEAD
git bisect good <last-good-commit>
# run the repro at each step, then: git bisect good | git bisect bad
git bisect reset
```

### Step 3 — Locate the layer

Follow the data through the stack and find the first point where reality diverges
from expectation. Probe the **middle of the path first** (usually the network
boundary) — each probe halves the search space.

```
Start: user action → UI state → client logic → network → server → database / external API

Did the expected network request fire? (devtools → Network tab, filter by endpoint)
├─ No request → the failure is client-side:
│    Did the handler run at all? (add console.log / breakpoint at its first line)
│    ├─ No  → UI-STATE layer: wrong wiring, disabled state, form default
│    │        prevented, conditional render hiding the element. Probe: inspect
│    │        component state/props in React/Vue devtools; check for
│    │        `preventDefault`, `disabled`, early returns.
│    └─ Yes → CLIENT-LOGIC layer: probe by logging the function's inputs and
│             its return/thrown value. Check: is the async call awaited? Is a
│             rejection swallowed (no .catch, no try/await)? A fire-and-forget
│             promise fails silently by design.
└─ Request fired → read the response, not just the status:
     ├─ 4xx/5xx, or 200 with an error body → SERVER layer. Probe: replay it
     │    without the UI:
     │      curl -i -X POST 'http://localhost:<port>/api/<endpoint>' \
     │        -H 'Content-Type: application/json' \
     │        -d '<exact payload copied from the Network tab>'
     │    Then read the server/function logs for that request. If the server
     │    calls an EXTERNAL API: curl the upstream directly with the same
     │    params, and check its status page — before blaming your code for
     │    upstream downtime.
     ├─ 2xx and response body looks correct, but data is wrong/missing later
     │    → DATABASE layer. Probe: query the store directly (psql, SQL editor,
     │      or the project's DB client) for the exact row:
     │        select * from <table> where <key> = '<value from the payload>';
     │      ⚠ If the DB has row-level security or per-user scoping, an admin
     │      query can show rows the app can never see (or vice versa). Re-run
     │      the query with the app's own filters (user id, tenant id) before
     │      concluding the data is/isn't there.
     │      Errors mentioning "schema cache", unknown column, or missing
     │      table/relation → you've identified the class; route the remedy to
     │      `database-schema-evolution`.
     └─ Request fired but to the wrong URL / wrong method / missing auth header
          → CLIENT-LOGIC layer (request construction). Probe: compare the sent
            request in the Network tab field-by-field against a known-good one.
```

Write down the answer: `FAILING LAYER: <layer>, evidence: <what you observed>`.

### Step 4 — One hypothesis at a time

Now, and only now, hypothesize. Use this template — in writing, every iteration:

```
HYPOTHESIS 1: <one sentence naming a specific mechanism, e.g.
              "the insert rejects because column X is NOT NULL and the client sends null">
FALSIFYING EXPERIMENT: <the cheapest observation that would prove this WRONG,
              e.g. "log the payload just before insert — if X is non-null, hypothesis dead">
RESULT: <confirmed | falsified — paste the evidence>
```

Rules:

- Exactly ONE hypothesis in play at a time. If your experiment would move two
  variables, split it.
- Design the experiment to *falsify*, not to confirm. Prefer reading/logging over
  editing; prefer a 30-second probe over a rebuild.
- Falsified → write HYPOTHESIS 2 and repeat. Confirmed → step 5.
- Three falsified hypotheses in a row → your step-3 layer diagnosis is probably
  wrong. Go back to step 3 and re-probe one layer up.

### Step 5 — ⛔ STOP gate: name the cause before writing the fix

⛔ STOP: Before writing ANY fix, state in one sentence what the root cause is and
cite the file and line, e.g. `Root cause: src/hooks/useX.ts:42 drops the promise
rejection, so failed inserts are invisible.` If you cannot write that sentence
with a file:line, you do not have a diagnosis — return to step 4. "I changed
something and the symptom went away" is not a diagnosis.

### Step 6 — Fix at the cause, not the symptom

Make the smallest change that removes the cause you just named.

Rule for defensive fixes: **if your fix is a try/catch or a null-guard, you must
write down why that value can legitimately be absent in a correctly functioning
system** (e.g. "optional field for users created before v2"). If you can't, the
guard doesn't fix the bug — it hides it, and the corruption moves downstream
where it will be harder to trace. Fix whatever is producing the illegitimate
null/exception instead.

If the cause is a missing migration / schema drift, do not hand-patch: follow
`database-schema-evolution` for the remedy.

### Step 7 — Post-fix: re-run the repro, then hunt siblings

1. Re-run the EXACT reproduction steps from step 1. The original symptom must be
   gone — not a similar flow, the recorded one.
2. Hunt the same bug class in sibling code paths. The pattern that caused this
   bug was almost certainly copy-pasted. Search for it:

   ```bash
   grep -rn '<the buggy pattern, e.g. "\.insert(" or the misused function name>' src/
   ```

   Check each hit for the same defect; fix or file them.
3. Hand off to `verification-before-done` to prove the change is complete
   (build, types, adjacent flows) — that is its job, not this skill's.

## Common mistakes

- **Shotgun edits.** Changing three things, seeing the symptom vanish, and moving
  on — you don't know which change mattered or what the other two broke.
  Corrective rule: one change per experiment; revert everything that wasn't the
  fix before committing.
- **Testing two hypotheses at once.** One experiment that could implicate either
  A or B tells you nothing when it fails. Corrective rule: the step-4 template
  holds exactly one hypothesis; if your experiment moves two variables, split it.
- **Trusting stale artifacts.** The code you're reading is not necessarily the
  code that's running: stale build output (`dist/`), a dev server that needs a
  restart after config/env changes, a service worker or browser cache serving old
  bundles, a DB client's cached schema after a migration. Corrective rule: when
  behavior contradicts the source in front of you, rebuild/hard-reload/restart
  FIRST (e.g. `rm -rf dist && npm run build`, DevTools → Network → "Disable
  cache", restart the dev server) — then re-observe before hypothesizing further.
- **Blaming the framework or library first.** "React is batching wrong",
  "the ORM is broken". Corrective rule: it is your code until you have a minimal
  reproduction *outside your codebase* that shows the library misbehaving. Mature
  libraries' bugs are rarer than misread docs.
- **Fixing the error message instead of the error.** Adding `?.` to silence
  "cannot read property of undefined", or catching-and-ignoring an exception, so
  the message disappears while wrong data flows on. Corrective rule: apply the
  step-6 null-guard test — legitimate absence justified in writing, or find the
  producer of the bad value.
- **Debugging the wrong environment.** Chasing a prod-only bug in a local setup
  that differs in env vars, data, or served layers (e.g. a frontend-only dev
  server where API routes never run). Corrective rule: before hypothesizing,
  confirm your repro environment actually exercises the failing layer — CLAUDE.md
  documents which run command serves what.

## Done criteria

- [ ] Step-1 symptom block filled in with exact error text (or exact silent behavior).
- [ ] Failure was reproduced first-hand before any code change (or the can't-reproduce branch was followed and evidence gathered via instrumentation).
- [ ] Failing layer named with the observation that proved it.
- [ ] Every hypothesis was written down with its falsifying experiment and result.
- [ ] Root cause stated in one sentence with file:line, BEFORE the fix was written.
- [ ] Any try/catch or null-guard in the fix has a written justification for legitimate absence.
- [ ] Original reproduction re-run after the fix: symptom gone.
- [ ] Sibling code paths searched for the same bug class; hits fixed or filed.
- [ ] Handed off to `verification-before-done` for the final done-proof.
