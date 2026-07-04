---
name: code-review-standards
description: "Use when reviewing code — a PR, a teammate's diff, or your own work before commit. Triggers: \"review this\", \"check my changes\", pre-commit self-review, evaluating AI-generated code."
---

# Code Review Standards

A procedure for judging whether a diff is correct, complete, and consistent —
in severity order, with evidence. The core principle: **review is reading with
a burden of proof.** An approval asserts "I checked the layers that matter and
found them sound"; if you cannot name what you checked, you have not reviewed,
you have skimmed.

## When to use / when not to use

Use this skill when:

- Asked to review a PR, a diff, or a commit ("review this", "check my changes",
  "thoughts on this PR?").
- Reviewing your own staged work before committing (see Self-review protocol).
- Evaluating code produced by an AI agent or a junior engineer (step 4 adds
  checks specific to that input).

NOT for:

- **Proving a change works at runtime** — use `verification-before-done`.
  Discriminating test: verification asks *does it WORK* (you run it); review
  asks *is it RIGHT* (you read it). A full pre-commit pass needs both — run
  verification first, then review the diff, because a diff that doesn't even
  run is not worth reading closely.
- **Explaining a runtime failure** — use `systematic-debugging`.
  Discriminating test: your input is a symptom (error, wrong output, crash),
  not a diff to evaluate. If review *uncovers* a suspected bug you can't
  confirm by reading, reproduce it via that skill; don't guess in a comment.
- **Auditing security-sensitive changes** — a diff touching auth, secrets,
  permissions, or row-level security gets `security-audit`'s deeper pass **in
  addition to** this review, not instead of it. Discriminating test: does any
  hunk touch who-can-do-what or credential material? Yes → both skills.
- **Committing/branching/PR mechanics after the review passes** — use
  `git-workflow-hygiene`. Discriminating test: the judgment is done and you're
  now packaging the change.

## Prerequisites

