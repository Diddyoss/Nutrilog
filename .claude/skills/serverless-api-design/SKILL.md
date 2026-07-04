---
name: serverless-api-design
description: "Use when creating or modifying serverless functions or API routes, especially proxies to third-party APIs holding secrets. Triggers: \"add an endpoint\", \"proxy this API\", new file under an api/ or functions/ directory, \"where does the API key go\"."
---

# Serverless API Design

How to build a serverless function or API route that fronts a third-party API
without leaking secrets, leaking upstream internals, or leaving your wallet open.
The core principle: **every endpoint you deploy is publicly callable by anyone
with curl, regardless of what your UI links to.** Design each one as if a
stranger is already hitting it — because once deployed, they can.

## When to use / when not to use

Use this skill when:

- Adding or modifying a serverless function / API route (a file under `api/`,
  `functions/`, `app/api/`, or the platform's equivalent).
- Proxying a third-party API — anything that needs a key, token, or account.
- Deciding "where does the API key go" or whether the client may call an
  upstream directly.

NOT for:

- **Prompt design, model choice, or structured-output parsing** — use
  `llm-feature-engineering`. Discriminating test: are you changing what the AI
  is asked or how its answer is interpreted (that skill), or the HTTP shell
  around the call — guards, statuses, caps, timeouts (this skill)? An endpoint
  that calls an LLM uses both: it owns the prompt, you own the shell.
- **Auditing the security posture of what's already deployed** — use
  `security-audit`. Discriminating test: designing/changing an endpoint (this
  skill) vs. assessing existing exposure, auth, and rate limits (that one).
- **Schema work when the endpoint reads/writes the database** — the HTTP shell
  is yours; any new column, table, or migration the endpoint needs is owned by
  `database-schema-evolution`. Route the schema part there.
- **The final proof that the finished endpoint works** — use
  `verification-before-done`, which owns the done-check including curling the
  deployed/local endpoint. This skill's curls are design-time smoke tests, not
  the sign-off.

## Prerequisites

- The project's CLAUDE.md, specifically: the env-var table, the full-stack dev
  command, and where `.env.example` lives.
- The upstream API's docs: auth method, error format, and pricing (free tier?
  per-request? per-token?).

## The procedure

### Step 1 — Decide: client-callable or server-only?

The proxy tier exists for one reason: **secret hygiene**. Anything shipped to
the browser is public — bundled JavaScript, env vars with client prefixes,
network requests in devtools. A key in the client is a key you have published.

```
Does the upstream call involve ANY of:
├─ a credential (API key, token, signed secret)        → server-only proxy
├─ a paid upstream (per-request / per-token billing)   → server-only proxy
├─ a per-app rate limit or quota you must protect      → server-only proxy
└─ none of the above (public, free, unlimited, e.g. a
   public dataset API)                                 → client MAY call it
                                                          directly; a proxy is
                                                          still fine for
                                                          response shaping
```

⛔ STOP: If the answer is "server-only", no part of the credential — the key,
the authenticated URL, a pre-signed header — may appear in client code or in a
client-prefixed env var. If you find yourself writing `fetch('https://api.
vendor.com', { headers: { Authorization: ... } })` in frontend code, stop and
move it behind a function.

### Step 2 — Name the env var correctly, and register it

Client-exposed prefixes (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, `EXPO_PUBLIC_`,
`PUBLIC_` in some frameworks) mean **BUNDLED AND PUBLIC**: the build tool
inlines the value into the shipped JavaScript. A server secret must never gain
one — not at creation, and not during a rename.

1. Check the project's CLAUDE.md env-var table first — the var may already
   exist, or a naming convention may be documented.
2. Name it without any client prefix: `GEOCODE_API_KEY`, not
   `VITE_GEOCODE_API_KEY`.
3. Update BOTH the CLAUDE.md env table and `.env.example` (value redacted,
   e.g. `GEOCODE_API_KEY=your-key-here`) in the same change that introduces
   the var. An undocumented env var is a production incident waiting for the
   next deploy from a fresh machine.
4. Put the real value where each environment reads it: your gitignored local
   env file (`.env` / `.env.local` — CLAUDE.md says which) for dev, and the
   hosting platform's env settings for deploys. Never commit the value.

### Step 3 — Write the endpoint skeleton, guards in this order

