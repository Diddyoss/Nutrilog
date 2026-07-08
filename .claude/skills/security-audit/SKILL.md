---
name: security-audit
description: "Use when reviewing security posture or when a change touches auth, secrets, environment variables, database policies, or user-data isolation. Triggers: \"is this secure\", \"security review\", new env var, new table or endpoint, auth changes."
---

# Security Audit

A defensive procedure for auditing the security posture of an app you own and
operate. The core principle: **trust ends at the network boundary.** Everything
that runs on the client is attacker-controlled, every server endpoint is callable
by anyone with `curl`, and authorization is only real where it is enforced on the
server or in the database — never in the UI. You audit three boundaries in a fixed
order (client → server functions → database), prove each with a literal command or
adversarial request, and report coverage as well as findings.

This skill audits what is *deployed*, adversarially. It does not design endpoints
or write policies — it verifies the ones that already exist behave under attack.

## When to use / when not to use

Use this skill when:

- Someone asks "is this secure", requests a "security review", or you're doing a
  pre-launch posture check.
- A change adds or touches: a new environment variable, a new database table or
  RLS policy, a new server endpoint/function, or anything in the auth flow.
- You added a paid upstream API behind an endpoint (new wallet attack surface).

NOT for:

- **Building an endpoint correctly in the first place** — use `serverless-api-design`.
  Discriminating test: are you deciding how a new endpoint *should* authenticate and
  bound input (that skill), or checking whether a deployed one actually does (this
  skill)? Design owns the blueprint; you verify the building.
- **Writing a new RLS policy correctly** — use `database-schema-evolution`.
  Discriminating test: are you authoring/migrating a policy (that skill), or
  adversarially testing a live one with a real token (this skill)?
- **Broad launch-readiness** (perf, error handling, monitoring, backups) — use
  `productionize-personal-app`. It owns the whole launch checklist and calls *this*
  skill for the security axis. If the ask is "am I ready to ship", start there.
- **General diff quality review** — use `code-review-standards`. Discriminating
  test: is the input a diff to judge for correctness/style (that skill) or a running
  system to attack (this skill)? A security-touching diff gets BOTH.

## Prerequisites

- The project's CLAUDE.md, which must tell you: the env-var contract (which vars are
  client-exposed vs server-only), the list of tables and endpoints, and the dashboard
  steps for any hosted-platform config (auth settings, exposed schemas).
- A way to read the deployed client bundle (`dist/` after a build, or view-source on
  the live site) and the server source.
- To run the row-isolation and endpoint tests: two test user tokens (user A, user B)
  and the base URLs. If you lack credentials or dashboard access, you do not skip
  those checks — you record them as not-checked with a reason and route them to a
  human runbook step (see the ⛔ gate).

## The three-boundary model

Audit in this order. Each boundary assumes the one before it is fully compromised.

```
(1) CLIENT   — 100% attacker-controlled. Anything bundled is PUBLIC.
(2) SERVER   — unauthenticated by default on most platforms. UI ≠ gatekeeper.
(3) DATABASE — where authorization actually lives for direct-query stacks.
```

### Boundary 1 — CLIENT (everything shipped is public)

Assume the attacker has your entire bundle, prettified, with every string extracted.
Therefore:

- Any env var with a client prefix (e.g. `VITE_`, `NEXT_PUBLIC_`, `PUBLIC_`, `REACT_APP_`)
  is public. That is fine for values *designed* to be public (a public anon key, a
  project URL) and fatal for anything else. Check the project's CLAUDE.md for which
  prefix this stack uses and which vars are legitimately public.
- Source maps, hardcoded strings, and inlined config are all readable.
- Any request the client can make, an attacker can make directly with `curl`.
- **Client-side checks are UX, not security.** A disabled button, a hidden route, a
  form validation, an `if (user.isAdmin)` in the SPA — all trivially bypassed. They
  improve the honest user's experience; they stop no attacker.

### Boundary 2 — SERVER FUNCTIONS (unauthenticated by default)

