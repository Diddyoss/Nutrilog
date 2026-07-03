# Skill Authoring Style Guide

This is the binding contract for every skill in `.claude/skills/`. It exists so that
skills written by different authors (human or agent, in parallel) read as one library,
and so that a junior engineer or a smaller AI model can execute any skill without
access to its author. Reviewers use the rubric at the bottom; authors should self-check
against it before declaring a skill done.

## 1. File layout

```
.claude/skills/<skill-name>/
  SKILL.md            # required — the skill itself
  references/         # optional — depth that would bloat SKILL.md
    <topic>.md
```

- `<skill-name>` is kebab-case, a verb phrase or noun phrase naming the *activity*
  (`systematic-debugging`, not `debugging-tips`).
- Do not collide with built-in harness skills (`verify`, `code-review`,
  `security-review`, `init`, `run`, `simplify`, `review`).
- A skill owns only its own directory. Never write into a sibling skill's directory.

## 2. Frontmatter contract

```yaml
---
name: skill-name-matching-directory
description: Use when <situation>, <situation>, or <situation> — <what the skill delivers>. Triggers: "<phrase>", "<phrase>", <event>, <event>.
---
```

- `name` MUST equal the directory name exactly.
- `description` is the ONLY thing the model sees when deciding whether to load the
  skill. It must be trigger-first: state WHEN to use it, in third person, before what
  it contains. Include concrete trigger phrases a user would actually type.
- Target ≤ 500 characters. No markdown inside the description.
- Bad: `description: A guide to best practices for debugging.` (describes content,
  never fires). Good: `description: Use when investigating any bug, error, regression,
  or unexplained behavior — before proposing a fix. Triggers: "X is broken", "why does
  this fail", error messages, stack traces, "it worked before".`

## 3. Body structure (required section order)

1. `# <Title>` — one line, then a 2–4 sentence statement of purpose and the core
   principle of the skill (the one idea to remember if everything else is forgotten).
2. `## When to use / when not to use` — bullet the trigger situations, then bullet
   the boundaries: "NOT for X — use `<adjacent-skill>` instead" for every adjacent
   skill that could be confused with this one.
3. `## Prerequisites` (only if real) — what must exist or be known before starting.
4. `## The procedure` — the heart of the skill. Numbered steps. See §4.
5. Optional deep-dive sections (decision trees, templates, worked examples).
6. `## Common mistakes` — the failure modes of people/models attempting this task,
   each with the corrective rule. Minimum 4 entries. These come from real experience;
   generic filler ("don't write bad code") is banned.
7. `## Done criteria` — a checklist that defines "finished". Every item objectively
   checkable.

## 4. Writing the procedure

- **Imperative, second person, present tense.** "Run the build. Read the error.
  State your hypothesis in one sentence." No hedging ("you might want to consider…"),
  no throat-clearing.
- **Every command concrete and copy-pasteable.** If a step involves running something,
  show the literal command in a fenced block. Use placeholders in angle brackets
  (`<table-name>`) only where the value is genuinely project-specific.
- **STOP gates.** Wherever a smaller model is tempted to rush ahead, insert a gate:
  `⛔ STOP: <condition that must be true>. If not, <what to do instead>.`
  Use the ⛔ marker exactly so gates are greppable. Every skill needs at least one.
- **Decision trees, not prose forks.** When the next step depends on a condition,
  render it as an indented tree:
  ```
  Is the error reproducible locally?
  ├─ Yes → step 3
  └─ No  → Does it depend on env vars you lack?
           ├─ Yes → stub the boundary (§5) and reproduce the layer below it
           └─ No  → instrument with logging, redeploy, gather evidence first
  ```
- **Pre-make the judgment calls.** The reader must never have to ask "but how do I
  know which case I'm in?" — give the discriminating test.
- **Output formats.** If the skill produces a deliverable (findings list, plan,
  runbook), include the exact template to fill in.

## 5. The portability rule

Skills carry **methodology only**. Project facts live in the project's `CLAUDE.md`.

- Litmus test for every sentence: *"Would this sentence be true and useful in a
  different repo?"* If no, it belongs in CLAUDE.md, not here.
- The name of the current project MUST NOT appear anywhere in a skill.
- Naming specific technologies is allowed **as examples, never as assumptions**:
  "e.g. a Vite project → Vitest" is fine; "open the Supabase dashboard" as an
  unconditional instruction is a leak. When in doubt, phrase it conditionally:
  "if migrations are applied by hand (no migration runner)…".
- Point at CLAUDE.md explicitly where project facts are needed: "Check the project's
  CLAUDE.md for the env-var contract before this step."

## 6. Length budget and progressive disclosure

- SKILL.md: **150–350 lines.** Under ~80 lines usually means the skill is filler or
  missing its common-mistakes/done-criteria sections; over 350 means depth belongs in
  `references/`.
- `references/` files are loaded on demand — put long templates, extended examples,
  and background rationale there, and link them from SKILL.md with one line saying
  when to read them.
- Never duplicate a sibling skill's content. Cross-reference it:
  "Commit the change following `git-workflow-hygiene`."

## 7. Voice and audience

Write for a competent junior engineer or a Sonnet-class model executing under time
pressure, with no access to the author. That reader:

- follows numbered steps literally and in order — so the order must be safe;
- will not infer unstated context — so state it;
- is tempted to skip verification — so gate it (⛔);
- over-trusts its own first hypothesis — so force falsification steps;
- pattern-matches to generic best practice — so when this skill deviates from
  generic practice, say so explicitly and say why.

## 8. Reviewer rubric (8 checks — all must be YES)

Reviewers must answer each with evidence (quote or line reference), not a bare yes.

1. **Trigger:** Does the description state WHEN to use the skill, trigger-first, with
   concrete phrases — and is it distinct from every sibling skill's description?
2. **Boundaries:** Does "when not to use" name the adjacent skills and give a
   discriminating test?
3. **Executability:** Could a Sonnet-class model follow the procedure without making
   a judgment call the skill hasn't pre-made? (Reviewer must role-play a concrete
   scenario to answer this.)
4. **Concreteness:** Is every runnable step shown as a literal command or exact
   template, not described in prose?
5. **Gates:** Is there at least one ⛔ STOP gate, placed where rushing ahead is most
   tempting, with a defined recovery path?
6. **Portability:** Does every sentence pass the litmus test? (Project name absent;
   technology mentions are examples/conditionals, not assumptions.)
7. **Honest mistakes:** Are the common-mistakes entries specific failure modes with
   corrective rules — at least 4, no filler?
8. **Done criteria:** Is "finished" defined as an objectively checkable list?

## 9. Maintenance

When repo reality changes (new env var, new table, new convention), update CLAUDE.md —
not the skills. Skills change only when the *methodology* improves. The
`skill-library-maintenance` skill owns the procedure for adding, editing, merging,
and deprecating skills; read it before touching this library.
