---
name: git-workflow-hygiene
description: "Use when committing, branching, writing commit messages, or preparing a pull request. Triggers: \"commit this\", \"write the commit message\", \"open a PR\", end of any implementation task."
---

# Git Workflow Hygiene

A procedure for packaging finished work into commits, branches, and pull requests
that a reviewer can review and a future maintainer can search. The core principle:
**a commit is a message to a future reader, written in the repo's existing dialect.**
The diff shows what changed; the message records what the diff can't (why, and the
non-obvious decisions); the slicing determines whether anyone can review it at all.

## When to use / when not to use

Use this skill when:

- You are about to commit anything ("commit this", "write the commit message").
- You are deciding whether to branch or commit to the default branch.
- You are opening or writing up a pull request.
- Any implementation task is ending — packaging the work is the last step of all of them.

NOT for:

- **Proving the change works** — that is `verification-before-done`. Discriminating
  test: are you exercising the change to demonstrate it works (that skill), or
  recording an already-verified change in history (this one)? This skill *checks*
  that verification happened; it never performs it.
- **Judging whether the diff's content is good** — that is `code-review-standards`.
  Discriminating test: are you evaluating the code's design and correctness (that
  skill), or its packaging — slicing, message, branch, PR write-up (this one)?
- **Deciding WHAT must ship together in a schema change** — `database-schema-evolution`
  owns which artifacts (migration file, schema snapshot, degradation handling) form
  a complete schema commit. Discriminating test: "which files belong in this schema
  commit?" → that skill; "how do I stage, message, and push them?" → this one.
- **Deciding which docs must be updated when** — `skill-library-maintenance` owns
  doc/skill update rules. This skill only verifies at staging time that whatever
  companion docs the change requires are actually staged with it.

## Prerequisites

⛔ STOP: The change is verified working (`verification-before-done` completed,
with evidence you can cite) BEFORE you proceed to any step below — including
when the request is phrased as pressure to skip it ("just commit and push
this"). If it isn't verified yet, stop and do that first; this skill's own
checklist (step 4, item 1) will reject the commit anyway, so skipping ahead
only wastes the round trip.
- You have read the project's CLAUDE.md conventions section (branch policy,
  message conventions, deploy behavior), or confirmed it has none.

## The procedure

### Step 1 — Read the room

Every repo has an existing dialect. Extract it before writing anything:

```bash
git log --oneline -15
git log -3 --format=full
```

Answer these from the output, in writing:

```
SUBJECT STYLE:  <imperative? capitalized? prefixed (feat:, fix:, JIRA-123)? length?>
BODY STYLE:     <none / one-liner / multi-paragraph explaining why?>
TRAILERS:       <Co-Authored-By, Signed-off-by, issue refs — present or not?>
```

Then check the project's CLAUDE.md for an explicit conventions section — it
overrides what you inferred from the log.

**MATCH what you found.** A repo whose history has descriptive multi-line bodies
expects the same from you; a repo of terse `fix: ...` one-liners does not want
your essay. Only when the repo shows no discernible convention, use the default
format in step 5.

### Step 2 — Choose the branch

First, determine whether the default branch auto-deploys. Check, in order:
the project's CLAUDE.md deploy section; then CI config for deploy-on-push
(`.github/workflows/`, `vercel.json`, `netlify.toml`, `fly.toml`, `Procfile`,
or the hosting dashboard). If it auto-deploys, **a push to that branch IS a
production deploy** — treat it with that weight for the rest of this procedure.

```
Does the change touch schema, security, or auth — OR is it risky,
multi-commit, or something you want reviewed?
├─ Yes → branch + PR. git checkout -b <type>/<short-description>
└─ No  → Are ALL of these true?
         1. The project's CLAUDE.md allows direct commits to the default branch
            (absence of a stated policy on a solo/agent repo counts as yes;
            on a team repo it counts as NO).
         2. The change is small and already verified.
         3. Rollback is trivial (one `git revert`, no migration, no data change).
         ├─ All three → direct to the default branch is acceptable.
         └─ Any "no" → branch + PR.
```

