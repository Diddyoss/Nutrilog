---
name: prioritization-and-roadmapping
description: "Use when deciding what to build next, triaging a backlog, or judging whether a proposed feature is worth building. Triggers: \"what should I work on\", \"is X worth doing\", \"plan the next milestone\", roadmap discussions."
---

# Prioritization and Roadmapping

A procedure for deciding what to build next — and, just as deliberately, what not
to build. The core principle: **every feature is a liability you service
forever.** Cost is build cost plus maintenance forever; value is usage frequency
times pain relieved; and nothing goes on the roadmap without kill criteria
stated up front. A roadmap that contains only things-to-do has decided nothing —
the NOT-DOING list is its spine.

## When to use / when not to use

Use this skill when:

- Someone asks "what should I work on next?" or "plan the next milestone".
- A feature is proposed and the question is whether it's worth building at all.
- A backlog has grown past what fits in one sitting and needs triage.
- Tech debt, infrastructure, and features are competing for the same time.

NOT for:

- **Executing the multi-user / launch track once it's chosen** — use
  `productionize-personal-app`. Discriminating test: has "go multi-user" already
  been decided? If you're deciding WHETHER or WHEN, stay here; if you're deciding
  HOW, go there.
- **Building the feature that won** — use `vertical-feature-implementation`.
  Discriminating test: is the "what" settled and the remaining question is
  implementation order and slicing? Then it's that skill's job.
- **Ordering today's bugfixes** — that isn't roadmapping. Fix the reproducible
  one first and follow `systematic-debugging`. Discriminating test: is the time
  horizon a day and the candidates all defects? No rubric needed.

## Prerequisites

- The candidate list: every item under consideration, written down (features,
  fixes, infra, and deletions — removing a feature is a first-class candidate).
- Whatever usage evidence exists: analytics, logs, or honest recall of what you
  actually used this week. Check the project's CLAUDE.md / docs for the
  project's actual roadmap tracks and any goals already committed to.

## The procedure

### Step 1 — Write every candidate down, including deletions

List all candidates in one place. Add any feature that shipped but isn't being
used as a **deletion candidate** — deleting is also a feature: it refunds
maintenance cost forever. Time-box this survey to what you already know or can
find in under 10 minutes (usage logs if they exist, or your own honest recall)
— it's a prompt to include obvious deletions, not a separate audit project.
Three to eight candidates is the useful range; with fewer than three, you're
not prioritizing, you're rationalizing.

### Step 2 — Apply the senior cost/value framing to each

For each candidate, fill in — in writing, not in your head:

```
CANDIDATE: <name>
VALUE  = usage frequency × pain relieved
         <who uses it, how often, what hurts today without it — cite evidence, not hope>
COST   = build cost + MAINTENANCE FOREVER
         <build estimate> + <what you service forever: deps that break, APIs that
         change, security surface, support questions, code others must read around>
KILL CRITERIA: <observable condition that removes it, e.g.
         "if not used weekly within a month of shipping, remove it">
```

No evidence of usage means frequency scores as low, not unknown. "Users would
probably love it" is hope; "I hit this three times this week" is evidence.

⛔ STOP: Every candidate has kill criteria written before you rank anything. A
candidate you can't state kill criteria for is a candidate you haven't thought
about — go back and write them, or strike the item.

### Step 3 — Assign each candidate a track

For a personal project with ambitions, every candidate is one of:

- **Track A — polish/reliability** (compounding daily value): bug debt, UX
  friction in flows used daily, insights extracted from existing data. Pays out
  every single day the app is used.
- **Track B — growth/productionization** (option value): auth, scale, multi-user,
  launch readiness. Pays out only if and when the ambition is exercised.

The project's actual track contents live in the project's CLAUDE.md / docs —
consult them; don't reinvent the split.

Interleaving rules (pre-made judgment — apply literally):

1. Reliability debt that bites weekly outranks speculative scale work. Always.
2. Do NOT start a Track B item while Track A lacks the safety net (tests/CI)
   that de-risks it. Auth on top of an untested codebase multiplies risk instead
   of adding value.

