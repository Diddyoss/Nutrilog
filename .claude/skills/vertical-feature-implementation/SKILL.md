---
name: vertical-feature-implementation
description: "Use when adding a user-facing feature that spans layers — data model to persistence to state to UI. Triggers: \"add a feature\", \"add a new field/log/tab\", \"let users do X\", any change touching both schema and interface."
---

# Vertical Feature Implementation

A procedure for adding one feature as a thin vertical slice through every layer of
the stack. Core principle: **build bottom-up, one layer at a time, and verify each
layer against the one below it before starting the next.** Each layer's contract is
dictated by the layer beneath — starting from the UI forces you to invent that
contract twice: once as a guess, once as a rewrite when the real data shape arrives.

## When to use / when not to use

Use this skill when:

- Adding a user-facing capability: "add a feature", "let users do X", "add a new
  field / log / tab / screen".
- Any change that touches both stored data and the interface, even a single column
  surfaced in one component.
- Extending an existing feature with a new attribute that must persist.

NOT for:

- **The schema/migration step itself** — that is owned by `database-schema-evolution`;
  this skill delegates to it at step 2. Discriminating test: if the *whole* task is a
  schema change with no new UI or business logic, go straight there.
- **A repo you can't yet navigate** — use `codebase-orientation` first. Discriminating
  test: can you name the existing feature most analogous to the one you're adding,
  and point at its files? No → orient first, then return here.
- **Proving the finished feature works** — `verification-before-done` owns the final
  proof. This skill verifies each layer as it's built; the end-to-end done-proof is
  handed off.
- **Fixing existing behavior that's wrong** — use `systematic-debugging`. Test: is
  the requested behavior *new* (this skill) or *supposed to already work* (that one)?
- **Commit mechanics** (branching, message format, when to split commits) — use
  `git-workflow-hygiene`. This skill only dictates what belongs together (e.g.
  schema + types in the same commit).

## Prerequisites

- You've read the project's CLAUDE.md: build/typecheck/run commands, directory
  conventions, where shared types live.
- You can name one analogous existing feature (see the codebase-orientation boundary
  above).
- The app runs locally, or you know why it can't (CLAUDE.md caveats).

## The procedure

### Step 0 — Define the slice before any code

Fill this in, in writing, first:

```
USER STORY:  <one sentence: "A user can <action> so that <benefit>.">
DONE MEANS:  user can do <X, the exact interaction> and sees <Y, the exact observable result —
             including after a page reload / app restart>
OUT OF SCOPE: <adjacent ideas you are explicitly not doing in this slice>
```

