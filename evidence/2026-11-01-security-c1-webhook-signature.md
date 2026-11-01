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

## Prod verification (after the user set `WEBHOOK_ID=83733119MV984010C` on Render)

| Step | Result |
|---|---|
| Forged POST, no headers | **401** `{reason:"missing-headers"}` — strict mode live on prod |
| Forged POST, well-formed fake headers | **401** `{reason:"failure-status"}` |
| Real signed cycle #1 | **0 rows** — investigation found the ROOT BUG: the first implementation used the **legacy `{headers[],sig}` payload**, which the 2023-updated endpoint rejects with `400 /headers` → fail-closed blocked REAL events too |
| Schema fix (`f88a3e4`) | switched to the **current flat contract**: `auth_algo/cert_url/transmission_id/transmission_sig/transmission_time/webhook_id` + `webhook_event` (raw event); confirmed empirically (`200 {verification_status:FAILURE}` on a schema-valid fake) and against the official OpenAPI; tests assert the flat wire format (7/7) |
| Real signed cycle #2 | **`SEED-C1B-83746`** → `INV2-NEMJ-KLEB-FJBQ-QTPB` → sent → paid → prod stored the signed deliveries (`INVOICE.PAID` → payment `EXTR-3TB741470K023144B`) → **`recon/run` → MATCHED, variance 0**, prod rows =5 (re-seeded) |

**Lesson logged:** forgeries were rejected from the very first deploy (C-1's hole was
closed), but only the REAL signed-event test proved the wire format — a400-from-PayPal
and a genuine FAILURE look identical to a fail-closed checker, so the positive path
must always be exercised end-to-end. (Also: id `83733119MV984010C` verified directly
via `GET /v1/notifications/webhooks/{id}` → 200, url = prod, 16 types.)

**C-1 status: FIXED + VERIFIED ON PROD (2026-11-01).**
