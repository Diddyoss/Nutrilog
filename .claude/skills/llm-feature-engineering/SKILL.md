---
name: llm-feature-engineering
description: "Use when building or tuning features backed by an LLM — prompt design, structured output, model selection, fallbacks, cost control. Triggers: \"AI feature\", \"the model returns garbage\", \"prompt\", \"switch models\", \"structured output\", \"reduce LLM cost\"."
---

# LLM Feature Engineering

A procedure for building product features that call an LLM and survive contact with
real model output. The core principle: **the model is an unreliable external service
that returns plausible-looking text — design the contract first, then defend every
layer between its output and your data.** The prompt serves the contract, never the
other way around. A model WILL eventually return fenced JSON, truncated JSON, prose,
nulls, and numbers-as-strings — no prompt wording prevents this, only your code does.

## When to use / when not to use

Use this skill when:

- Adding a feature where an LLM produces data your code consumes ("photo → structured JSON", "summarize into fields", classification, extraction).
- Adding a conversational/chat feature backed by an LLM.
- The model "returns garbage": markdown-fenced JSON, wrong types, empty replies, refusals.
- Switching or adding models, adding a fallback, or cutting LLM cost/latency.

NOT for:

- **The HTTP shell around the call** — method guards, env-var checks, request-size caps, the endpoint's error taxonomy as seen by clients. That is `serverless-api-design`. Discriminating test: would the problem exist if the handler called a deterministic function instead of a model? Yes → that skill. This skill owns everything from "build the messages array" to "trusted, typed data".
- **Generic bug hunting** — use `systematic-debugging` to locate WHICH layer fails. Discriminating test: do you already know the misbehavior is model output or prompt behavior? Yes → here. No → debug first, come back once the failing layer is the LLM call.
- **Deciding whether to build the AI feature at all** — scope/value tradeoffs belong to `prioritization-and-roadmapping`. Discriminating test: is the question "should we?" rather than "how?"

## Prerequisites

- A provider API key in the environment, server-side only (never shipped to the client).
- The project's CLAUDE.md for: which provider/gateway is used, current model IDs and
  their env-var names, and where token usage is logged. Model facts live there, not here.

## The procedure

### Step 1 — Write the contract before any prompt

Fill this in first. Every later step is checked against it:

```
OUTPUT SCHEMA:    <exact JSON shape with types, e.g.
                  { "title": string, "priority": "high"|"medium"|"low", "tags": string[] }>
FAILURE BEHAVIOR: <what the user sees when the model fails or returns junk —
                  e.g. "toast: 'Could not classify — try again', item stays in the untagged queue">
BUDGET:           <max latency (e.g. p95 < 6s), max output tokens, max cost per call>
```

⛔ STOP: If you cannot state what the user sees on model failure, do not write the
prompt yet. "It won't fail" is not a failure behavior. Decide: retry silently,
degrade to manual input, or show an error — and which HTTP status distinguishes
"model returned junk" from "our server broke" (see step 3, rung 4).

### Step 2 — Construct the prompt

**System prompt = role + rules + output format. Keep it stable** — a constant in
code, not assembled per request. Per-request data goes in the user message.

```
You are a <domain> expert. <task>. Return ONLY a raw JSON object — no markdown,
no code fences, no explanation. Structure:
{
  "field_name": "example value",
  "count": 42,
  "confidence": "high | medium | low"
}
Rules: <domain rules>. Numbers are integers. Never return null; use 0 if unknown.
Keep the "note" field under 20 words.
```

- Show the schema **inline with example values**, not as abstract prose. Models copy shapes.
- **Enriched-message pattern:** assemble per-request context programmatically from
  real data and embed it in ONE user message. The model cannot fetch anything —
  interpolate the user's actual numbers/state yourself:

  ```ts
  const enrichedMessage = `Account: ${account.plan} plan | ${account.seatsUsed}/${account.seatLimit} seats used
  This period: ${usage.callsMade} calls made, ${remaining} remaining
  Recent items: ${itemsText}

  User message: ${userMessage}`;
  ```

- **State length budgets in the prompt AND enforce them with `max_tokens`.** "Keep
  responses under 180 words" is a request; `max_tokens: 400` is a guarantee. Always both.
- **Cap resent conversation history** for chat features — last N messages (N≈8),
  filtered to valid `{role, content}` pairs — or every turn resends the whole chat
  and cost grows unboundedly:

  ```ts
  const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
  ```

- If two endpoints must agree on a rule (same schema, same tone), extract the shared
  text into one constant both import. Duplicated prompt rules drift apart silently.

### Step 3 — Harden structured output: the ladder

Climb every rung. Each one catches failures the previous rung lets through. If the
provider offers native structured output / JSON mode / tool-calling, use it — and
**still climb the ladder**; native modes reduce junk, they don't eliminate truncation,
refusals, or wrong types.

