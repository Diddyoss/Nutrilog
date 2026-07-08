---
name: codebase-orientation
description: "Use when starting work in an unfamiliar or partially familiar codebase, before making any change — building a mental model, finding where a behavior lives, or tracing data flow. Triggers: \"how does this project work\", \"where is X implemented\", \"trace this flow\", first session in a repo."
---

# Codebase Orientation

A procedure for building a working mental model of a repo before changing it.
The core principle: **docs may lie; code doesn't.** README files, comments, and
even CLAUDE.md drift out of date — treat every document as a map to verify
against the territory, and treat the code, the lockfile, and the git history as
the territory. Orientation ends when you can say where your change goes, what
it should imitate, and why — not when you've "read enough".

## When to use / when not to use

Use this skill when:

- It's your first session in a repo, or your first task in an unfamiliar area of one.
- You're asked "how does this project work", "where is X implemented", "trace this flow".
- You're about to make a change and cannot yet name the file it belongs in.

NOT for:

- **Explaining a concrete misbehavior** — use `systematic-debugging`.
  Discriminating test: is there a symptom (an error, wrong output, a stack
  trace) to explain? Yes → debug. No suspected defect, just unfamiliarity → orient.
- **Building a feature in a codebase you already know** — use
  `vertical-feature-implementation`; it starts where this skill ends.
  Discriminating test: can you already pass the ⛔ gate in step 5 below
  (location, analogous file, convention) without looking? Yes → go build.
- **Deciding WHAT to build or in what order** — use
  `prioritization-and-roadmapping`. Discriminating test: is the open question
  "which task should we do?" (that skill) or "where does the code for my task
  live?" (this one)?

## Prerequisites

- The repo is checked out locally. `git log` should return commits; if it
  returns nothing or only one (a shallow clone, or history genuinely starts
  here), skip step 4's history-reading sub-step and rely on file-reading alone
  for conventions — don't stall trying to manufacture history that isn't there.
- You have a stated task, even a rough one ("add an export button"). Orientation
  without a task degenerates into aimless reading — if you truly have no task,
  time-box yourself to steps 1–2 only.

## The procedure

### Step 1 — Read the map, in this order

Read these, in order, skipping only what doesn't exist:

1. **CLAUDE.md** (or equivalent agent docs: `AGENTS.md`, `.cursorrules`,
   `CONTRIBUTING.md`) — this is where project facts live: run commands, env-var
   contract, known caveats. If it exists, it outranks the README.
2. **README.md** — intent, claimed architecture, setup instructions.
3. **Package manifest scripts** — the truth about how the project builds and runs:

   ```bash
   cat package.json        # read "scripts" line by line; also "main"/"module"/"type"
   # non-JS equivalents: pyproject.toml / Makefile / Cargo.toml / go.mod / build.gradle
   ```

4. **Lockfile / toolchain** — what is *actually* installed, at what versions:

   ```bash
   ls package-lock.json pnpm-lock.yaml yarn.lock .nvmrc .tool-versions 2>/dev/null
   grep -m1 '"react"\|"vue"\|"express"' package.json   # confirm the framework the README claims
   ```

5. **Config files** — each one names a subsystem that really exists:
   `vite.config.*` / `next.config.*` / `webpack.config.*` (bundler),
   `tsconfig.json` (path aliases — read `compilerOptions.paths` or imports won't
   make sense), `.eslintrc*`, `docker-compose.yml`, CI files under
   `.github/workflows/`.

Rule: every claim the docs make gets verified in steps 2–3 before you rely on
it. Note contradictions; they are the most valuable finding of step 1.

### Step 2 — Structural survey

Fill in this checklist. Every answer is a path or a literal "none found",
never a guess:

```
ENTRY POINTS:   <how does the app start? e.g. index.html → src/main.tsx; server: src/index.ts app.listen>
ROUTING:        <router lib + route table file — or "no router: navigation is <mechanism>">
CONFIG:         <bundler/tsconfig/env files that shape the code you'll read>
SCHEMA/TYPES:   <where the data shapes live: types.ts, schema.prisma, migrations dir, OpenAPI spec>
ENV CONTRACT:   <every env var the code reads + where documented>
DATA ACCESS:    <the layer that talks to the DB/API: which dir, which client, who's allowed to call it>
```

