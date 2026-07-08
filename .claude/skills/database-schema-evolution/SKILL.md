---
name: database-schema-evolution
description: "Use when changing database schema: adding tables or columns, writing migrations, altering RLS policies, or keeping schema files, migrations, and application types in sync. Triggers: \"add a column\", \"write a migration\", \"new table\", \"RLS policy\", schema-cache or missing-column errors."
---

# Database Schema Evolution

Schema changes fail in production not because the SQL is wrong but because the SQL,
the canonical schema file, and the application code stop agreeing — or because the
migration lands on the database after (or never before) the code that needs it.
Core principle: **a schema change is one atomic unit of three artifacts plus a
degradation plan for the window when the database hasn't caught up.**

## When to use / when not to use

Use this skill when:

- Adding, renaming, or dropping a table, column, index, or constraint.
- Writing or reviewing a migration file.
- Adding or changing Row-Level-Security (RLS) policies.
- Diagnosing "missing column", "relation does not exist", or "schema cache" errors
  (in PostgREST/Supabase-style stacks: `PGRST204`, `PGRST205`, `42P01`).
- Deciding what happens to existing rows when a column is added.

NOT for:

- Building the whole feature around the schema change — use
  `vertical-feature-implementation`; it delegates the schema step here.
  Discriminating test: if you're also writing UI or business logic, that skill owns the slice.
- General bug investigation — use `systematic-debugging`. Test: if you don't yet
  know the bug is schema drift, debug first; route here once the error is a
  missing column/table or schema-cache mismatch.
- Auditing the security posture of *existing* policies, secrets, or grants — use
  `security-audit`. Test: this skill makes a *new* table secure at design time;
  reviewing what's already deployed is an audit.
- Commit mechanics (branching, message format, splitting) — use
  `git-workflow-hygiene`. This skill only dictates *what* goes in one commit.

## Prerequisites

Read the project's CLAUDE.md and answer these four questions before writing SQL.
⛔ STOP: if CLAUDE.md doesn't answer one of them, ask the user or read the repo to
find out — do not guess.

1. **Which file is the canonical full-schema snapshot?** (Often something like
   `db/schema.sql` or `supabase/schema.sql`. Some projects have none — then
   migrations alone are canonical.)
2. **How do migrations get applied?** A runner/CLI on deploy, or a human pasting
   SQL into a dashboard SQL editor? This changes the deliverable (see §Hand-applied).
3. **What is the migration numbering history?** Sequences often have gaps or a
   baseline that was never a migration file. The next number is
   `max(existing numbers) + 1` — never reuse or fill a gap, even if CLAUDE.md says
   001 never existed.
4. **Does the project use RLS?** (Supabase/Postgres multi-tenant apps usually do.)
   If yes, every new table needs the RLS block in §RLS checklist.

## The procedure

### 1. Design the change

Answer in writing before any SQL:

- What happens to **existing rows**?
  ```
  Adding a column to a populated table?
  ├─ Column can have a sensible constant default → add with `default <value>`
  ├─ Value must be computed per row → add nullable, backfill with UPDATE,
  │    then (optionally, later migration) set NOT NULL
  └─ No meaningful value for old rows → add nullable; make app code handle null
  ```
- Never `ADD COLUMN <col> <type> NOT NULL` without a default on a populated table —
  it fails outright. And beware volatile defaults (`now()`, `gen_random_uuid()`)
  on huge tables: on older Postgres they rewrite the whole table under an
  exclusive lock. Constant defaults are metadata-only on Postgres 11+.
- What is the **access pattern**? An index is needed only for columns that queries
  will filter or sort on. New per-user tables almost always need
  `(user_id, <date-or-lookup-col>)`; a new column that is merely stored and
  displayed needs none.

### 2. Write the migration file

Rules — all mandatory:

1. **One concern per migration.** "Add notes column" and "create audit table" are
   two files. Discriminating test: could someone want to apply one without the other?