**Rung 1 — Demand raw JSON in-prompt.** The exact phrase "return ONLY a raw JSON
object — no markdown, no code fences, no explanation", plus the inline schema with
example values (step 2).

**Rung 2 — Strip code fences defensively anyway.** Models fence output despite rung 1,
intermittently — often only on certain inputs:

```ts
const cleaned = text.replace(/```json|```/g, '').trim();
```

**Rung 3 — Parse inside try/catch.** `JSON.parse` on model output throws routinely
(truncated output when `max_tokens` was too low, prose-wrapped JSON, refusal text).

**Rung 4 — On parse failure, return a DISTINCT status with the raw text attached.**
Not a generic 500. A dedicated status (e.g. 422) with the raw model text lets the
client trigger the contract's failure behavior and lets YOU see what the model
actually said when debugging:

```ts
try {
  const parsed = JSON.parse(cleaned);
  return res.status(200).json(parsed);
} catch {
  return res.status(422).json({ error: 'Could not parse AI response', raw: text });
}
```

**Rung 5 — Coerce EVERY field on the consumer side.** Successful parsing proves it
was JSON, not that the types are right. Models emit `"count": "350"`, `null`,
or omit fields entirely — even when the prompt forbids it. Never trust:

```ts
function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const result = {
  title: String(data.title ?? 'Untitled'),
  count: toNum(data.count) ?? 0,                   // numbers: coerce, default
  priority: ['high', 'medium', 'low'].includes(data.priority)
    ? data.priority : undefined,                   // enums: whitelist inclusion check
  note: typeof data.note === 'string' ? data.note : undefined, // strings: typeof
};
```

Numbers via a `toNum`-style helper, enums via whitelist `.includes()`, strings via
`typeof`. Every field, no exceptions.

⛔ STOP: Before shipping, feed the parser deliberately-malformed "model output" and
confirm the user-visible result matches the step-1 failure behavior. Minimum set:
(a) fenced: `` ```json\n{...}\n``` ``, (b) truncated: `{"name": "x", "cal`,
(c) prose-wrapped: `Sure! Here's the JSON: {...}`. If any of these produces a
generic 500 or a crash instead of the contracted behavior, fix the ladder first.

### Step 4 — Select the model, wire the fallback

Select per task, not globally:

```
Does the task include images/audio?
├─ Yes → vision/multimodal-capable model required (this constrains the shortlist first)
└─ No  → Is the user waiting synchronously?
         ├─ Yes → prefer low-latency ("flash"/"mini"-tier); quality tier only if
         │        output quality measurably fails the golden set (step 6)
         └─ No  → batch/async: optimize cost per token
```

- **Model IDs env-overridable with sane defaults.** Models get renamed and
  deprecated constantly; swapping must not need a code change:

  ```ts
  const PRIMARY_MODEL = process.env.FEATURE_MODEL || '<sane-default-id>';
  const FALLBACK_MODEL = process.env.FEATURE_FALLBACK_MODEL || '<different-family-id>';
  ```

- **Fallback = a DIFFERENT provider/family.** Same-family fallbacks fail together
  (shared outage, shared content-policy refusal, shared quota). Wrap the single-model
  call in a function returning `{ok, ...}` and chain: try primary → on any failure
  try fallback → only if both fail, return the contracted error.
- **Return which model answered** in the response body (e.g. `"model": PRIMARY_MODEL`)
  so logs and clients can attribute quality/latency issues.
- **When NOT to add a fallback:** when failures are persistent, not flaky. A fallback
  silently masks a dead primary — everything "works" while 100% of traffic quietly
  runs on the fallback. Rule: add a fallback only alongside logging of fallback hit
  rate (even a `console.warn('primary failed', detail)` you can grep). If you can't
  observe the hit rate, fix the primary instead of adding a fallback.

### Step 5 — Cost-control checklist

Run through this for every LLM call site:

- [ ] `max_tokens` set deliberately on EVERY call — sized to the schema/word budget, not defaulted.
- [ ] Every user-supplied string sliced before interpolation into a prompt: `context.slice(0, 300)`.
- [ ] Chat history capped (step 2) — verify the cap is on the CLIENT or wherever history is assembled.
- [ ] Images downscaled/compressed client-side before vision calls (e.g. longest edge ≤ 1024px, JPEG ~0.8) — image tokens usually dominate the bill.
- [ ] Token usage logged somewhere queryable: read the provider's `usage` field from each response and write `{model, totalTokens, feature}` to a log table or analytics event. "Somewhere queryable" means you can answer "what did feature X cost last week" — CLAUDE.md says where this lives in the current project.

### Step 6 — Evaluate with a golden set (no harness required)