On most serverless platforms an endpoint is live and callable the moment it deploys,
with **no auth unless you added it**. Consequences:

- The UI not linking to an endpoint is NOT protection. Attackers read your bundle,
  find the path, and call it directly. "Nothing in the app calls this" ≠ "nobody can".
- Every endpoint has a **cost-per-call**. If it hits a paid upstream API (LLM, SMS,
  maps), each unauthenticated call spends *your* money — a wallet attack surface. An
  unbounded, unauthenticated endpoint in front of a paid API is a Critical finding.

### Boundary 3 — DATABASE (the real wall for direct-query stacks)

When clients query the database directly with their own token (common with
Postgres-backed BaaS platforms), the UI and even the server are bypassed entirely.
Row-level security (RLS) or equivalent row scoping is the ONLY thing standing between
user A and user B's data. If the stack has no direct client→DB access (all data goes
through your server), this boundary's authorization lives in the server code instead —
audit it there.

## The procedure

### Step 1 — Secret-placement audit (grep-based)

Prove no server-only secret leaks into the client, the repo, or logs. Run literally,
from the repo root. Replace the alternation list with the server-only var names from
the project's CLAUDE.md; the ones below are common examples.

Client bundle and source must NOT contain server-only secrets:

```bash
# build first so dist/ reflects reality, then grep both source and bundle
npm run build
grep -rn "OPENROUTER\|SECRET\|SERVICE_ROLE\|API_KEY\|PRIVATE" src/ dist/
```

Expected: zero hits for any server-only name. A public anon key or public URL
appearing is fine. Any service-role key, upstream API key, or signing secret in
`dist/` is Critical.

Secrets must not be committed to the repo history:

```bash
# is the env file ignored?
grep -n "\.env" .gitignore
# spot-check that no secret value was ever committed (use a known var name)
git log -p -S 'SERVICE_ROLE' -- . | head -50
git log --all --full-history -- '*.env' '.env*'
```

Expected: `.env` (and variants) ignored; no secret values in history. If a secret was
ever committed, rotating it is the fix — history rewrite alone does not un-leak it.

Secrets must not flow into logs or client-visible error bodies:

```bash
# server var names appearing near a log or a response is a leak vector
grep -rn "console\.\|res\.\|return.*json\|throw" api/ server/ | grep -i "OPENROUTER\|SECRET\|API_KEY\|token\|password"
# and the reverse: upstream error bodies forwarded raw to the client
grep -rn "\.message\|err\.\|error\.\|upstream\|response\.text\|response\.json" api/ server/ | head -40
```

Expected: no secret variable interpolated into a log line or a response body; upstream
error bodies are summarized, not forwarded verbatim (they can contain your key, your
account id, or internal URLs).

### Step 2 — Row-isolation audit (per table, direct-query stacks)

Skip only if the stack has no direct client→DB access. For EACH table listed in the
project's CLAUDE.md, complete this checklist. Read the deployed policy, do not trust
the migration file — they can drift.

```
Per table:
├─ RLS enabled on the table?
│    (No → Critical: every row is world-readable/writable via the data API.)
├─ At least one policy exists?
│    (RLS enabled with NO policy = table is INVISIBLE, not open — deny-by-default.
│     Not a vulnerability, but verify it's intentional, not an accident that
│     silently broke the feature.)
├─ Does the policy cover BOTH `using` AND `with check`?
│    (`using` gates reads/which rows are visible to update/delete.
│     `with check` gates what a row is allowed to become on INSERT/UPDATE.
│     A policy with only `using` lets a user INSERT rows owned by someone else,
│     or UPDATE their row to set user_id to a victim. High/Critical.)
└─ Does the owner column default SERVER-SIDE?
     (owner defaults to auth.uid() / the session identity — NOT trusted from the
      client's request payload. If the client supplies user_id and the policy
      doesn't re-check it against the session, isolation is forgeable.)
```

Then TEST it adversarially — enabled ≠ correct. As user A, try to touch user B's rows
directly against the data API (bypassing your UI entirely):