If the request underspecifies scope — which entity type it applies to when
several exist, or what the value set is (e.g. "let users tag items with a
status": every item type in the app, or one? status as free text, or a fixed
set?) — the act of writing ONE concrete sentence forces you to pick. Do not
silently narrow it: state the disambiguating choice as its own line under OUT
OF SCOPE so it reads as a decision, not an assumption ("OUT OF SCOPE: the other
two item types — this slice covers only <the one named in the story>").

⛔ STOP: The story fits in ONE sentence with no "and also". If it doesn't, split it
into multiple slices and do them one at a time — each slice runs this whole
procedure independently.

The DONE MEANS line is your acceptance check. You will execute it literally at the
end. "Sees Y after reload" is not optional: a feature that works only until refresh
is half-wired, not done.

### Step 1 — Plan the layer order (do not skip to your favorite layer)

Build in this order:

```
1. schema / migration        (storage: what is persisted)
2. shared types              (the contract: code's view of storage)
3. data-access layer         (hooks / repositories / services: how code reads & writes it)
4. UI components             (how the user sees and edits it)
5. wiring / navigation       (how the user reaches it)
```

Rationale: each layer compiles and is verifiable against the one below it. The
types are checked against the real columns, the data access against the real types,
the UI against a data-access layer you've already exercised. Invert the order and
every layer is written against an imagined contract — you'll pay for the guesses
when the layers meet in the middle.

At EVERY layer, before moving on, answer the backward-compat question:

> **What happens to existing rows, older clients, and users mid-session during
> deploy?**

Each step below tells you what that question means at that layer. If the answer at
any layer is "it breaks", the fix belongs at that layer, now — not as a follow-up.

### Step 2 — Schema layer (delegated)

Design and apply the storage change by following `database-schema-evolution`
end-to-end — it owns migration files, the canonical schema file, defaults,
constraints, and RLS. Come back here when it's applied.

Backward-compat here: existing rows won't have the new column's value. Decide NULL
vs DEFAULT now, because every layer above inherits that decision (a nullable column
means a nullable type means a UI that renders the absent case).

### Step 3 — Shared types layer

If the project has a shared types file that mirrors storage (check CLAUDE.md; common
shapes: a `types.ts`, generated DB types, model classes):

1. Update it to mirror the new/changed columns exactly — same names, nullability
   matching the schema decision from step 2, and for enum-like columns the same
   value set as the DB constraint (a TS union of `'great' | 'ok' | 'bad'` must
   list exactly what the CHECK constraint or enum type allows). Same commit as
   the schema change (`database-schema-evolution` already requires this; don't
   undo it here).
2. Find every enumeration site. Grep the types you *extended*, not the new type
   you just created (a brand-new type has no consumers yet — the risk lives in
   code that switches over the entity or union you changed):

   ```bash
   grep -rn '<ExtendedEntityType>' src/        # every consumer of the changed entity
   grep -rn "'<existing-union-member>'" src/   # switches/maps keyed on union values
   ```

   Visit each hit and decide: does this site need the new member/field, or is it
   correctly indifferent? Write down the sites you deliberately left unchanged.

Backward-compat here: can code holding the OLD type shape (an older deployed client,
a cached object in a live session) still round-trip? Never repurpose or rename an
existing field's meaning — add a new one.

### ⛔ STOP gate — typecheck before any UI work

```bash
# Use the project's typecheck command from CLAUDE.md; typical fallbacks:
npx tsc --noEmit        # TypeScript
npm run build           # if no separate typecheck script exists
```

⛔ STOP: The typecheck passes with the new types in place. If it fails, the errors
are your step-3 enumeration-site list — fix them all now. Do not open a component
file until this is green: UI written against broken types stacks guesses on guesses.

### Step 4 — Data-access layer

1. Find the analogous unit. The project already has a pattern — a hook, repository,
   service, or query module per entity:

   ```bash
   ls src/hooks/ src/services/ src/repositories/ 2>/dev/null
   grep -rln '<analogous-table-or-entity>' src/ --include='*.ts' --include='*.tsx'
   ```

2. Read the closest analogous one fully. Imitate it: same naming, same return shape
   (data + loading + error), same error handling and refresh behavior. If it
   handles a degraded case (e.g. table/column missing until a migration runs),
   yours handles the same case the same way.
3. Extend an existing unit if the feature is a new attribute of an existing entity;
   create a sibling unit if it's a new entity. Do not invent a third style.

Backward-compat here: what does a read return for existing rows (NULLs from step 2)?
What does a write from an older client (not sending the new field) produce? Both
must be non-errors.

### ⛔ STOP gate — exercise the data access before building UI on it

⛔ STOP: You have watched the new read AND write path execute with your own eyes,
before any UI exists for it. UI built on unexercised data access means your first
end-to-end test debugs two layers at once. Pick the cheapest probe:

```
Does the project have fast unit/integration tests for this layer?
├─ Yes → write one: insert via the new path, read it back, assert the field survives.
└─ No  → temporary call: mount the hook / call the repository from an existing
         screen or a scratch script, log the result, then verify in the store:
           select * from <table> order by created_at desc limit 3;
         Delete the temporary call afterwards (grep for your log marker to be sure).
```

Verify both directions: a write lands in storage with the new field populated, and
a read of a pre-existing row (without the field) returns cleanly.

### Step 5 — UI layer

1. Reuse before building: find how the analogous feature renders — its form
   controls, list items, cards — and use the same components and design patterns.
   A new feature should look like it was always there.
2. Every data-driven view handles all four states. Render each one on purpose, don't
   assume:
   - **loading** — what shows while the fetch is in flight?
   - **empty** — zero rows for this user (a brand-new account sees this first).
   - **error** — the fetch/write failed; the user gets feedback, not silence.
   - **populated** — including a row where the new field is NULL (your step-2 rows).
3. Wire user actions to the step-4 layer only. No inline queries or fetches from
   components if the project routes data access through hooks/repositories.

Backward-compat here: a user mid-session during deploy may hold pre-deploy state
in memory or serve a cached bundle against the new schema. Absent fields must
render as absent, not crash.

### Step 6 — Wiring and discoverability

A feature that works but can't be reached doesn't exist. Check every one:

- [ ] Entry point exists: a route, tab, button, or menu item leads to the feature.
      (If the feature lives *inside* an existing screen, confirm that screen
      actually renders the new element — not just that the component compiles.)
- [ ] Navigation registered: new routes added to the router; new tabs/menu items
      added to the nav component; deep link or back button behaves.
- [ ] State survives: perform the DONE MEANS action, reload the page / restart the
      app, confirm Y is still visible. Persistence through the full stack, not
      component state.
- [ ] Execute the step-0 acceptance check verbatim, as a user would, and watch it
      pass.

Then hand off to `verification-before-done` for the full done-proof (build, types,
adjacent flows), and commit following `git-workflow-hygiene`.

## Scope control rules

- **No drive-by refactors inside a feature slice.** Renaming, restructuring, or
  "cleaning up while I'm here" goes in a separate change. Test: if a hunk doesn't
  serve the step-0 story sentence, it doesn't belong in this slice — note it and
  move on.
- **A NEW pattern requires written justification.** Before deviating from the
  analogous feature's structure, write: "The existing pattern in `<file>` doesn't
  fit because <specific reason>; the new pattern is <X>." Can't fill in the
  specific reason → use the existing pattern.
- **If the slice outgrows the story sentence, split it.** The moment you're
  building something the sentence doesn't cover, stop, ship the sentence, start a
  new slice (with its own step 0).

## Common mistakes

- **Starting from the UI and inventing the data contract to fit it.** The mock
  object shaped for the component never matches what storage returns, and the
  rewrite ripples back through every layer. Corrective rule: layers in step-1
  order, no exceptions; the UI consumes a contract that already exists and has
  been exercised.
- **Letting shared types drift from storage.** The column ships but the type file
  doesn't (or vice versa), and the compiler happily approves code that fails at
  runtime. Corrective rule: schema and types change in the same commit; the
  typecheck gate runs before any layer above them is touched.
- **Half-wired state.** The feature works in the session where you built it, but
  isn't reachable from navigation, or vanishes on reload because it lives only in
  component state. Corrective rule: step 6's checklist — entry point, navigation,
  reload survival — is part of the feature, and DONE MEANS includes "after reload".
- **Skipping empty/loading/error states.** Built and tested only against your own
  populated dev data; a new user's first render (empty) or a failed request
  (error) shows a blank screen or a crash. Corrective rule: render all four
  step-5 states on purpose before calling the UI done.
- **Bundling refactors with the feature.** The diff mixes the slice with renames
  and cleanups; review is slow, revert is impossible, and a bug can't be bisected
  to feature vs refactor. Corrective rule: the scope-control test — every hunk
  serves the story sentence, or it's a separate change.
- **Building all layers before verifying any.** Five layers of unverified code
  meet in one big-bang test, and the failure could be anywhere — you're now
  debugging your own guesses across the whole stack. Corrective rule: the two ⛔
  gates are mandatory; never write layer N+1 on an unverified layer N.

## Done criteria

- [ ] Step-0 slice block written: one-sentence story, DONE MEANS with concrete X
      and Y, out-of-scope list.
- [ ] Schema change done via `database-schema-evolution`; types mirror it in the
      same commit.
- [ ] Enumeration sites of changed types found via grep; each updated or
      deliberately skipped (noted).
- [ ] Typecheck passed after schema+types, before any UI work.
- [ ] Data-access layer imitates the named analogous unit; read AND write
      exercised and observed before UI was built; temporary probe calls removed.
- [ ] Backward-compat question answered in writing at every layer (existing rows,
      older clients, mid-session users).
- [ ] UI renders loading, empty, error, and populated states — including rows
      where the new field is absent.
- [ ] Feature reachable via navigation; DONE MEANS action performed verbatim and Y
      observed, including after a reload.
- [ ] No hunk in the diff outside the story sentence; any new pattern has its
      written justification.
- [ ] Handed off to `verification-before-done` for the final proof.
