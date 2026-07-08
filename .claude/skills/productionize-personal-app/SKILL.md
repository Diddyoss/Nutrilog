---
name: productionize-personal-app
description: "Use when evolving a single-user or hobby app toward real users — real authentication, data migration, operational readiness, abuse and cost protection. Triggers: \"multi-user\", \"let other people use it\", \"real accounts\", \"production-ready\", \"launch\"."
---

# Productionize a Personal App

A procedure for taking an app built for one person (often on anonymous or implicit
auth, with unmetered paid endpoints and no monitoring) to a state where strangers
can use it. The core principle: **users arrive in stages, and each stage has gates
you do not skip.** The two mistakes that cannot be undone later are identity
mistakes (orphaning existing data during an auth migration) and wallet mistakes
(opening unmetered paid endpoints to the internet) — so those gate the ladder.

## When to use / when not to use

Use this skill when:

- The decision to go multi-user / launch is already made and you're executing it:
  "let my friends use it", "add real accounts", "make it production-ready".
- You're auditing launch readiness: "what's missing before other people use this?"
- An anonymous-auth or single-user app needs real sign-in without losing data.

NOT for:

- **Deciding WHETHER or WHEN to productionize** — use
  `prioritization-and-roadmapping`. Discriminating test: is "go multi-user" still a
  question? If you're weighing it against other work, go there; once it's chosen
  and you're executing, stay here.
- **The mechanics of the isolation/secrets audit** — use `security-audit`. Axis 2
  below delegates to it. Discriminating test: this skill decides *that* an
  adversarial re-audit is required and *when* it gates the rollout; that skill
  owns *how* to run it (tokens, adversarial requests, boundary order).
- **Any schema change the migration needs** (new columns, merge tables, policy
  edits) — use `database-schema-evolution`. Discriminating test: are you writing
  SQL/migration files? That's its territory; this skill only tells you what the
  migration must accomplish.
- **Building the rate-limited or quota-enforcing endpoints** — use
  `serverless-api-design`. Discriminating test: are you writing endpoint code?
  This skill sets the requirement ("every paid endpoint metered before Stage 2");
  that skill owns the implementation pattern.

## Prerequisites

- Read the project's CLAUDE.md and any architecture doc for: the current auth
  model (anonymous? magic link? nothing?), the env-var contract, which endpoints
  call paid upstream APIs, and how deploys/migrations happen.
