# Security fix C-5 — bounded, local-only AI proxy

Date: 2026-11-01 · Finding: `web/app/api/ai/responses/route.ts` forwarded arbitrary
bodies to OpenAI with the server key (only `max_output_tokens` bounded) → unlimited
`messages` = unlimited credit burn.

## Premise verification (before fixing)
- The route is the **AG Studio assistant proxy** shipped with the grid boilerplate
  (stage 79): browser adapter → our route → OpenAI, key added server-side.
- **Exposure today: local only.** Render deploys the ROOT server (`npm run start`);
  the Next `web/` app is not deployed anywhere → the route exists only on
  `localhost:3001`. The key is **not configured** (`AG_STUDIO_OPENAI_API_KEY` and the
  `OPENAI_API_KEY` fallback both absent) → route answers 503; the assistant UI stays
  hidden (`aiEnabled()`).
- Real residual vector: an evil page in the user's browser → `fetch('http://localhost:3001/…',
  text/plain)` (no preflight) → burns credits **once someone adds a key**; plus a
  future deployment would expose it publicly. Both are what the fix closes.

## Fix (TDD:11 red-first tests → module → route)
- **`web/lib/ai-limits.ts`** — `guardStudioAi(origin, host)`: local-only (localhost /
  127.0.0.1 / ::1 for BOTH Host and Origin; `null` and foreign → `503`; non-local
  Host → `503` = deploy guard) and `validateAiBody(text)`: ≤64 KB, `messages` must be
  an array of ≤50, JSON must parse (`413/400`).
- **Route** — order on the edge: guard → **streamed read with hard cap**
  (Content-Length pre-check + reader loop; never buffer unbounded input) → validator →
  key → model allowlist → forward (`max_output_tokens` cap unchanged).
- Suite: **35/35**; web `tsc0` + `next build` clean.

## Live probes (running dev server)
| # | Probe | Result |
|---|---|---|
| 1 | Evil `Origin: https://evil.example` (text/plain) | **503** `local-demo only` — burn vector dead |
| 2 | `Origin: null` | **503** |
| 3 | 70 KB body from localhost | **413** (stream/length cap) |
| 4 | 51 messages | **400** |
| 5 | Valid small body, key unset | **503** not-configured (guard passed, dormant) |
| 6 | Non-local `Host` (deploy guard) | **503** |
| 7 | `/dashboard` | **200** — feature intact |

Prod note: Render runs the root server — this route is not part of the deployed
surface (verified via render.yaml → single `npm run start` service).

Docs: SECURITY.md Rule 10 · ADR-019.

**C-5 status: FIXED + VERIFIED (local surface; prod unaffected by design).**

## CI follow-up (honest log)
Two of my own gates slipped and CI caught them: (1) the new test file skipped the
biome format pass → `Lint (biome)` red (`8fd45d9` fixed it); (2) a TS narrowing
error in the same test was **masked locally by a `| tail` pipe** (the pipeline's
exit code, not tsc's, reached my `&&` chain) and got pushed → `Build` red; fixed
properly with `assert.ok` narrowing (`d7086e4`). Final gates re-run with **unpiped
exit codes**: lint0 · build0 · tests rc0 (35/35) → **CI success**.
