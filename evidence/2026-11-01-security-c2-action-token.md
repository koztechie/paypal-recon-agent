# Security fix C-2 — token-gated mutating endpoints + explicit prod mode

Date: 2026-11-01 · Finding: no endpoint authentication + `render.yaml` left `DRY_RUN`
unset (code default `false`) → on the public URL anyone could call `/api/action`
(REAL reminder email to a customer / flip a REVIEW row to MATCHED), `/api/recon/run`
(writes records) and `/api/negotiate` (burns LLM quota).

## Premise verification (before fixing)
- `isDryRun()` = `env.DRY_RUN ?? "false"` → prod really runs real mode ✓ (intended
  for the honest demo — the fix is AUTH, not faking the money paths).
- Hosted mini-demo uses only `/api/nl-filter`, `/api/recon/rows?count=1`, `/health`
  → these must stay public (R6 keyless-demo requirement).
- The three listed POST routes had zero auth ✓ finding correct.

## Fix (TDD:6 failing tests first → module → wiring)
- **`src/api-auth.ts`** — `checkActionAuth(authorization, x-action-token, ACTION_TOKEN)`:
  token unset → `{allowed:true, warnUnprotected:true}`; set → length-safe XOR compare
  against `Bearer <t>` or `X-Action-Token: <t>`, otherwise denied. `tests/api-auth.test.ts`
  (6 tests, incl. a500-char attacker value) — suite now **13/13**.
- **`src/server.ts`** — `guardAction()` applied to `/api/action`, `/api/recon/run`,
  `/api/negotiate`: deny → `401 {error:"unauthorized"}` + `[auth] REJECTED` log; unset
  token → every call logs `[auth] WARNING: … is OPEN (security C-2)`.
- **`render.yaml`** — `DRY_RUN: 'false'` made explicit + `ACTION_TOKEN sync:false`.
- `.env.example` += `ACTION_TOKEN` (+ `openssl rand -hex 32` hint); README's hosted-API
  list updated (keyless surfaces vs token-gated ones); SECURITY.md **Rule 7**; ADR-016.

## Live proofs (local, real server)
| Call | Result |
|---|---|
| warn-mode `/api/action` (no token) | business `200` + LOUD `[auth] WARNING` |
| strict, no token | **401 unauthorized** |
| strict, wrong Bearer | **401** |
| strict, correct `X-Action-Token` | passes auth → business response (not 401) |
| `/api/nl-filter` WITHOUT token | **200 `source: llm`** — keyless demo intact (R6) |
| `/api/recon/run` WITHOUT token | **401** · `/health` 200 |

## Remaining step (user): set `ACTION_TOKEN` on Render
Generate **locally** (never pasted into chat/repo): `openssl rand -hex 32` →
Render → service → Environment → `ACTION_TOKEN=<value>` → save. Then: prod
`/api/action` without a token must 401, and the mini-demo must still answer.

**C-2 status: FIXED (local proofs) — prod activation pending the env var.**