```bash
# READ user B's rows using user A's token — expect zero rows.
curl -s "$DB_REST_URL/<table>?user_id=eq.$USER_B_ID" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_A_TOKEN"

# WRITE a row owned by user B using user A's token — expect a permission error.
curl -s -X POST "$DB_REST_URL/<table>" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$USER_B_ID\", <minimal required fields>}"
```

Expected: read returns `[]` (zero rows); write returns a permission/RLS error, not
`201`. Anything else is a data-isolation breach — Critical. Record the exact response
you saw for each table.

⛔ STOP: A policy you have not adversarially tested with a real second-user token is
UNVERIFIED, not "fine". Do not mark a table clean on the strength of reading its SQL.

### Step 3 — Endpoint audit (per server function)

For EACH endpoint/function in the project's CLAUDE.md, answer all five. Read the
handler source; where a question is behavioral, prove it with `curl`.

```
Per endpoint:
1. WHO can call it?      — Is there an auth check (token verified) or nothing?
                           Test: curl it with NO auth header. A 200 = anonymous.
2. WHAT does a call COST me? — Paid upstream fee? DB writes? Unbounded fan-out?
                           An unauthenticated endpoint with per-call cost = wallet risk.
3. WHAT does it LEAK on error? — Force an error (bad input, huge input) and read the
                           body. Upstream error bodies, stack traces, internal URLs,
                           or the model/provider name leaking is a finding.
4. Is INPUT BOUNDED?     — Payload size cap? String truncation? A field that becomes
                           an upstream prompt/query with no length limit is abuse fuel.
5. Is the METHOD guarded? — Does it reject the methods it doesn't implement, or does a
                           stray GET/OPTIONS do something unintended?
```

Concrete probes:

```bash
# 1 & 5 — no auth, wrong method
curl -i -X GET  "$BASE_URL/api/<endpoint>"                       # expect 405 or 401
curl -i -X POST "$BASE_URL/api/<endpoint>" -d '{}'               # who gets in with no token?

# 3 & 4 — malformed and oversized input; read what comes back
curl -i -X POST "$BASE_URL/api/<endpoint>" \
  -H 'Content-Type: application/json' -d '{"bad":"input"}'
curl -i -X POST "$BASE_URL/api/<endpoint>" \
  -H 'Content-Type: application/json' \
  --data-binary @<(python3 -c "print('{\"text\":\"'+'A'*5000000+'\"}')")  # 5MB payload
```

⛔ STOP: Do not report an endpoint clean until you have run the no-auth call, the
malformed-input call, and (if it has per-call cost) confirmed either auth or a rate/size
bound exists. Reading the handler is not a substitute for calling it — even when the
source makes an auth check's absence look 100% certain, platform-level middleware,
an API gateway rule, or a reverse-proxy config can add (or fail to add) enforcement
invisibly outside the handler's own source; the live call is what actually reaches
the deployed system, the source is only what you intended to deploy.

### Step 4 — Anonymous-auth caveats (if the app uses anonymous sign-in)

If the app signs users in anonymously (device-provisioned identity, no email), the
policy math changes — check the project's CLAUDE.md for whether this is the auth mode.

- **Anonymous users ARE the `authenticated` role.** A policy scoped to `authenticated`
  (rather than a specific verified condition) *includes every anonymous user*. This is
  fine for per-user isolation (each still has a distinct `auth.uid()`), but do not
  mistake "authenticated-only" for "verified humans only" — there is no verification.
- **Identity is device-bound and unrecoverable.** Clearing site storage orphans the
  account and its data with no recovery path. That is an availability/data-loss issue,
  not a confidentiality one — flag it as such, and confirm the product intends it.
- **No email = no recovery and no meaningful per-identity rate limit.** An attacker
  mints fresh anonymous identities at will, so "rate limit per user" is not a real
  control against abuse. Rate-limit by IP/cost at the endpoint instead.

## Output format