How to find each, concretely (the commands below assume `src/` and `api/` —
substitute the real source directories that step 1's manifest and configs
revealed; empty output from a wrong path is NOT evidence of "none found"):

```bash
# Entry points: start from the manifest's scripts, then find the boot call
grep -rn "createRoot\|ReactDOM.render\|createApp\|app.listen\|http.createServer" src/ api/ 2>/dev/null | head

# Routing: verify a router EXISTS before assuming one
grep -n "react-router\|@tanstack/router\|vue-router\|next\b" package.json
# No hits → there is no router. The SPA likely switches views on state. Find it:
grep -rn "useState<.*[Pp]age\|currentView\|activeTab\|activePage" src/ | head

# Schema and types: read these FILES, not just their names
ls src/types.ts src/types/ supabase/migrations/ prisma/schema.prisma 2>/dev/null

# Env-var contract: what the code actually reads (compare against docs/.env.example)
grep -rhoE "(process\.env|import\.meta\.env)\.[A-Z_][A-Z0-9_]*" src/ api/ 2>/dev/null | sort -u

# Data access: find the client, then who imports it
grep -rln "createClient\|new PrismaClient\|axios.create\|fetch(" src/ | head
```

Read the schema/types files you found, top to bottom. They are the cheapest
high-density description of the domain the repo has.

### Step 3 — Trace ONE flow end to end

Breadth-first reading has diminishing returns fast. Pick **one** user action —
the one your task will touch, or its nearest neighbor (adding an export button
for logged data? trace how logged data is *displayed*). Follow it through every
layer and write the trace down as file:function steps using exactly this template:

```
FLOW: <one sentence, e.g. "user clicks Save on the entry form">
1. UI event:       <file>:<component/handler> — <what fires>
2. State/logic:    <file>:<function> — <what validates/transforms>
3. Network call:   <file>:<function> — <method + endpoint / query / RPC — or "none: local only">
4. Server handler: <file>:<function> — <or "none: client talks to the backend service directly">
5. Persistence:    <table/collection/file> — <what is written or read>
RETURN PATH:       <how the result reaches the UI: state update, refetch, cache invalidation>
```

To find layer 1, grep for the user-visible string (see Search tactics below),
then follow imports downward. Every arrow in your trace must be a line of code
you have actually read — no "presumably".

⛔ STOP: The template above is completely filled in, with a real file:function
at every step (or an explicit "none" you verified). If any step says
"probably", go read that file now — a half-traced flow is where wrong
assumptions hide.

### Step 4 — Extract the conventions

The repo's history shows you how its authors want code written. Read the **3
most recent substantive commits** — substantive means it changes source logic;
skip lockfile-only, formatting, version-bump, and generated-file commits. If
the repo has fewer than 3 substantive commits (young repo, or you skipped this
per the Prerequisites shallow-clone note), read every substantive commit that
exists, even if that's zero or one — don't block on a count you can't reach:

```bash
git log --oneline --stat -10        # scan; pick 3 substantive ones
git show <sha>                      # read each full diff
```

Then read **2 representative files** adjacent to where your change will land
(siblings in the same directory, or the files from your step-3 trace). Record
what you must imitate:

```
CONVENTIONS OBSERVED:
- Naming:         <e.g. hooks are src/hooks/useX.ts; components PascalCase.tsx>
- Layering:       <e.g. components never import the DB client; they go through hooks>
- Error handling: <e.g. data fns return {data, error}; UI layers show a toast, never throw>
- State:          <e.g. server state via react-query, local via useState; no global store>
```

If a commit contradicts the README, the commit wins — it's newer and it shipped.

### Step 5 — ⛔ STOP gate: earn the right to edit

⛔ STOP: Before writing any code, answer in writing:

(a) **Where does your change go?** — exact file path(s), existing or new.
(b) **Which existing file does something analogous?** — the one you will
    imitate. If nothing does the same *thing* (e.g. no export feature exists
    yet), analogous means the closest structural neighbor: a file in the same
    layer that consumes the same data or hangs off the same UI surface.
(c) **What convention does it follow?** — quote the relevant line from your
    step-4 record.

If you cannot answer all three, you are not done orienting — return to the
step whose output is missing (no location → re-trace in step 3; no analogous
file → survey the directory in step 2; no convention → step 4). Do not start
"exploratory coding" as a substitute for an answer.

## Search tactics: finding things fast

- **Find UI code from what the user sees.** Grep for the visible string,
  quoted exactly as rendered:

  ```bash
  grep -rn --include='*.ts*' --include='*.vue' --include='*.svelte' "Save entry" src/
  ```

  If the hit is in a locale/i18n JSON file, grep next for that entry's *key* —
  the key is what the component references.

- **Find data access from a table or endpoint name.** Take a table name from
  the schema (step 2) or a URL from the browser's Network tab:

  ```bash
  grep -rn "from('entries')" src/          # e.g. a Supabase-style client
  grep -rn "/api/entries" src/ api/        # REST endpoint literal
  grep -rn "SELECT .* FROM entries" src/ api/ -i
  ```

- **Follow imports upward** — you found a function; now find its callers to
  learn how it's meant to be used:

  ```bash
  grep -rn "from '.*useEntries'" src/      # who imports this module?
  grep -rn "\bexportCsv\b" src/            # who calls this symbol?
  ```

- **Find the write path from the read path** (and vice versa): once you know
  the table/endpoint name, one grep gives you every touchpoint — reads,
  writes, and the types that describe them.

## Common mistakes

- **Grepping for symptoms instead of reading structure.** Twenty scattergun
  greps for task keywords produce fragments, not a model; you end up patching
  the first plausible hit. Corrective rule: do steps 1–2 before your first
  task-motivated grep — search from *within* a structure ("data access lives in
  src/lib, so the query is there"), not into the void.
- **Assuming a framework, router, or library that isn't there.** Reflexively
  looking for `routes.tsx`, a Redux store, or an ORM because "SPAs have those"
  wastes time and — worse — leads to adding a dependency the repo deliberately
  avoids. Corrective rule: every "surely they use X" gets one grep of
  `package.json` before you act on it; "none found" is a valid, recordable answer.
- **Skipping the schema and types.** Reading components for an hour while the
  entire domain model sits in one types file or migrations directory you never
  opened. Corrective rule: in step 2, *read* the schema/types files, don't just
  locate them — they are the shortest complete description of the data.
- **Trusting the README over the code.** Setup steps, claimed architecture, and
  feature lists rot. Corrective rule: docs are a map to verify (step 1); when
  README and lockfile/git-history disagree, the code wins, and the
  contradiction goes in your notes.
- **Reading breadth-first forever.** Skimming every directory feels productive
  and builds nothing; understanding comes from following one concrete flow
  through all layers. Corrective rule: after the step-2 checklist is filled,
  stop widening — go depth-first on ONE flow (step 3).
- **Editing during orientation.** "Fixing small things as you read" — renames,
  drive-by refactors, adding your feature scaffold — before the ⛔ gate. You
  don't yet know the conventions you're violating or the callers you're
  breaking. Corrective rule: orientation is read-only; the first edit comes
  after step 5's three answers are written down.

## Done criteria

- [ ] Step-1 map read in the stated order (CLAUDE.md → README → manifest scripts → lockfile/toolchain → configs), with any doc-vs-code contradictions noted.
- [ ] Step-2 survey checklist filled: every line a concrete path or an explicit "none found" — including a verified answer on whether a router exists.
- [ ] Schema/types files read, not just located.
- [ ] One flow traced end to end with the step-3 template, a real file:function at every layer.
- [ ] 3 substantive recent commits and 2 adjacent files read; conventions recorded with the step-4 template.
- [ ] ⛔ gate answered in writing: change location, analogous file, convention to follow.
- [ ] Zero edits made to the repo during orientation.