### Step 4 — Score every candidate with the rubric, in writing

Score each candidate 1–5 on six dimensions. **5 is always the priority-friendly
end.** Sum for a rank (max 30). The numbers must be visible and challengeable —
scoring in your head defeats the point.

| Dimension | Question | 5 means | 1 means |
|---|---|---|---|
| Reach | How often will this actually be used? | Every session, by real current users | Rarely, or by hypothetical users |
| Effort | Build cost? | Under half a day | Weeks |
| Maintenance | Forever cost? | Ships and sits still | Permanent operational/security surface |
| Risk | What breaks if it's wrong? | Cosmetic annoyance | Data loss or security exposure |
| Reversibility | Can it be removed cleanly? | Delete a file | Data formats and users entrenched |
| Learning | Does it unlock/inform other decisions? | Its outcome decides several roadmap items | Teaches nothing |

A low Risk score doesn't veto an item — it demands mitigation before you touch
it (a test harness, a flag, a backup), which feeds step 5. Ties: prefer the
Track A item; still tied, prefer higher Reversibility.

**Worked example.** Personal app with a handful of daily users, no tests.
Candidates: add social sharing, fix flaky data sync (occasionally drops
entries), start multi-user auth.

```
                    Reach Effort Maint Risk Revers Learn  TOTAL  Track
Fix flaky sync        5     3     5     2     4     3      22     A
Social sharing        1     3     2     4     4     2      16     A/B
Multi-user auth       1     1     1     1     1     4       9     B
```

- Sync fix: Reach 5 — every session touches sync; Maintenance 5 — fixing it
  *reduces* forever-cost; Risk 2 — sync is data-critical, so getting the fix
  wrong loses data → mitigation required (see step 5).
  Kill criteria: "if sync errors aren't at zero two weeks after the fix,
  escalate to a redesign of the sync layer."
- Social sharing: Reach 1 — no user has asked; Maintenance 2 — platform APIs
  and image rendering rot. Kill criteria would be "used weekly within a month"
  — but it doesn't make the cut, so it goes to NOT-DOING.
- Auth: Reach 1 today (single user), Maintenance 1 (permanent security
  surface), and blocked by interleaving rule 2 — no test safety net exists.

The rubric discriminates: 22 vs 16 vs 9. The boring fix wins, visibly.

### Step 5 — Sequence infrastructure by the risk of the NEXT change

Tests, CI, and tooling are never prioritized in the abstract. They are
prioritized by the risk of the next planned change:

- "We're about to touch billing/sync/auth" → a harness around that area is
  justified NOW, sized to that change.
- "Coverage should be higher" → not a reason. Strike it.

In the worked example: the sync fix scored Risk 2, so a minimal test harness
around sync (only sync) slots in immediately before it. The harness is
justified by the fix, not by virtue — follow `test-harness-bootstrap` to decide
exactly what to test first within that scope; this skill only decided THAT a
harness is justified now and WHERE it's scoped, not how to build it.

### Step 6 — Triage tech debt with the decision tree

For every debt item in the candidate list:

```
Does it bite weekly (you or a user actually hits it)?
├─ Yes → fix now: schedule it in the NEXT-3 like any feature.
└─ No  → Does it bite only when touching area X?
         ├─ Yes → fix when next touching X. Write that down on the item
         │        ("fix when next touching <X>") and park it — do not schedule it.
         └─ No (purely aesthetic, "not how I'd write it today")
              → don't fix it. Delete the ticket. Untracked is the correct state.
```

### Step 7 — ⛔ STOP gate before answering any "should we build X"

⛔ STOP: Before giving ANY verdict on "should we build X", you must have
written answers to both:

1. **"What would we NOT do because of this?"** — name the specific items X
   displaces. If nothing gets displaced, you haven't costed it: time is the
   budget, and X spends it.
2. **"Who maintains it in a year?"** — a named person/agent and the honest
   forever-cost from step 2. "Nobody, it'll just work" is not an answer.

If either answer is missing, do not answer the question — go back and produce it.

### Step 8 — Emit the decision in the exact output format