Maintain a 5-case golden set per LLM feature, stored with the code as a literal
fixtures array so it's runnable, not just readable:

```ts
// llm-feature.golden.ts — re-run manually after any prompt/model change
export const GOLDEN_CASES: { name: string; input: unknown; assert: (out: unknown) => void }[] = [
  { name: 'typical',    input: /* the median real input */ undefined, assert: (out) => { /* schema fields present, typed, budget respected */ } },
  { name: 'edge',       input: /* unusual but valid: huge input, multiple subjects, odd format */ undefined, assert: (out) => { /* ... */ } },
  { name: 'adversarial',input: /* gibberish, irrelevant content, prompt-injection attempt */ undefined, assert: (out) => { /* failure behavior, not a crash */ } },
  { name: 'empty',      input: /* blank string/image, missing optional context */ undefined, assert: (out) => { /* graceful default, not a crash */ } },
  { name: 'hardest-seen', input: /* promote the worst real production input the day you see it */ undefined, assert: (out) => { /* ... */ } },
];
```

1. **Typical case** — the median real input.
2. **Edge case** — unusual but valid (large input, multiple subjects, odd format).
3. **Adversarial/junk input** — irrelevant content, gibberish, prompt-injection attempt.
4. **Empty input** — blank string, blank image, missing optional context.
5. **Hardest real case you've seen** — promote it from production the day you see it.

After ANY prompt or model change, run all 5 (call the endpoint or handler with each
`input` and run its `assert` against the real output — a markdown table with manual
copy-paste is an acceptable substitute only if no test runner exists yet, but the
fixtures array is the default) and compare each output against the step-1 contract:
schema fields present and typed, budgets respected, junk input handled per the
failure behavior.

⛔ STOP: A prompt or model change without a golden-set re-run is an unverified
change — do not commit it. Prompts are code with nondeterministic behavior; the
golden set is their only test suite. If a case regresses, revert or fix before
shipping, and add the regressing input as a new golden case if it was novel.

## Common mistakes

- **Parsing with regex hope instead of the ladder.** Extracting fields via regex from
  free text, or `JSON.parse` with no fence-strip/try-catch, "because the prompt says
  raw JSON". The prompt is a request the model intermittently ignores. Corrective
  rule: all five rungs, every consumer, even with provider-native JSON mode.
- **Changing the prompt and testing only the happy input.** One typical case passes,
  ship — and the edge/junk cases silently regressed. Corrective rule: the step-6
  golden set is the definition of "tested"; five cases or it didn't happen.
- **Fallback silently masking a dead primary.** Primary's key expired weeks ago;
  users notice nothing; you notice the fallback's bill. Corrective rule: log every
  fallback activation with the primary's failure detail, and check that log after
  deploys. No hit-rate visibility → no fallback.
- **Unbounded history growth.** Chat resends the full transcript each turn; token
  cost and latency scale linearly with conversation length until requests exceed the
  context window. Corrective rule: cap resent history (last N messages) at the point
  where the messages array is assembled.
- **Trusting model-emitted numbers as numbers.** `data.count` arrives as `"350"`,
  `null`, or missing — then arithmetic yields `NaN` that propagates into storage.
  Corrective rule: rung 5 coercion on every numeric field (`toNum(...) ?? default`)
  before the value touches state or a database.
- **Prompt rules duplicated across endpoints drifting apart.** Two endpoints embed
  copies of the same schema or tone rules; one gets edited, outputs disagree, and the
  bug looks like model flakiness. Corrective rule: when two prompts must agree on a
  rule, extract it into a shared constant both import.
- **Treating the model as able to fetch state.** "Use the user's current targets" in
  the prompt, with no targets in the message — the model invents plausible ones.
  Corrective rule: enriched-message pattern; every fact the answer depends on is
  interpolated into the request, or the model doesn't know it.

## Done criteria

- [ ] Step-1 contract written: exact schema, user-visible failure behavior, latency/cost budget.
- [ ] System prompt is a stable constant (role + rules + inline schema with example values); per-request data enters via an enriched user message.
- [ ] All five ladder rungs present: raw-JSON demand, fence strip, try/catch parse, distinct parse-failure status with raw text, per-field consumer coercion.
- [ ] Malformed-output test passed: fenced, truncated, and prose-wrapped inputs each produce the contracted failure behavior (not a generic 500).
- [ ] `max_tokens` set on every call; user strings sliced; history capped; images downscaled before vision calls.
- [ ] Model IDs env-overridable with defaults; any fallback is a different provider/family, its activations are logged, and the response reports which model answered.
- [ ] Token usage (model + total tokens) logged somewhere queryable per call.
- [ ] 5-case golden set exists and was fully re-run after the latest prompt/model change, each output checked against the contract.