- The diff itself (`git diff`, `git diff --staged`, or the PR's changed files).
- The change's stated intent: PR description, linked issue/story, or commit
  message. If none exists, obtaining one is step 1 — do not skip ahead.
- Enough repo access to read files *outside* the diff (neighbors, callers).
  A diff cannot be reviewed in isolation; you will grep beyond it.

## The procedure

Work the layers in this order — severity first, style last. A logic bug found
late is a review failure; a naming nit found early is a distraction.

### Step 1 — Understand INTENT

State in one sentence what this change is supposed to do, sourced from the
description/story — not inferred from the code. Code can only be *wrong
relative to an intent*.

⛔ STOP: You can write "This change is supposed to: <one sentence>". If you
cannot — the description is empty, vague, or contradicts the diff — ask the
author (or the requesting user) before reviewing. Reviewing code against an
intent you guessed produces confident comments about the wrong problem.

### Step 2 — Correctness of the core logic

Read the primary hunks — the ones that implement the intent — and trace them
by hand with a concrete input. Does the algorithm do what step 1 says? Check
off-by-ones, inverted conditions, wrong operators, unhandled branches. Do not
proceed to lower layers until you'd stake the approval on this one.

### Step 3 — Data-flow and boundary contracts

The diff changed shapes and signatures; the rest of the system did not move
with it automatically. Check:

- **Types vs. storage:** if a type/interface changed, does it still mirror
  what the database/API actually stores and returns? A type that lies is
  worse than no type.
- **Callers of changed functions:** for every changed signature or behavior,
  find the call sites and confirm they still hold:

  ```bash
  grep -rn '<functionName>(' src/
  ```

- **API shapes:** request/response payloads, serialized formats, event
  shapes — preserved, or every producer AND consumer updated in this diff?

### Step 4 — Error paths and edge cases

Run the senior question list (below) against **each hunk**. Empty, null,
zero, concurrent, and degraded/offline inputs are where shipped bugs live.

### Step 5 — Consistency with the codebase's own conventions

Open a neighboring file that solves a similar problem and compare. The
standard is *this codebase's* pattern, not your personal taste. If the diff
introduces a second way to do something the repo already does one way, that's
a finding — unless the author says why, in which case the "why" belongs in
the code or the PR. Check the project's CLAUDE.md for documented conventions
before flagging.

### Step 6 — Style and naming (last, and only if unenforced)

Only comment on style the project's formatter/linter does not already
enforce — check the repo root for a formatter/linter config (e.g.
`.prettierrc`, `eslint.config.*`, `.editorconfig`, `rustfmt.toml`) to see
what tooling owns. If tooling owns it, tooling will catch it — say nothing.

### The senior question list

Run this literal checklist against each hunk in steps 2–4:

```
[ ] What happens on empty/null/zero input? And on input containing the output
    format's special characters (quotes, commas, newlines, HTML, SQL)?
[ ] Who else calls this? (grep — don't assume the diff shows all callers)
[ ] Does this break the degraded/fallback path (offline, feature-flagged-off,
    permission-denied, upstream-down)?
[ ] Is the type still telling the truth about what's actually stored/returned?
[ ] What happens to EXISTING data — rows/files/configs created before this change?
[ ] Is this the same pattern the codebase already uses for this problem —
    and if not, why?
[ ] What ISN'T in the diff that should be? (the missing migration, the missing
    enumeration-site update — the switch/map/doc row that lists "all" of
    something this diff just added one of, the missing doc/CLAUDE.md row)
```

### Severity taxonomy — every comment gets a tag

- **[blocker]** — bug, data loss, or security hole. Must be fixed before merge.
- **[should-fix]** — a real issue; could ship if genuinely urgent, but only
  with a follow-up filed and linked in the review.
- **[nit]** — take it or leave it; author's call, no re-review needed.

Rule: a review whose only findings are nits MUST also state that the
substantive layers (steps 1–5) were checked and found clean. Nits-only with
no such statement reads as "I only looked at style" — because it usually
means exactly that.

### Extra pass — AI-generated or junior-authored code

Add these checks. They target the specific ways this input fails while
*looking* excellent:

1. **Verify claims, don't accept them.** "Tests pass", "verified locally",
   "no callers remain" are claims. Ask for the evidence (command + output) or
   reproduce it yourself. AI agents in particular emit these phrases without
   having done the thing.
2. **Hunt hallucinated APIs.** For any method, option, or config key you
   don't recognize: check the import resolves, then check the installed
   package's docs or source that the symbol actually exists with that
   signature (e.g. look in `node_modules/<pkg>/`, the package's type
   definitions, or its published docs). Plausible-sounding methods that don't
   exist are a signature AI failure.
3. **Confirm deleted code was actually dead.** For every deleted function,
   export, or file, grep for callers yourself:

   ```bash
   grep -rn '<deletedSymbol>' src/ --include='*'
   ```

   Include dynamic references: string-keyed lookups, route tables, config
   files, templates — grep the whole repo, not just `src/`, if the symbol
   could be referenced by name.
4. **Watch for plausible-but-wrong idioms.** The correct-looking API used
   subtly incorrectly: an unawaited async call, a sort comparator that
   mutates, a locale-sensitive string operation in a protocol context, an
   equality check where the API returns a new object. If a line pattern-
   matches "how this is usually written," verify it against the docs anyway.
5. **Flag over-broad try/catch.** A new `try/catch` (or `.catch(() => {})`)
   whose purpose is to make an error disappear is a [blocker] unless the
   catch block handles a *named, legitimate* failure. Silencing is not
   handling — it moves the failure downstream where `systematic-debugging`
   will have to dig it out.

## Self-review protocol (before every commit)

Review your own diff exactly as you'd review a stranger's — hostile mindset:
"how would I attack this in review?"

1. **Pass 1 — intent.** Read the whole staged diff top to bottom in one pass:

   ```bash
   git diff --staged
   ```

   Confirm every hunk serves the stated intent. Unrelated hunks → unstage them.
2. **Pass 2 — the question list.** Re-read hunk by hunk running the senior
   question list. You wrote this code minutes ago; you are the person least
   able to see its gaps, which is why the checklist is literal.
3. **Cleanup while there.** Remove debug artifacts (`console.log`, `print`,
   `debugger`, commented-out experiments), dead code, and files that don't
   belong (editor swap files, local configs, generated output).
4. Findings you'd tag [blocker] or [should-fix] on someone else's PR get
   fixed now, not excused because they're yours.

Then hand off to `git-workflow-hygiene` for the commit itself.

## Output format

Deliver findings grouped by severity; every finding has a location, the
issue, and a concrete suggested fix — "this is wrong" without "do this
instead" is half a review.

```
## Review: <one-sentence intent from step 1>

### Blockers
- `path/to/file.ts:42` — <issue>. Fix: <concrete change>.

### Should-fix
- `path/to/other.ts:107` — <issue>. Fix: <concrete change>. (Follow-up: <link/ID if shipping anyway>)

### Nits
- `path/to/file.ts:12` — <issue>. Fix: <concrete change>.

### Checked and clean
<layers/questions checked with no findings — mandatory if any section above is empty>

**Verdict:** approve | approve-with-should-fixes | request changes
```

⛔ STOP: A review with zero findings must state explicitly WHAT was checked —
the layers (steps 1–5) and the question list — in the "Checked and clean"
section. "LGTM" without evidence is not a review; if you can't fill in that
section, go back and actually run the layers.

## Common mistakes

- **Style-nitpicking while a logic bug sails past.** Ten comments about
  naming, zero about the inverted condition in the core function — an order
  violation. Corrective rule: you may not write a style comment until steps
  2–4 are complete for that hunk; the layer order is mandatory, not advisory.
- **Approving on vibes because the code LOOKS professional.** Clean
  formatting, good names, thorough-seeming comments — AI-generated code
  always looks like this, including when it's wrong. Corrective rule:
  polish is not evidence; only tracing the logic (step 2) and the question
  list (step 4) are. The verdict must rest on checks you can name.
- **Reviewing only the diff.** The bug is often what the diff *should* contain
  and doesn't: the schema migration for the new column, the un-updated
  enumeration site, the doc/CLAUDE.md row, the snapshot regen. Corrective
  rule: the last question in the list ("what ISN'T in the diff?") is answered
  in writing for every review, even when the answer is "nothing missing".
- **Accepting "verified" claims without evidence.** "Tests pass" in a PR
  description is a sentence, not a test run. Corrective rule: claims by AI or
  junior authors are verified by reproducing them or seeing the command
  output (CI log, pasted terminal output) — no evidence, no approval.
- **Taste-based rewrites disguised as review.** "I'd have used a reducer
  here" when the codebase uses loops everywhere. Corrective rule: consistency
  is measured against the codebase (step 5's neighboring file), not against
  the reviewer's preferences; if the repo's own pattern matches the diff,
  there is no finding.
- **Marking everything [blocker] (or nothing).** Severity inflation trains
  authors to ignore tags; severity timidity ships bugs. Corrective rule:
  [blocker] means you would revert this if it merged — apply that test to
  each tag.

## Done criteria

- [ ] Intent stated in one sentence, sourced from the description/story (or the author was asked and answered).
- [ ] All six layers reviewed in order; steps 2–4 completed before any style comment was written.
- [ ] Senior question list run against each hunk, including "what ISN'T in the diff?" answered in writing.
- [ ] Every finding tagged [blocker]/[should-fix]/[nit] with file:line and a concrete suggested fix.
- [ ] For AI/junior-authored diffs: claims verified with evidence, unfamiliar APIs confirmed to exist, deleted symbols grepped for live callers.
- [ ] If zero findings (or nits only): "Checked and clean" section lists the layers and questions actually checked.
- [ ] Verdict line present: approve, approve-with-should-fixes (each with a follow-up filed), or request changes.
- [ ] If the diff touches auth/secrets/permissions/RLS: `security-audit` pass completed in addition.
- [ ] Self-review only: both passes done on the staged diff, debug artifacts and unrelated files removed, then handed to `git-workflow-hygiene`.