Report findings in this exact table, then the coverage list. Both are required — a
report with only findings hides how much you actually looked at.

```
| Severity | Boundary | Finding | Concrete fix |
|----------|----------|---------|--------------|
| Critical | Server   | /api/x callable with no auth, hits paid LLM per call | Add token verification; cap payload to N KB |
| High     | Database | food_log policy has `using` but no `with check` | Add `with check (user_id = auth.uid())` |
| Low      | Client   | Public anon key in bundle | None — designed to be public; confirmed in CLAUDE.md |
```

Severity = Critical / High / Medium / Low. Boundary = Client / Server / Database.

Then a **checked and clean** list — everything you audited that passed:

```
CHECKED AND CLEAN:
- Secret placement: grep of src/ + dist/ for <var names> → 0 hits.
- Table <t1>: RLS on, policy has using+with check, A-reads-B → [], A-writes-B → 403.
- Endpoint <e1>: no-auth call → 401; oversized payload → 413.

NOT CHECKED (needs human/credentials):
- Dashboard auth settings + exposed schemas — no dashboard access this session.
  Runbook: <the CLAUDE.md dashboard-check step>.
```

⛔ STOP — final gate before writing "secure": every table has a row-test result and
every endpoint has a cost/leak result, OR it appears in the NOT CHECKED list with a
reason. If any table or endpoint is neither tested nor explicitly listed as not-checked,
you are not done — you are guessing. "I read the code and it looks fine" is not an audit
result.

## Common mistakes

- **Assuming an endpoint is private because the UI doesn't call it.** Attackers read
  the bundle and `curl` the path directly. Corrective rule: every endpoint is public
  until you've confirmed it verifies a token — test with a no-auth call, don't reason
  from the UI.
- **RLS "enabled" treated as "secure" without an adversarial test.** Enabled with a
  wrong or `using`-only policy still leaks. Corrective rule: prove isolation with a
  real second-user token (step 2), and check `with check` is present, not just `using`.
- **Auditing code but not the dashboard/console config.** Auth providers, allowed
  redirect URLs, and which DB schemas are exposed to the data API live in the hosting
  dashboard, not the repo — a locked-down policy is moot if the schema is exposed with
  RLS off elsewhere. Corrective rule: when the session lacks dashboard credentials,
  route these to a human runbook step (see NOT CHECKED); never silently omit them.
- **"It's just my app" complacency.** Personal-scale apps still front paid APIs and
  hold real user data. An unauthenticated endpoint on a paid LLM drains your account
  regardless of how few real users you have. Corrective rule: cost-per-call is a
  vulnerability class on its own — audit it even for hobby projects.
- **Checking secrets in code but not in logs and error responses.** A key that never
  ships in the bundle still leaks if it's logged or forwarded in an upstream error
  body. Corrective rule: run the step-1 log/response grep and force an endpoint error
  to read what comes back.
- **Treating client-side validation as a security control.** Length limits, disabled
  buttons, and role checks in the SPA are UX. Corrective rule: for every client-side
  guard that matters, verify the same check exists server-side or in the policy; if it
  only exists on the client, it does not exist.

## Done criteria

- [ ] Step-1 secret grep run against BOTH `src/` and a fresh `dist/` build: zero
      server-only-secret hits, `.env` ignored, no secret in git history, no secret in
      logs/error bodies.
- [ ] Every table from CLAUDE.md has its RLS checklist completed AND an adversarial
      A-reads-B / A-writes-B result recorded (or is in NOT CHECKED with a reason).
- [ ] Every endpoint from CLAUDE.md has all five questions answered, with the no-auth
      call, malformed-input call, and cost/bound check actually run.
- [ ] Anonymous-auth caveats reviewed if that auth mode is in use.
- [ ] Findings reported in the exact table AND a "checked and clean" coverage list AND
      a NOT CHECKED list for anything requiring credentials/dashboard access.
- [ ] Final ⛔ gate satisfied: nothing is claimed "secure" that wasn't tested or
      explicitly listed as not-checked.