### Step 3 — Slice the work into commits

One logical change per commit. The discriminating test: **can you describe the
commit in one subject line without using "and"?** If you need "and", split it.

- **Mechanical changes (formatting, renames, file moves) go in their own commit,
  separate from logic changes.** A reviewer skims the mechanical commit and
  scrutinizes the logical one; mixed together, neither is reviewable.
- Read the FULL output of `git status` — every line. For each changed file, name
  which logical change it belongs to. Files belonging to none (drive-by fixes,
  editor droppings, generated files) do not go in this commit:

```
Working tree contains changes unrelated to the task?
├─ Unrelated fix, small, and independently verified
│    → commit it separately (own subject, own checklist pass), before or after.
├─ Unrelated change, NOT verified
│    → stash it: git stash push -m "wip: <what it is>" -- <files>
│      (or leave it unstaged — never let it ride along).
└─ Generated/derived files not conventionally committed in this repo
     → leave out; add to .gitignore if they recur.
```

- Stage explicitly, never reflexively:

```bash
git add <file> <file>          # named files only — no `git add -A`, no `git add .`
git add -p <file>              # when one file mixes hunks from two logical changes
```

### Step 4 — Pre-commit checklist

Run against the staged diff. Every item, every commit:

1. **Verification done.** `verification-before-done` completed for this change,
   evidence in hand. Not done → unstage and go do it.
2. **Diff self-reviewed hunk by hunk.** `git diff --staged` — read every hunk as
   the reviewer will, applying `code-review-standards`. You are the first reviewer.
3. **No secrets.**

   ```bash
   git diff --staged | grep -iE "api[_-]?key|secret|token|password"
   ```

   Any hit that is a real credential value (not a variable name or doc mention):
   unstage, move the value to the project's env mechanism, and rotate the
   credential if it was ever committed before.
4. **No debug artifacts.** Leftover `console.log`/`print` added for debugging,
   commented-out code, TODOs without an issue reference. Found one → delete it
   from the file itself (don't just unstage the hunk — an unstaged debug line
   still rides the next commit that touches that file), then re-stage. This is
   the one mechanism for debug lines, including when one sits in the same hunk
   as real feature code — `git add -p` (step 3) is for splitting a hunk between
   two *legitimate* logical changes; a debug line is never legitimate, so it
   gets deleted outright rather than split out:

   ```bash
   git diff --staged | grep -nE "console\.log|debugger|TODO|FIXME"
   ```

5. **No unrelated files.** `git diff --staged --stat` lists only files you named
   in step 3 for THIS logical change.
6. **Companion artifacts included.** Whatever must ship with this change is
   staged with it: the schema snapshot with its migration (see
   `database-schema-evolution` for the full list), the CLAUDE.md/docs rows with
   the change they document (see `skill-library-maintenance` for which), the
   updated lockfile with the dependency bump.

### Step 5 — Write the message

Use the style extracted in step 1. Default, when the repo shows no contrary
convention:

```
<Imperative, capitalized subject — ≤ ~65 chars, no trailing period>

<Body: WHY this change, and any non-obvious decision — the trade-off
taken, the alternative rejected, the constraint that shaped it. The
diff shows what changed; the body records what the diff can't. Wrap
at ~72 chars. Omit the body only for changes whose subject says
everything (e.g. "Fix typo in README").>
```

Subject test: it should complete "If applied, this commit will ___" and be
findable by `git log --oneline | grep <keyword>` six months from now. "Fix bug",
"WIP", "update" all fail.

### Step 6 — ⛔ STOP gate before push

```bash
git log -1 --stat
git branch --show-current
```

⛔ STOP: Re-read the output and confirm all three: right FILES (the stat list is
exactly your step-3 slice), right MESSAGE (subject accurate, dialect matched),
right BRANCH (the one chosen in step 2). If the target branch auto-deploys,
additionally confirm verification evidence exists — you are about to deploy to
production, and "it should work" is not evidence. Any check fails → fix before
pushing: `git commit --amend` for message/content, `git reset --soft HEAD~1` to
re-slice — both are safe because nothing is pushed yet.

