# Security fix C-3 — public-data minimization + CORS allowlist

Date: 2026-11-01 · Finding: `/api/recon/rows` served the whole book including
**raw webhook payloads** (buyer emails, amounts) and `Access-Control-Allow-Origin: *`
sat on ~10 endpoints (any site could drive/read cross-origin calls from a victim's
browser).

## Premise verification (before fixing)
- The rows SQL really selected `payload_json` and returned it as `payload` on every
  EVENT row (128 rows locally) — the email carrier confirmed in code.
- Ten `ACAO: *` sites (rows bench/count/main, nl-filter, explain, action, negotiate,
  recon-run and two more GETs). Money-path CSRF was already dead after C-2 (401),
  but cross-origin RESPONSE READING of the ledger was wide open.

## Fix (TDD: 11 tests red-first → modules → wiring)
- **`src/public-rows.ts`** — `maskEmails()` (`ab…@domain`, single-char local part
  → `…@`, idempotent, URL-safe); EVENT rows **drop the `payload` field entirely**;
  payment notes (`ai_explanation`) and `/api/explain` output are masked. Amounts stay
  — they are the demo's content; the raw payloads remain in the DB + NDJSON logs
  (operations only, never served).
- **`src/cors.ts`** — `corsHeadersFor(origin, host, allowlist)`: same-origin always
  allowed; default allowlist `http://localhost:3001,http://127.0.0.1:3001` (local UI);
  `CORS_ORIGINS` env extends it; **every other origin gets nothing** (browser blocks
  the read, preflights fail). Wired to all10 sites (`corsHeadersFor` ×11, wildcard
  count **0**).
- Suite: **24/24** (cors6 + mask5 + existing13); `tsc0` · `biome0` · build ✓.

## Live proofs (local, real server)
| Probe | Result |
|---|---|
| `Origin: https://evil.example` | **no ACAO header** — cross-origin read blocked |
| `Origin: http://localhost:3001` | `ACAO: http://localhost:3001` (local UI keeps working) |
| same-origin POST (`Origin: localhost:3000`) | echoed — mini-demo unaffected |
| rows JSON |128 EVENT rows, **no `payload` key**, **0 raw emails** in the entire response |

Docs: SECURITY.md Rule 8 · ADR-017 · `.env.example` += `CORS_ORIGINS`.
**Prod verification + book re-seed: see the follow-up section after the deploy.**

## Prod verification + book re-seed (after deploy `0592b97`)

| Probe on prod | Result |
|---|---|
| `Origin: https://evil.example` | **no ACAO header** ✓ |
| same-origin (`Origin: <prod base>`) | `ACAO: https://paypal-recon-agent.onrender.com` ✓ |
| `/api/nl-filter` (mini-demo) | **200** ✓ |
| `/api/action` without token | **401** (C-2 still armed) ✓ |
| Book after deploy (wiped) | healed by the real signed cycle `SEED-C3-24551` → `INV2-9HG3-UK84-6KJT-HGD7` → paid → rows `0→1→5`, **payment=MATCHED** via auto-reconcile |
| **PII check on the LIVE response with real events** | **raw emails = 0 · `"payload"` key = false** |

**C-3 status: FIXED + VERIFIED ON PROD (2026-11-01).**