2. **Sequential numbering.** Next number = highest existing + 1 (see Prerequisites §3).
3. **Header comment** stating what it does and exactly how/where it gets applied,
   e.g.:
   ```sql
   -- Migration 005 — add notes to <table>
   -- Run in <dashboard> → SQL Editor → New Query → Run. Safe to re-run.
   ```
   (Copy the apply instruction from the project's CLAUDE.md, not from this skill.)
4. **Idempotent.** The file must be safe to run twice:
   ```sql
   create table if not exists public.<table> ( ... );
   alter table public.<table> add column if not exists <col> <type> default <val>;
   create index if not exists <table>_user_date_idx on public.<table> (user_id, <col>);
   ```
   Policies have no `if not exists` in older Postgres; use the drop-then-create pair:
   ```sql
   drop policy if exists "<policy name>" on public.<table>;
   create policy "<policy name>" on public.<table> ...;
   ```
5. Fully qualify objects (`public.<table>`) so the search path can't surprise you.

⛔ STOP — dry-read gate: before treating the migration as done, read it line by
line against the **current** canonical schema (or the live DB) and confirm every
referenced object exists: the table you ALTER, the columns your index covers, the
function your default calls (`auth.uid()` exists only in Supabase-style stacks),
the table your FK points at. If anything is missing, fix the migration or add the
missing prerequisite as its own earlier concern — do not proceed on hope.

### 3. RLS checklist (every new table, when the project uses RLS)

All four items, no exceptions:

- [ ] **Owner column with server-side default** so the client never supplies it:
  ```sql
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade
  ```
- [ ] **Enable RLS:**
  ```sql
  alter table public.<table> enable row level security;
  ```
- [ ] **Owner policy with BOTH `using` AND `with check`:**
  ```sql
  create policy "Users manage own <table> rows" on public.<table>
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  ```
  `using` filters reads/updates/deletes; `with check` validates inserts and the
  new values of updates. Omit `with check` and inserts fail (or worse, on
  permissive setups, allow spoofed rows).
- [ ] **Index matching the access pattern**, e.g.
  `create index if not exists <table>_user_date_idx on public.<table> (user_id, log_date);`

Failure mode to memorize: **a table with RLS enabled but no policy is invisible to
the app, not open.** Every query returns zero rows (or a write error) with no
"permission denied" hint. If a new table "returns nothing", check policies first.

### 4. Update all three artifacts — one commit

The three artifacts that move together, in ONE commit (mechanics per
`git-workflow-hygiene`):

- [ ] The **migration file** (step 2).
- [ ] The **canonical full-schema snapshot** (if the project keeps one — see
  Prerequisites §1). Apply the same change there so a fresh environment created
  from the snapshot matches an old environment plus the migration.
- [ ] The **application-level types/models**: TypeScript interfaces / ORM models /
  serializers, AND every place the app *enumerates* columns — type unions,
  "known fields" arrays, strip-lists used for degradation (§5), coercion/mapping
  tables, form field lists. Grep for a sibling column's name to find them all:
  ```bash
  grep -rn "<existing_sibling_column>" src/ | grep -v node_modules
  ```

⛔ STOP — replay gate: verify that `old snapshot + new migration` and the
`new snapshot` describe the same end state. Concretely: apply the migration to a
scratch database created from the old snapshot, dump it, and diff against a dump
of a database created from the new snapshot (e.g. with `pg_dump --schema-only`
against local/ephemeral Postgres). No local Postgres? Then diff by hand: for each
statement in the migration, point to the exact line in the snapshot that now
reflects it, and confirm no snapshot edit lacks a migration statement. Any
mismatch = the snapshot has drifted; fix before commit.

### 5. Backward compatibility: the not-yet-migrated window

Deployed clients can hit a database where the migration hasn't run yet — deploys
are instant, migrations (especially hand-applied ones) are not. The write path
must never crash on this. Portable pattern, at the data layer:

1. **Detect** the schema-mismatch error. In PostgREST-style stacks:
   `PGRST204` / "Could not find the '<col>' column … in the schema cache" =
   missing column; `42P01` / `PGRST205` = missing table. In other stacks, match
   the driver's undefined-column/undefined-table error codes.
2. **Retry degraded**: strip the new fields from the payload and retry the write
   (keep a single strip-list of new-since-migration-N fields — and register new
   columns in it), or disable the feature that needs the new table.
3. **Surface a "migration needed" notice** (toast/log) so a human applies it.
4. Never let the raw error reach the user as a crash on the write path.

Sketch:

```ts
if (isMissingColumnError(error)) {
  ({ error } = await insert(stripNewFields(row)));  // degraded but successful
  notifyMigrationNeeded();
}
```

Remove the shim only once CLAUDE.md says all environments are migrated.

### 6. Hand-applied migrations: the human-steps template

If migrations are applied by a human pasting SQL into a dashboard SQL editor (no
runner — check CLAUDE.md), two extra obligations:

1. The migration must be **safe to re-run** (already required by step 2.4 — humans
   double-paste, lose track, and re-run "just in case").
2. The change description / PR body must END with explicit numbered human steps.
   Exact template — fill the brackets, keep the numbering:

   ```markdown
   ## Manual step required — apply migration <NNN>

   1. Open <dashboard> → SQL Editor → New Query.
   2. Paste the full contents of `<path/to/migrations/NNN_name.sql>`.
   3. Click Run. Expect "Success" (re-running is safe).
   4. Verify: run `select <new_column> from public.<table> limit 1;`
      (or `select count(*) from public.<new_table>;`) — no error means applied.
   5. Confirm the app's "migration needed" notice no longer appears.
   ```

## Common mistakes

- **Editing an already-applied migration** to fix or extend it. Applied SQL is
  history; environments that ran the old version will silently diverge. Rule:
  once a migration may have been applied anywhere, changes go in a NEW migration.
- **Policy with `using` but no `with check`.** Reads work in testing, then inserts
  fail in production (or spoofed `user_id` writes slip through). Rule: owner
  policies always carry both clauses (§3).
- **`ADD COLUMN ... NOT NULL` without default on a populated table.** Fails
  immediately. Rule: default, or nullable-then-backfill-then-constrain (§1).
- **Volatile default on a huge table** (`default now()` etc.) rewriting the table
  under an exclusive lock. Rule: on big tables add nullable + backfill in batches;
  constant defaults are safe on Postgres 11+.
- **Forgetting the app's column enumerations.** The types compile, but the new
  column is dropped by a strip-list, missing from a coercion map, or absent from a
  totals loop. Rule: run the sibling-column grep in §4 and update every hit.
- **Letting the canonical schema file drift from migrations.** Fresh environments
  then differ from migrated ones and the dry-read gate lies to the next author.
  Rule: the replay gate in §4 is mandatory, not optional.
- **Trusting the client to send `user_id`.** Works until someone forges a request.
  Rule: server-side default (`default auth.uid()` or equivalent) plus `with check`.

## Done criteria

- [ ] Migration file exists with the next sequential number, one concern, an
      apply-instructions header, and is idempotent (re-run-safe).
- [ ] Dry-read gate passed: every object the migration references exists in the
      current schema.
- [ ] Canonical schema snapshot updated (if the project keeps one) and the replay
      gate passed: old snapshot + migration ≡ new snapshot.
- [ ] Application types/models updated, and every column-enumeration site found by
      the sibling-column grep updated (unions, strip-lists, coercion maps).
- [ ] New tables: RLS enabled, owner policy with `using` AND `with check`,
      server-side-defaulted owner column, access-pattern index — all four.
- [ ] Write path handles the not-yet-migrated database: detects missing
      column/table errors, retries stripped or degrades, surfaces a notice.
- [ ] "What happens to existing rows?" answered in the PR description (default /
      backfill / nullable).
- [ ] If hand-applied: PR body ends with the numbered human-steps template.
- [ ] All three artifacts in ONE commit (per `git-workflow-hygiene`).
