---
name: skill-library-maintenance
description: "Use when creating, editing, reviewing, merging, or deprecating skills in .claude/skills/, or keeping the skill library and CLAUDE.md accurate as the project evolves. Triggers: \"add a skill\", \"update the skills\", \"this skill is outdated\", after any change that invalidates documented project facts."
---

# Skill Library Maintenance

This skill governs the skill library itself: how to add, edit, review, merge, and
retire skills, and how to keep CLAUDE.md in sync with repo reality. The core
principle: **skills carry methodology only; project facts live in CLAUDE.md.** When
the repo changes, you almost always update CLAUDE.md — a skill changes only when the
way of working itself improves.

## When to use / when not to use

Use this skill when:

- Asked to "add a skill", "write a skill for X", or "update the skills".
- A skill's advice failed in practice and needs correcting.
- Two skills' triggers have started to blur, or a skill is obsolete.
- Any change lands that invalidates documented project facts (env vars, schema,
  commands, conventions) and the docs must catch up.
- Reviewing a skill someone else (human or agent) wrote.

NOT for:

- **Documenting a project fact** (a port number, an env var, a table name) — edit
  CLAUDE.md directly; no skill is needed and no skill may hold that fact.
- **Committing the change** — follow `git-workflow-hygiene` for branch, message, and
  push mechanics.
- **Reviewing non-skill code** — use `code-review-standards`; this skill's rubric
  applies only to files under `.claude/skills/`.

## Prerequisites

- Read `references/style-guide.md` in full before authoring or reviewing anything
  — it is the binding contract for frontmatter, section order, voice, and length
  budget. This skill governs the *workflow* of applying that contract; it does not
  restate the contract itself (doing so would violate this skill's own duplication
  rule the moment the two drifted out of sync).
- Internalize the portability litmus test, applied to every sentence of every
  skill: **"Would this sentence be true and useful in a different repo?"** Project
  facts — names, ports, table names, vendor choices — live in the project's
  CLAUDE.md; skills point there. Enforcement command (substitute the project's
  name), must return nothing:

  ```bash
  grep -rni "<project-name>" .claude/skills/
  ```

## The procedure

1. **Confirm no existing skill covers the trigger.** List the library and read every
   sibling's description — the directory name alone is not enough to judge overlap:

   ```bash
   ls .claude/skills/
   grep -A2 "^description:" .claude/skills/*/SKILL.md
   ```

   For each sibling, ask: *could the user request that motivated this new skill
   plausibly fire that sibling's description?* Then decide:

   ```
   Does a sibling's description fire on the same request?
   ├─ Yes → Discriminating test: does the sibling's existing description already
   │        cover the new request without edits?
   │        ├─ Yes → it's a refinement: extend that skill (add a section or
   │        │        references/ file); do NOT create a new one
   │        └─ No, but the new content is a natural extension of the sibling's
   │        │   existing procedure (same trigger surface, one step deeper) →
   │        │   extend the sibling's BODY and DESCRIPTION together (widen the
   │        │   trigger phrases to cover it); do NOT create a new directory.
   │        │   Ask this before falling through to the next branch: "if I added
   │        │   one section to the sibling, would this request now be obviously
   │        │   its job?" If yes, this branch applies, not the next one.
   │        └─ No, the content belongs to a different procedure/audience entirely
   │                 → genuinely distinct: create the new skill AND sharpen both
   │                 descriptions until neither fires on the other's requests
   │                 (re-run this test to verify)
   └─ No  → continue to step 2
   ```

   The middle branch exists because "does the description already cover it" and
   "is this the right architectural home for it" are different questions — almost
   any genuinely new nuance fails the first without failing the second. Defaulting
   to "create new" for every non-covered request is how the library proliferates
   near-duplicate skills; prefer deepening an existing procedure over adding a
   directory whenever the trigger surface is already shared.

   ⛔ STOP: also ask whether this should be a skill at all. If the content is a
   project fact or a one-line rule ("we use pnpm, not npm"), add a line to CLAUDE.md
   instead and stop here. A skill must be a reusable *procedure*.

2. **Draft per the style guide.** Follow `references/style-guide.md` exactly:
   frontmatter contract, required section order, imperative voice, ⛔ gates,
   150–350 lines with depth pushed into `references/`.

3. **MANDATORY self-walkthrough.** Pick one concrete scenario the skill should
   handle. Execute your own procedure against it step by step, role-playing a junior
   engineer who follows instructions literally, in order, and infers nothing. Every
   time you have to guess ("which file? which case am I in? is this good enough?"),
   you have found a defect — fix the skill by pre-making that judgment call (add the
   discriminating test, the literal command, or the decision tree branch). Repeat
   until the walkthrough completes with zero guesses.

   ⛔ STOP: if you cannot name a concrete scenario to walk through, the skill's
   trigger is too vague to ever fire — rewrite the description first.

4. **Consistency check against siblings.** Re-read the other skills' descriptions
   and skim their bodies for:
   - **Trigger collision** — could two descriptions fire on the same request? If so,
     sharpen or merge (see the deprecation/merge procedure below).
   - **Contradiction** — does the new skill's advice conflict with a sibling's?
     Resolve it; never leave two skills disagreeing.
   - **Duplication** — does it restate a sibling's content? Replace with a
     cross-reference ("commit per `git-workflow-hygiene`").

5. **Update the skill index in CLAUDE.md.** Add (or amend) the new skill's row in
   the project's CLAUDE.md skill index: name plus one-line trigger summary. If
   CLAUDE.md has no skill index yet, create the section.