```
ROADMAP DECISION — <date>

NEXT (in order, UP TO 3 — see note below):
1. <item> — <one line citing rubric: "Reach 5/Maint 5, Track A, total 22">.
   Kill criteria: <condition → action>.
2. <item> — <rubric one-liner>. Kill criteria: <condition → action>.
3. <item> — <rubric one-liner>. Kill criteria: <condition → action>.

NOT DOING (this is the decision):
- <item> — <one-line reason, e.g. "Reach 1, no user has asked; revisit if two users request it">
- <item> — <one-line reason>

ASSUMPTIONS TO REVISIT:
- <assumption> — revisit when <trigger: date, metric, or event>
```

**"NEXT" is a ceiling, not a quota — never pad it.** If the rubric legitimately
clears fewer than 3 candidates this cycle (a thin roadmap is an honest output,
not a failure), list only those and say so explicitly: "only N candidate(s)
cleared the bar this cycle." Do not promote a low-scoring item just to fill
three slots — that silently contradicts the scoring you just did. If MORE than
3 candidates score close together, list the top 3 and note the next-highest in
ASSUMPTIONS TO REVISIT with "reconsider next cycle" as the trigger, rather than
expanding the list past 3 (a long NEXT list stops being an ordered commitment).

An empty NOT-DOING list means nothing was decided — every candidate that was
scored and didn't make NEXT appears there with its reason. Kill criteria
travel with each NEXT item so the future reviewer doesn't have to reconstruct
intent.

## Common mistakes

- **Novelty bias.** Picking the new feature over boring reliability that's used
  daily — the sync fix beat social sharing 22 to 16 for a reason. Corrective
  rule: Reach scores on evidence of current use; novelty contributes nothing to
  any column.
- **Resume-driven architecture.** Adopting a queue, a framework, or a
  microservice because it's interesting or looks good, not because a scored
  candidate needs it. Corrective rule: technology choices must trace to a
  NEXT-3 item; if the item disappears, the tech goes with it.
- **Treating all tech debt as equally urgent.** "The codebase is a mess" is not
  a schedulable item. Corrective rule: run every debt item through the step-6
  tree; only weekly-bite debt gets scheduled, and aesthetic tickets get deleted.
- **Roadmaps with no kill criteria.** Features accrete forever because nothing
  defines when one has failed. Corrective rule: the step-2 gate — no kill
  criteria, no ranking. And honor them: a feature past its kill condition
  becomes a deletion candidate in the next cycle.
- **Scoring in your head.** "I considered the tradeoffs" without a visible
  table is not scoring — the rubric only works when the numbers can be seen and
  challenged. Corrective rule: the step-4 table exists in writing for every
  decision, even a solo one.
- **Confusing "hard to build" with "valuable".** Weeks of effort feel important;
  effort is a cost column, not a value column. Corrective rule: value comes
  only from Reach × pain relieved (step 2); a hard build with Reach 1 is a 1.
- **Answering "should we build X" in isolation.** A yes with no displaced items
  is a yes to everything. Corrective rule: the step-7 gate — no verdict without
  the opportunity-cost and who-maintains-it answers in writing.

## Done criteria

- [ ] Every candidate written down, deletion candidates included.
- [ ] Every candidate has VALUE, COST (build + maintenance forever), and kill criteria in writing.
- [ ] Every candidate assigned Track A or Track B; interleaving rules checked (no Track B item scheduled while its Track A safety net is missing).
- [ ] Rubric table filled in with visible 1–5 scores for all six dimensions, all candidates.
- [ ] Any infrastructure item on the list is justified by a named next change, not by abstract quality.
- [ ] Every debt item routed through the step-6 tree; aesthetic tickets deleted.
- [ ] Step-7 gate passed: opportunity cost and year-out maintainer written down before any build/no-build verdict.
- [ ] Output emitted in the step-8 template: NEXT list (up to 3, padded to neither more nor fewer than what legitimately cleared the bar) with rubric citations and kill criteria, a non-empty NOT-DOING list, and assumptions with revisit triggers.