The order matters: each guard is cheaper than the one after it, and each
produces a distinct, diagnosable failure. Platform-agnostic TypeScript sketch
(adapt `req`/`res` to your platform's signature):

```ts
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_QUERY_CHARS = 200;

export default async function handler(req, res) {
  // (1) Method guard — reject early, tell the caller how to call it.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  // (2) Env-presence guard — a missing key is YOUR config fault, not the
  // caller's. Name the var in the SERVER LOG only; the client gets a generic
  // message (env-var names map your infrastructure for attackers).
  const apiKey = process.env.GEOCODE_API_KEY;
  if (!apiKey) {
    console.error('GEOCODE_API_KEY is not set'); // server logs only
    return res.status(500).json({ error: 'Server configuration error', code: 'CONFIG_ERROR' });
  }

  // (3) Input validation — one explicit 400 per missing/invalid field, naming
  // the field. "Bad request" with no field name wastes the caller's time.
  const { address } = (req.body ?? {}) as { address?: unknown };
  if (typeof address !== 'string' || !address.trim()) {
    return res.status(400).json({ error: 'Missing or invalid field: address', code: 'INVALID_INPUT' });
  }

  // (4) Bound the input BEFORE it reaches the upstream — cap payload size and
  // truncate strings before interpolating them into upstream calls.
  const query = address.trim().slice(0, MAX_QUERY_CHARS);

  try {
    // (5) Upstream call WITH a timeout. No timeout = the function hangs until
    // the platform kills it (10–60s), burning execution time and UX.
    const upstream = await fetch(
      `https://api.geocoder.example/v1/search?q=${encodeURIComponent(query)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );

    // (6) Response shaping — NEVER pass an upstream error body raw to the
    // client (it can contain keys, internal URLs, stack traces). Log a
    // truncated detail server-side; return a stable, machine-readable shape.
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error('geocode upstream error', upstream.status, detail.slice(0, 500));
      return res.status(502).json({ error: 'Geocoding failed — try again', code: 'UPSTREAM_ERROR' });
    }

    const data = await upstream.json();
    // Shape to exactly what the client needs — don't forward the whole
    // upstream payload (it couples your client to a vendor's format).
    return res.status(200).json({ lat: data.results?.[0]?.lat ?? null, lng: data.results?.[0]?.lng ?? null });
  } catch (err) {
    // Timeouts and network failures are the upstream's fault → 502, retryable.
    console.error('geocode call failed', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Geocoding failed — try again', code: 'UPSTREAM_ERROR' });
  }
}
```

For request bodies that can be large (images, documents), also cap the payload:
check `Content-Length` or the decoded body's size against a deliberate limit
(e.g. reject > 5 MB with a 413) before doing anything else with it, and confirm
it fits under the platform's own body limit.

### Step 4 — Apply the error taxonomy

Status codes are an API contract, not decoration. One rule per digit:

| Status | Whose fault        | Message discipline                                        |
| ------ | ------------------ | --------------------------------------------------------- |
| 400    | Caller's input     | Name the exact field: `Missing or invalid field: address` |
| 405    | Caller's method    | `Method not allowed`                                      |
| 413    | Caller's payload   | Name the cap: `Payload too large (max 5MB)`               |
| 422    | Upstream answered, output unusable | Say what could not be processed           |
| 500    | YOUR config        | Generic to client; var name in server logs only           |
| 502    | Upstream failed / timed out | Retryable phrasing: "…failed — try again"        |

Use ONE JSON error shape across every endpoint in the project so the client
can branch without parsing prose:

```json
{ "error": "<human-readable message>", "code": "<STABLE_MACHINE_CODE>" }
```

Never fold these together: a 500 for a caller typo teaches clients to retry
hopelessly; a 400 for your missing env var hides a config outage as user error.

### Step 5 — ⛔ Cost & abuse caps (paid upstreams only)

⛔ STOP: If the upstream costs money per call/token, do not proceed past this
step until every knob below has a value you chose deliberately and can defend.
The threat, plainly: **an unauthenticated endpoint fronting a paid API is a
wallet attack surface.** Anyone can script a loop against it tonight. Until
real auth and rate limiting exist, these caps are your only blast-radius
control — they bound the cost of a single request, not the request rate.

Enumerate and set each:

- **Response-size cap** — `max_tokens` for LLMs, `page_size`/`limit` params
  for data APIs. Never leave the vendor default.
- **Request payload cap** — max body size the function accepts (step 3's 413).
- **Input truncation** — `.slice(0, N)` every caller-supplied string before it
  reaches the upstream; a caller must not be able to buy 100k input tokens by
  pasting a novel.
- **Model / tier choice** — pin the cheapest model or plan tier that meets the
  requirement; make an override an env var, not a client parameter. The client
  must never choose the model — that hands the attacker the price dial.

These caps limit damage per request; they do not stop a request flood. Route
the auth / rate-limit / deployed-posture audit to `security-audit` — but do
not skip the caps because that audit is planned.

### Step 6 — Keep the function thin

The handler does three things: **validate, call, shape.** Any real logic —
unit conversion, parsing, mapping vendor fields to your domain — belongs in
extractable pure functions (top of the file or a shared module), because the
handler's `req`/`res` signature makes it awkward to unit-test, while
`convertUnits(raw)` is trivially testable. If you're writing a nested loop or
a 20-line transformation inline in the handler, extract it.

### Step 7 — Verify it runs locally (the dev-server trap)

The frontend dev server (e.g. plain `vite dev`) usually does NOT execute
serverless functions — requests to `/api/*` return 404 or the index.html.
Check the project's CLAUDE.md for the full-stack dev command (e.g.
`vercel dev`, `netlify dev`, a framework dev server that serves routes), start
it, and prove each guard with curl:

```bash
# Method guard → expect 405
curl -si -X GET 'http://localhost:<port>/api/geocode' | head -1

# Missing field → expect 400 naming "address"
curl -si -X POST 'http://localhost:<port>/api/geocode' \
  -H 'Content-Type: application/json' -d '{}'

# Happy path → expect 200 with the shaped body
curl -si -X POST 'http://localhost:<port>/api/geocode' \
  -H 'Content-Type: application/json' -d '{"address":"1 Main St, Springfield"}'
```

Two failure signatures and what each means:

- **404 or an HTML page** → the function isn't being served; you're hitting a
  frontend-only dev server. Fix the dev command (CLAUDE.md), not the handler.
- **500 `CONFIG_ERROR` locally** → the dev command isn't loading your env
  file. Check how the project injects local env vars (CLAUDE.md; some
  platform CLIs pull from the hosting dashboard rather than `.env`).

⛔ STOP: You have seen the 405, the 400, and the 200 from a locally running
function. If not, resolve the failure signature above before touching the
handler code further. Then hand the final done-proof to
`verification-before-done`.

### Step 8 — Check typecheck coverage

Serverless directories are often OUTSIDE the main `tsconfig.json` `include` —
your CI can be green while the function has type errors. Check:

```bash
grep -n 'include' tsconfig*.json
# Discriminating test: is the functions dir in the compiled file set at all?
npx tsc --noEmit --listFiles 2>/dev/null | grep '/api/' | head -5
```

No output from the second command means the directory is invisible to
typecheck — "no errors" is meaningless for it.

If the functions directory is excluded, route the fix (a dedicated tsconfig or
an added include path, wired into CI) to `ci-and-quality-tooling` — don't leave
the endpoint unchecked.

## Common mistakes

- **Logging secrets or full auth headers.** `console.log(req.headers)` or
  logging the outgoing fetch options puts the bearer token in the platform's
  log storage, visible to everyone with dashboard access. Corrective rule: log
  var *names* and statuses, never values; never log a headers object whole.
- **Unbounded request bodies interpolated into upstream calls.** A caller's
  10 MB string becomes your 10 MB (or 100k-token) upstream bill. Corrective
  rule: cap payload size and `.slice()` every string before interpolation
  (step 3, items 4 and 5) — bounds are set at the door, not trusted from the
  client.
- **Leaking upstream error bodies verbatim.** Vendor error responses can
  contain your API key (echoed from the request), internal hostnames, or stack
  traces. Corrective rule: truncated detail to server logs; client gets the
  stable `{ error, code }` shape only.
- **Assuming the UI is the gate.** "Only the settings page calls this" is not
  protection — the endpoint is a public URL. Corrective rule: every guard and
  cap must hold for a caller who has never loaded your frontend (that's what
  the step-7 curls simulate).
- **No upstream timeout.** The fetch hangs until the platform's execution
  limit kills it — a slow upstream turns into 60-second charges and a frozen
  UI. Corrective rule: `AbortSignal.timeout(N)` on every upstream call, N
  chosen per upstream, and the timeout path returns a retryable 502.
- **A server var acquiring a client prefix during a rename.** Someone
  "standardizes" env names and `GEOCODE_API_KEY` becomes
  `VITE_GEOCODE_API_KEY` — the next build ships the key to every browser.
  Corrective rule: renames of env vars go through the CLAUDE.md env table
  review (step 2); a prefix change is a publication decision, not a style fix.
- **Config faults reported as caller faults.** Returning 400 (or leaking the
  var name in a 500 body) when an env var is missing. Corrective rule: 500 +
  generic client message + var name in server logs only — step 4's taxonomy.

## Done criteria

- [ ] Client/server decision made via the step-1 rule; no credential or authenticated URL appears in client code.
- [ ] Env var has no client-exposed prefix; CLAUDE.md env table and `.env.example` updated in the same change.
- [ ] Handler contains all six skeleton elements in order: method guard, env guard (generic to client, var named in logs), per-field 400s, bounded input, upstream timeout, shaped responses.
- [ ] Error responses use the project-wide `{ error, code }` shape; statuses follow the taxonomy (4xx caller, 500 config, 502 upstream).
- [ ] Paid upstream: response-size cap, payload cap, input truncation, and model/tier are each explicitly set — none left at vendor defaults; auth/rate-limit follow-up routed to `security-audit`.
- [ ] Business logic lives in extractable pure functions; the handler only validates, calls, and shapes.
- [ ] All three curls (405, 400, 200) observed against the locally served function using the project's full-stack dev command.
- [ ] Functions directory confirmed inside typecheck coverage, or the gap routed to `ci-and-quality-tooling`.
- [ ] Final proof handed to `verification-before-done`.