6. **Commit** following `git-workflow-hygiene`. The skill directory and the
   CLAUDE.md index update belong in the same commit.

## ⛔ STOP gate: before committing any new or edited skill

All three must pass; if any fails, fix it before the commit — do not defer:

1. Run the 8-check reviewer rubric (below) against the skill, with evidence per check.
2. Verify the CLAUDE.md skill index row exists and matches the skill's description.
3. Run the portability grep and confirm empty output:

   ```bash
   grep -rni "<project-name>" .claude/skills/
   ```

## Reviewing a skill (yours or anyone's)

Apply the 8-check rubric in `references/style-guide.md` §8 (trigger, boundaries,
executability, concreteness, gates, portability, honest mistakes, done criteria).

A pass requires **per-check evidence** — a quoted line or line reference for each of
the 8 checks — not a bare "yes". For the executability check you must role-play a
concrete scenario, exactly as in procedure step 3. A review without evidence is not
a review; redo it.

## Maintenance triggers: change type → what to update

| Change in the repo | Update |
|---|---|
| New or renamed env var | CLAUDE.md env table + `.env.example` |
| Schema change (table, column, migration) | CLAUDE.md database section |
| New command or script | CLAUDE.md commands table |
| New convention adopted (naming, structure, tooling) | CLAUDE.md conventions section |
| Methodology lesson learned (a skill's advice failed in practice) | That skill's procedure or common-mistakes section |
| New skill added / skill removed or merged | CLAUDE.md skill index |

Principle: **repo reality changes → update CLAUDE.md, NOT the skills.** Skills
change only when the methodology itself improves — a step order that proved unsafe,
a missing gate, a discovered failure mode. If you find yourself editing a skill to
record a project fact, you are putting the fact in the wrong file.

## Deprecating or merging skills

When two skills' triggers blur (users' requests could fire either), merge rather
than letting them drift:

1. **Check cross-references first.** Never delete or rename a skill without finding
   who points at it:

   ```bash
   grep -rn "<skill-name>" .claude/skills/ CLAUDE.md
   ```

2. **Merge into the skill with the stronger trigger** — the one whose description
   more precisely matches what users actually ask. Fold the weaker skill's unique
   procedure content in (as a section or a `references/` file); discard duplication.
3. **Leave no stub.** Delete the losing skill's directory entirely; a stub directory
   with a "moved" note pollutes the trigger space and confuses skill selection.
4. **Repoint every cross-reference** found in step 1 to the surviving skill, and
   update its description to cover the absorbed triggers.
5. **Update the CLAUDE.md skill index**: remove the dead row, amend the survivor's.
6. Re-run the ⛔ STOP gate above on the merged skill, then commit per
   `git-workflow-hygiene`.

Pure deprecation (no successor) follows the same steps minus the merge: check
cross-references, delete the directory, repoint or remove references, update the
index.

## Common mistakes

- **Descriptions that describe content instead of triggers.** "A guide to API error
  handling" never fires because no user request matches it. Corrective rule: the
  description's first words are "Use when …" followed by phrases users actually
  type; test it by asking "which of my last five requests would have loaded this?"
- **Skills that restate project docs.** A skill listing the project's actual env
  vars or table names rots the first time they change, and rots silently. Corrective
  rule: apply the litmus test per sentence; facts go to CLAUDE.md, the skill points
  at CLAUDE.md.
- **Adding a skill when a CLAUDE.md line would do.** "Always use pnpm" is one line
  of CLAUDE.md, not a package-manager skill. Corrective rule: a skill must be a
  multi-step *procedure* with judgment calls worth pre-making; if it has no
  procedure, it is a fact or a convention — file it as one.
- **Letting CLAUDE.md rot after changes.** Landing an env var, schema, or command
  change without touching CLAUDE.md leaves every future session working from false
  facts. Corrective rule: consult the maintenance-triggers table as part of the
  change itself, not as a follow-up task.
- **Cloning generic best-practice advice into common-mistakes.** "Don't write
  untested code" is filler that teaches nothing. Corrective rule: every
  common-mistakes entry must name a specific failure mode observed (or concretely
  foreseeable) in *this* task, with the rule that prevents it — if it could appear
  unchanged in any skill, cut it.
- **Skipping the self-walkthrough because the skill "reads fine".** Reading is not
  executing; guess-points only surface when you role-play a literal-minded junior
  against a concrete scenario. Corrective rule: procedure step 3 is mandatory, and
  "zero guesses" is the exit condition.

## Done criteria

A skill-library task is finished when every applicable box checks:

- [ ] The skill's `name` equals its directory name; description is third-person,
      trigger-first, with concrete trigger phrases.
- [ ] Body follows the section order in `references/style-guide.md`, within the
      150–350 line budget, depth pushed to `references/`.
- [ ] Self-walkthrough completed against a concrete scenario with zero remaining
      guess-points.
- [ ] No trigger collision, contradiction, or duplication with any sibling skill
      (descriptions re-read, bodies skimmed).
- [ ] 8-check rubric passed with per-check evidence recorded.
- [ ] `grep -rni "<project-name>" .claude/skills/` returns nothing.
- [ ] CLAUDE.md skill index row added/amended/removed to match the library.
- [ ] For merges/deprecations: cross-reference grep run, no stub left, all
      references repointed.
- [ ] Change committed per `git-workflow-hygiene`, skill + index in one commit.
