# Security fix C-1 — webhook signature verification

Date: 2026-11-01 · Finding: `/webhook` accepted any POST (no `PAYPAL-TRANSMISSION-ID`
verification via `/v1/notifications/verify-webhook-signature`) → anyone could inject a
fake `INVOICING.INVOICE.PAID` into the reconciliation book as `COMPLETED`.

## Fix (ub-mode: failing tests first)
- **`src/webhook-verify.ts`** — pure boundary module: the5 `PAYPAL-*` headers +
  `event_type` → verify endpoint (OAuth client-credentials, cached token, injected
  fetch for hermetic tests,8s timeouts, **never throws**).
- **`tests/webhook-verify.test.ts`** —6 tests, written RED first (module missing),
  then GREEN: SUCCESS payload/auth assertions, FAILURE status, missing-headers (no
  network calls), non-200 (fail-closed), transport error (fail-closed), missing
  event_type. Suite now **7/7**.
- **`src/server.ts`** — verification gate BEFORE any storage; enforcement =
  presence of `WEBHOOK_ID`:
  - set → **strict, fail-closed** (401 + `[webhook] REJECTED (reason)`, nothing stored);
  - unset → accept **with a loud warning** (deploy-safe: nothing breaks before the
    env var is added; the hole closes the moment it is).
- `.env.example` += `WEBHOOK_ID` (with the prod/dev ids documented as comments).

## Live proofs (real server, real PayPal API)
| Proof | Result |
|---|---|
| Warn-mode forged POST (no WEBHOOK_ID) | `200 {received:true}` + `[webhook] WARNING: …accepted WITHOUT signature verification` |
| Strict-mode forged POST (WEBHOOK_ID set), no headers | **`401 {reason:"missing-headers"}`**, `REJECTED` logged, rows **188→188** |
| Strict-mode, forged-but-well-formed headers (fake sig/cert-url) | server called the **real** sandbox verify endpoint → `FAILURE` → **`401 {reason:"failure-status"}`**, rows unchanged |

Gates: `tsc0` · `biome0` · `npm test 7/7` · root build ✓ · CI on the commit.

## Remaining one-time step (user): set `WEBHOOK_ID` on Render
Dashboard → the service → Environment → add `WEBHOOK_ID=83733119MV984010C` → save
(deploys/restarts). Afterwards: forged curl must return 401 on prod, and the next
REAL signed event must log `[webhook] signature verified: …` in Render Logs.
(Recorded as ADR-015.)