- Know who the next users are (friends you can talk to, or strangers you can't) —
  it determines your target stage.
- **If you lack dashboard/console access** (common for an agent session — check
  CLAUDE.md for whether this applies here): most of this skill's checks — the
  Step 3 migration test script, Axis 4's backup-restore test, setting a spend
  alert, toggling auth settings — genuinely require it. You do not skip these
  gates; you produce the exact thing a human with access needs to execute them:
  a numbered runbook (what to click, in what order, what result confirms
  success), delivered as part of your output. A gate marked "cannot verify,
  human runbook attached" is honest progress; a gate silently skipped is not.

## The procedure

### Step 1 — Locate yourself on the rollout ladder

Users arrive in three stages. Each stage's gates must ALL be true before anyone
from that stage gets access. Do not skip stages: friends forgive and report bugs;
strangers silently leave and attack your wallet.

```
Stage 0 — YOU (current state)
  The app works for its author. No gates; this is the starting point.

Stage 1 — INVITED FRIENDS (people you can message when something breaks)
  Gates — all must be true:
  [ ] Auth linking works: an existing anonymous/implicit user can attach a real
      credential and KEEP their data (Step 3 test script passed with real data).
  [ ] Data isolation re-audited adversarially (axis 2, via security-audit).
  [ ] Error reporting is live: a runtime error in someone else's browser or in a
      serverless function reaches YOU (email/Slack/dashboard you actually check).

Stage 2 — STRANGERS (open signups, people you cannot message)
  Gates — all must be true, in addition to Stage 1's:
  [ ] Rate limits and/or per-user quotas live on EVERY paid/expensive endpoint.
  [ ] Cost budget written down (Step 4 worksheet) and an alarm set at 3× expected.
  [ ] Backups enabled AND restore-tested once (a backup you haven't restored is
      a hope, not a backup).
  [ ] Deletion story exists and has been executed once against a test account.
  [ ] Plain-language privacy note published.
```

⛔ STOP: Identify your current stage and your target stage in writing before
doing anything else. If the target is Stage 2 but Stage 1 gates aren't green,
your target is Stage 1 first. All remaining steps serve the gates of the next
stage only — do not build Stage 2 machinery while Stage 1 gates are red.

### Step 2 — Readiness audit across six axes

Run every checklist. For each unchecked item, write one line: what's missing and
which stage gate it blocks. This list IS the productionization backlog.

**Axis 1 — IDENTITY**

- [ ] Real auth method chosen (email magic link / OAuth). Prefer the auth
  provider you already have (e.g. if the app runs on Supabase, use its auth) —
  custom auth is on the blacklist (Step 5).
- [ ] Anonymous→permanent migration path exists and **LINKS the existing
  identity to the new credential** — e.g. Supabase's `updateUser` /
  `linkIdentity`-style flows attach an email or OAuth identity to the *current*
  session's user. It must NOT call sign-up and create a fresh user: a fresh user
  has a fresh user id, and every existing row is keyed to the old one — all
  existing data is orphaned, starting with your own.
- [ ] The linking flow tested with real data before shipping (Step 3 script).
- [ ] Decided in writing what happens to users who never upgrade (see Step 3).

**Axis 2 — DATA ISOLATION**

- [ ] Row scoping re-audited under an adversarial assumption. "It only ever had
  my rows" proved nothing; now strangers share the database. Delegate the
  mechanics — tokens, cross-user read/write attempts, policy-by-policy checks —
  to `security-audit` and record its findings here.
- [ ] Every table/collection verified to have server-enforced per-user scoping
  (e.g. RLS with both read and write conditions), not client-side filtering.
- [ ] Any endpoint that takes a user id as input re-checked: it must derive the
  user from the session token, never from the request body.

**Axis 3 — ABUSE & COST**

⚠ Stage-gating caveat: the checklist below is written as a Stage 2 gate, but
check this FIRST — if the app's paid endpoints are already deployed and
callable with no auth (the common case for a solo serverless app: the endpoint
went live at Stage 0, before any user existed to gate against), the wallet risk
is not stage-gated at all. It is already live today, reachable by anyone who
finds the URL, independent of whether you've invited a single friend yet.
Confirm this explicitly before treating metering as something Stage 2 can wait
for:

- [ ] Inventory every endpoint that costs money per call (LLM calls, paid APIs,
  metered storage). List them by name with cost per call.
- [ ] For each, check right now whether it is ALREADY unauthenticated and
  publicly reachable (test with an unauthenticated curl from outside the app).
  If yes, its exposure predates this whole rollout and should not wait for the
  Stage 2 gate below — treat it as urgent regardless of current stage.
- [ ] Each one gets rate limiting and/or a per-user quota BEFORE signups open.
  Unmetered paid endpoints + strangers = wallet drain; one `while true; do curl`
  loop is all it takes. Implementation via `serverless-api-design`.
- [ ] Per-user cost budget decided IN WRITING (Step 4 worksheet) — quotas without
  a budget are numbers picked by vibes.
- [ ] Existing per-call caps (e.g. `max_tokens` limits) preserved — they are your
  per-request ceiling; quotas are the per-user ceiling. You need both.

**Axis 4 — RELIABILITY**

- [ ] Error reporting you will actually SEE. `console.log` in a browser you don't
  own is invisible; a hosting dashboard you never open is invisible. Wire client
  and serverless errors to something that reaches you (an error-tracking service,
  or at minimum a serverless log drain + alert). Test it: throw a deliberate
  error from a non-dev device and confirm you got notified.
- [ ] Uptime expectations stated in one sentence ("best effort, may be down for
  hours" is a valid answer — but write it and tell Stage 1 users).
- [ ] Backups enabled on the database AND restore-tested once: restore into a
  scratch project/instance, point a local client at it, verify your own data is
  present and complete. Record the date of the successful restore test. (No
  dashboard access this session → this becomes a human runbook item per
  Prerequisites, not a skipped checkbox.)

**Axis 5 — PRIVACY BASICS**

- [ ] PII inventory: list every column/field holding personal data (emails,
  names, health/behavioral logs, photos, chat transcripts with an AI feature —
  these are all PII).
- [ ] Deletion story written concretely: user asks to delete → what happens?
  Which tables get purged, in what order, by whom, within what time? Include
  auth-provider records and any uploaded files/blobs, not just DB rows. Execute
  it once against a test account before Stage 2.
- [ ] Plain-language privacy note (a paragraph, not a legal document): what you
  store, what third parties see it (e.g. "food photos are sent to an AI provider
  for analysis"), how to get deleted.

**Axis 6 — OPERATIONS**

- [ ] Env-var inventory current: the documented list (CLAUDE.md or equivalent)
  matches what the deployment actually uses. Fix drift now.
- [ ] Key-rotation procedure written: for each secret, where it lives, how to
  mint a new one, where to update it, how to verify the old one is dead.
- [ ] Deploy-from-scratch runbook: a second person (or future-you in 12 months)
  can stand up the whole app — DB schema, env vars, auth settings, hosting —
  using only the written runbook. Test: walk it top to bottom looking for steps
  that live only in your head.

### Step 3 — Auth migration deep-dive (the least reversible change)

The pattern: **link, never re-create.** The existing anonymous user IS the
account; you are attaching a credential to it, not making a new account.

Pitfalls to design for, in writing, before coding:

- **Device-bound identity.** Anonymous identity typically lives in one browser's
  local storage. Clearing site data, or a new phone, silently mints a new
  anonymous user. Linking a real credential is what FREES the data from the
  device — which is the selling point to put in the upgrade prompt.
- **Multiple devices = multiple anonymous users.** The author (and any keen
  early user) may already have two or three anonymous identities with disjoint
  data. Decide the merge policy now: commonly, link the credential to the
  richest identity and write a one-off merge (rekey rows from loser ids to the
  winner id — schema work → `database-schema-evolution`). "We don't merge, the
  other device's data is lost" is a valid policy only if stated before launch.
- **Users who never upgrade.** Anonymous users keep working — decide for how
  long, whether upgrade is ever forced, and whether stale anonymous rows are
  ever purged. Write the answer down; silence here becomes accidental data loss.
- **Email collision.** Linking fails if the email already belongs to another
  account. Decide the UX now (error + "sign in to that account instead?"), don't
  discover it from a Stage 1 friend's bug report.

Migration test script — run against a non-production project/instance with a
copy of REAL data (your own account is the perfect guinea pig). This needs
dashboard/console access to provision the scratch instance — if you don't have
it this session, this script becomes the numbered human runbook (Prerequisites):

```
1. Seed: anonymous user A with real data (N rows across every user-scoped table
   — record N per table and A's user id).
2. Link: run the upgrade flow, attaching an email/OAuth credential to A.
3. Assert same id: the session's user id after linking === A. If it changed,
   the flow created a new user — FAIL, stop here.
4. Assert data: every table still returns exactly N rows for the session. 0 rows
   anywhere = orphaned data — FAIL.
5. Cross-device: sign in with the new credential from a second browser/profile.
   Assert the same N rows are visible there.
6. Collision: attempt to link the SAME email from a fresh anonymous user B.
   Assert a handled error (not a silent second account or a hijack of A).
7. Non-upgrader: create anonymous user C, never link, restart the app. Assert C
   still works exactly as before the auth change shipped.
```

⛔ STOP: Before ANY auth change ships, a written rollback plan for identity data
exists: what you snapshot before deploying (DB backup + auth-provider user
export), how you'd restore it, and how you'd revert the client. Identity
mistakes are the least reversible kind — a bad deploy that splits or orphans
users cannot be fixed by pushing another commit. No rollback plan → do not ship.

### Step 4 — Cost-modeling worksheet (LLM / paid-API features)

Fill this in per paid feature. Numbers may be estimates; write them anyway —
a wrong written number gets corrected, an unwritten one gets discovered on an
invoice.

```
FEATURE:                    <e.g. photo analysis / AI coach turn>
COST PER ACTION:            $<from provider pricing × your max_tokens / call size>
ACTIONS / ACTIVE USER / DAY: <honest estimate — check your own usage history>
EXPECTED ACTIVE USERS:       <at the target stage>
DAILY BURN = cost × actions × users = $<X>/day  →  $<30X>/month
PER-USER DAILY QUOTA:        <ceiling that caps a hostile user, e.g. 3–5× your
                             own heaviest real day — enforce it in the endpoint>
ALARM THRESHOLD:             3 × expected daily burn
```

The rule: **alarm at 3× expected.** Set the spend alert in the provider's
dashboard at 3× the computed daily (or monthly) burn. Under 3× is noise from
normal variance; if 3× fires, someone is abusing an endpoint or your model is
wrong — either way you want to know that day, not at invoice time. If the
provider has no alerting, a scheduled check of your own usage log against the
threshold counts; "I'll notice on the bill" does not.

### Step 5 — The over-engineering blacklist

Explicitly NOT yet, no matter how production-flavored they feel:

- Kubernetes, or containers for their own sake (your host's build+deploy is fine)
- Microservices (you have one app and, at most, a handful of functions)
- Multi-region / global replication
- Custom auth (password hashing, session stores — your provider does this)
- Event sourcing / CQRS
- A rewrite ("we should really rebuild this properly before launch")

The test, applied to any infrastructure urge: **does the next 10× of users
actually require it?** Going from 1 user to 10 friends requires none of the
above; 10 to 100 still doesn't. If the honest answer is no, it's procrastination
dressed as rigor — the gates in Step 1 are the real work, and they are less fun.

## Common mistakes

- **Adding real auth without a migration path for existing anonymous data.** The
  sign-up flow creates a fresh user; the founder's own months of history is
  orphaned under an id nothing references. Corrective rule: link the credential
  to the existing identity (Axis 1), and run the Step 3 test script — assertion
  3 ("same user id after linking") catches this in minutes.
- **Opening signups with unmetered paid endpoints.** The LLM endpoint that cost
  cents under one user is now a public faucet wired to your card. Corrective
  rule: Stage 2 gate — rate limits/quotas on every paid endpoint, plus the 3×
  alarm, BEFORE the signup link goes out. Not the same week; before.
- **Backups enabled but never restore-tested.** The checkbox is on, and the
  first real restore attempt discovers the backup is partial, unreadable, or
  missing the auth records. Corrective rule: a backup you haven't restored is a
  hope — restore into a scratch instance once and record the date (Axis 4).
- **No error reporting, so the first users' failures are invisible.** Friends
  hit a bug, see a blank screen, quietly stop using the app; you conclude they
  weren't interested. Corrective rule: Stage 1 gate — errors from browsers and
  functions you don't own must reach you, verified by throwing a deliberate
  error from a non-dev device.
- **Building scale infrastructure before the first stranger arrives.** Two weeks
  on containers and a queue while auth linking is unbuilt and endpoints are
  unmetered. Corrective rule: apply the Step 5 test (does the next 10× require
  it?); if a Step 1 gate is red, that gate outranks all infrastructure.
- **Treating the rollout ladder as optional and jumping to Stage 2.** Posting
  the public link the day auth ships, with no quotas, no backup test, no
  deletion story. Corrective rule: gates are conjunctive and staged — Stage 2
  access only after every Stage 1 AND Stage 2 checkbox is verifiably green.

## Done criteria

- [ ] Current and target stage identified in writing; all work mapped to a
      specific gate of the next stage.
- [ ] All six audit axes run; every unchecked item recorded with the gate it blocks.
- [ ] Auth migration uses identity linking (same user id before/after), and the
      Step 3 test script passed against real data — all 7 assertions.
- [ ] Written rollback plan for identity data existed BEFORE any auth change shipped.
- [ ] Merge policy for multiple anonymous identities and fate of never-upgraders
      decided in writing.
- [ ] Cost worksheet filled in for every paid feature; quotas enforced in the
      endpoints; spend alarm set at 3× expected burn.
- [ ] Isolation re-audit completed via `security-audit` with findings resolved.
- [ ] Error reporting verified end-to-end from a non-dev device.
- [ ] Backup restore-tested once, date recorded.
- [ ] Deletion story written and executed once against a test account; privacy
      note published.
- [ ] Env-var inventory, key-rotation procedure, and deploy-from-scratch runbook
      current.
- [ ] Nothing from the over-engineering blacklist was built; any exception has a
      written "the next 10× requires it" justification.