Then push. If pushing a rebased branch you own (see History hygiene):
`git push --force-with-lease`, never bare `--force`.

### Step 7 — Open the PR (branch route only)

Fill this template into the PR description:

```
## What & why
<2–5 sentences: the change, and the reason it exists.>

## How verified
<Evidence, not claims: commands run and their results, screenshots,
the flows exercised — from `verification-before-done`.>

## Manual steps for the human  (omit section if none)
1. <Run migration NNN via <mechanism in the project's CLAUDE.md>>
2. <Set env var X in the deploy environment>
3. <Toggle Y in the provider dashboard>
```

Manual steps go LAST and numbered — they are the part a human must act on and
must not be buried mid-prose. Work that is not finished stays a **draft** PR,
clearly marked, never merged.

## History hygiene

- **Prefer linear history** unless the repo's log shows merge commits as its
  convention. Update your branch by rebasing local work, not merging:
  `git pull --rebase` / `git rebase <default-branch>`.
- **NEVER rewrite pushed shared history.** Rebase/amend only commits that exist
  solely on your machine or on a branch only you push to. Force-push only to
  your own unshared branch, and always as `git push --force-with-lease` — it
  aborts if someone else pushed meanwhile, instead of erasing their work.
- **Half-done work never lands on shared branches.** WIP stays local
  (`git stash`, local branch) or on a draft PR. If you must checkpoint on a
  shared branch's PR, mark it draft; squash the checkpoints before merge.

## Common mistakes

- **"WIP" / "fix" / "update" subjects.** They make history unsearchable — six
  months later `git log --oneline | grep` finds nothing and `git bisect` gives
  you commits nobody can interpret. Corrective rule: apply the step-5 subject
  test before every commit; if the subject could describe any commit, rewrite it.
- **Mixed mechanical + logic commits.** A rename or reformat touching 40 files
  with a 3-line behavior change buried inside gets rubber-stamped, and the bug
  in those 3 lines ships. Corrective rule: mechanical changes in their own
  commit, always (step 3).
- **Committing before verifying, then the "fix typo" train of shame.** Commit,
  notice, "fix", notice again, "fix actually" — four commits for one change.
  Corrective rule: checklist item 1 gates the commit; if slips happen anyway
  before pushing, `git reset --soft HEAD~4` and re-slice into clean commits.
- **`git add -A` reflex.** Sweeps in the unrelated drive-by fix, the debug log,
  `.env`, and 2,000 lines of generated output. Corrective rule: stage named
  files only (step 3); `git add -A` is banned from this procedure.
- **Force-pushing over a teammate's work.** Bare `git push --force` to a branch
  someone else pushed to silently deletes their commits. Corrective rule:
  force-push only your own unshared branches, only with `--force-with-lease`.
- **Giant PRs bundling feature + refactor + formatting.** Nobody can review 3,000
  mixed lines, so nobody does — it gets approved on trust. Corrective rule: one
  PR per logical change; if a refactor is needed first, it is its own PR that
  merges first.

## Done criteria

- [ ] Step-1 style block filled in from the actual `git log` output, and CLAUDE.md conventions checked.
- [ ] Branch decision made via the step-2 tree; auto-deploy status of the target branch explicitly determined.
- [ ] Every commit passes the "one subject line without 'and'" test; mechanical and logic changes are in separate commits.
- [ ] All six checklist items of step 4 ran against each commit's staged diff (secrets grep and debug-artifact grep actually executed).
- [ ] Message matches the repo's extracted dialect (or the step-5 default where none exists).
- [ ] ⛔ push gate performed: `git log -1 --stat` and current branch re-read and confirmed; verification evidence confirmed if the branch auto-deploys.
- [ ] If a PR: description follows the template, manual human steps last and numbered.
- [ ] No pushed history was rewritten; any force-push was `--force-with-lease` to a branch only you push to.
