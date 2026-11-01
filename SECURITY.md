# SECURITY.md — Agent Guardrails

**Project:** Cross-Border Reconciliation Agent (PayPal AI Hackathon)
**Version:** 1.0 — 2026-10-27
**Source:** ADR-006, ADR-004 (stack), stage 19 action table, `schema.sql` (`agent_actions`)

These five rules are **hard constraints**. Any code path that violates them must fail closed (block, not warn).

---

## Rule 1 — Amount limit

- The agent may initiate **read-only** operations without limits.
- The agent may initiate **write** operations (`send_invoice_reminder`, `record_payment_for_invoice`) **only** when:
  - invoice total ≤ **$500 USD equivalent** (50,000 minor units), and
  - the action is on the allowlist (stage 19, actions 3 and 5).
- Anything above the limit → `limit_check = BLOCKED`, status `REVIEW`, queue for a human.
- Money enters the ledger only as **validated integer minor units** (`dollarsToMinor`, M-1): strict decimal grammar + safe-integer check — malformed/`NaN`/negative/unsafe values throw BEFORE any policy decision or DB write (live: `invalid money value: "abc"`, row not stored).
- The limit is a single constant: `AGENT_AUTO_LIMIT_MINOR = 50000` — compared against the **USD equivalent** via `src/fx.ts` (ECB daily reference rates,24h per-process cache, USD identity fast path with zero network calls; conversion failure → **block**, fail-closed). Verified live: €500 ≈ $558.60 → BLOCKED, $499.99 → PASS.

## Rule 2 — Human approval for large or irreversible actions

The agent **never** performs these, at any amount:

| Blocked action | Toolkit / API | Approver |
|---|---|---|
| Refund | `create_refund`, `record_refund_for_invoice` | human |
| Cancel invoice | `cancel_sent_invoice`, `delete_invoice` | human |
| Accept dispute | `accept_dispute_claim` | human |
| Payouts | REST Payouts API | human |
| Change recipient / account data | any | human |

Approval flow: action requested → stored with `executed = 0` → human flips to `executed = 1` with a note. The agent cannot flip this flag.

## Rule 3 — Log every action
> **H-6 (2026-11-01):** `executed=1` means *the tool really ran*. A BLOCKED
> decision stays `executed=0` forever — no code path may flip it (the
> `recordExternalPayment` blocked branch did; pinned by `tests/blocked-not-executed.test.ts`).
> **H-7 (2026-11-01):** the audit is **one row per decision+attempt** (no wrapper
> double-logs the policy) and flips are **identity-based**: `logAgentAction` returns
> the row id and `markAgentActionExecutedById(id)` touches ONLY that row — the old
> "newest not-executed per action" selection raced under concurrency (pinned by
> `tests/audit-identity.test.ts`).

- Every agent decision is written to `agent_actions` **before** execution:
  `action`, `llm_decision` (raw model output), `limit_check` (`PASS`/`BLOCKED`), `target_ref`, `executed`, timestamps.
- Every reconciliation outcome stores `ai_explanation` (why the LLM classified it that way).
- Logs are append-only. No UPDATE/DELETE on `agent_actions` and `webhook_events`.
- A blocked attempt is still logged — blocked ≠ invisible.

## Rule 4 — Frequency limits

- `send_invoice_reminder`: **max 1 per invoice per 24 hours**, **max 3 per invoice lifetime**, only for status `SENT`, only unpaid.
- Daily summary: **once per day** (09:00 server time).
- Webhook events: processed **exactly once** (`paypal_event_id UNIQUE` dedupe guard).
- Exceeding a frequency limit → action dropped, logged as `BLOCKED`.

## Rule 4a — Reminders: atomic DB reserve (H-8)

The1/24h + 3-lifetime limits live in the `reminder_ledger` table
(`UNIQUE(invoice_id, sent_date)`), reserved **before** the PayPal call by a single
synchronous critical section and released when the call fails (a failed attempt
never burns the slot). One choke point — `withReminderLedger()` wraps the toolkit's
`send_invoice_reminder`, covering wrapper, raw scripts, the UI, the reminder agent
and the agent loop. `logs/reminders.json` is a legacy projection (stage-64/50/52
scripts read it); it is regenerated from the DB and never overwritten by an empty
table. Verified: concurrent double-send = one PayPal call (suite71/71), stage64 8/8,
stage52 5/5, stage65 5/5.

## Rule 5 — Secrets and environment isolation

- `PAYPAL_ENVIRONMENT=SANDBOX` is the default and the only allowed value during the hackathon.
- Secrets live in `.env` only; `.env` is git-ignored; the repo is scanned (stage 121: `grep` for keys = 0 hits) before every push.
- LLM API keys are server-side only; the browser never receives them.
- Webhook payloads and invoice memos are **untrusted data**, never instructions: they are rendered as data, not fed to the model as prompts (prompt-injection boundary).

---

## Rule 6 — Verify webhook signatures

Every delivery at `POST /webhook` is checked with PayPal's
`/v1/notifications/verify-webhook-signature` **before** the event is trusted:
the five `PAYPAL-*` headers + `event_type` are sent (OAuth client-credentials)
and only `verification_status: SUCCESS` may reach the books (security finding
**C-1**, fixed 2026-11-01; module `src/webhook-verify.ts`, tests `tests/webhook-verify.test.ts`).

- **Enforcement = `WEBHOOK_ID`** (the webhook id from the PayPal dashboard):
  set → **strict, fail-closed** — missing/forged headers, non-200 or a timeout
  ⇒ `401` and the event is NOT stored (PayPal retries non-2xx, so transient
  failures self-heal). Unset → the event is accepted **with a loud warning**
  in the log (deploy-safe default; never silently).
- Production: `WEBHOOK_ID=83733119MV984010C`; local dev: `2VN59522XH443900A` (ngrok).
- Live proofs: forged POST → `401` + `REJECTED (missing-headers)`, forged-but-well-formed
  headers → real verify call → `401` + `REJECTED (failure-status)`, ledger rows unchanged.
## Enforcement map

| Rule | Enforced at | Verified by |
|---|---|---|
| 1 | `src/guards.ts` `enforceActionPolicy` + ECB conversion in `src/fx.ts` (H-9) | stage 68 test: attempt > limit → BLOCKED; `tests/fx.test.ts` pins €500 → ≈$558.60 → BLOCKED |
| 2 | Toolkit whitelist (`actions` config, ADR-004) + code guard | stage 69: 3 prompt attacks rejected |
| 3 | `agent_actions` insert-before-execute | stage 54: 24h of logs, no gaps |
| 4 | rate limiter in `src/reminder-ledger.ts` (atomic DB reserve, H-8) | stage 64: 8/8 + concurrent double-send = one call (suite71/71) |
| 5 | `.env.example` + **CI secrets step** (`.github/workflows/ci.yml`, H-9) + input sanitation | stage 121: 0 key hits; CI runs the tracked-file grep on every push/PR |
| 6 | webhook signature verification (`src/webhook-verify.ts`) | live: forged POST → 401, rows unchanged (188→188) |
| 1–3 | agent loop choke point (`src/agent.ts` `guardAgentTool`, finding H-1) | stage73 real DRAFT→SENT 5/5; blocked paths unit-tested (40/40) |

## Rule 7 — Token-gate the state-changing endpoints

`/api/action` (a REAL reminder email / a REVIEW→MATCHED book change),
`/api/recon/run` (writes records) and `/api/negotiate` (LLM quota) are gated by
`ACTION_TOKEN` (security finding **C-2**, fixed 2026-11-01; module `src/api-auth.ts`,
tests `tests/api-auth.test.ts`): with the token set, requests must carry
`Authorization: Bearer <token>` or `X-Action-Token: <token>` (length-safe compare)
⇒ otherwise `401`. With it unset the endpoints work but log a LOUD warning on every
call (deploy-safe default, same pattern as Rule 6). The hosted keyless demo surfaces
stay public on purpose — an explicit hackathon requirement (R6): `/`, `/health`,
`/api/app-config`, `/api/recon/rows`, `/api/nl-filter`, `/api/explain`.
## Rule 8 — Minimize public data; allowlist CORS

`/api/recon/rows` is the product's public sandbox ledger (an explicit demo
surface), but it ships **minimized** data (security finding **C-3**, fixed
2026-11-01): EVENT rows never include the raw webhook payload (buyer emails live
there — the column was removed from the response), emails in payment notes and in
`/api/explain` output are masked to `ab…@domain` (`src/public-rows.ts`).
CORS is an explicit allowlist (`src/cors.ts`): the service's own origin plus the
local UI origins out of the box, `CORS_ORIGINS` for anything else — a foreign
origin receives **no** `Access-Control-Allow-Origin` header, so browsers cannot
read responses cross-origin and preflights fail (mutations additionally require
the Rule-7 token). Verified live: evil origin → no header; localhost:3001 → echoed.
## Rule 9 — Dependency supply chain

Both lockfiles are kept advisory-clean by **measured upgrades** (finding **C-4**
fixed 2026-11-01): `npm audit` before/after recorded in
`evidence/2026-11-01-security-c4-dependencies.md`; root audit is **0 vulnerabilities**
(was12) and web has **0 critical/high** (was20) — Next.js is on16.4.3 (patched
SSG/ISR cache-poisoning, image-optimization SSRF and Draft-Mode GHSA cluster).
Policy: never `audit fix --force`; every override or major bump is kept only after
the real probe battery stays green (tsc, unit tests, dry-run E2E, live LLM probe,
live PayPal SDK call); residuals are registered with reachability reasoning.
**CI enforces it** (H-10): `npm audit --audit-level=high` on BOTH lockfiles, the Next
app is linted (`eslint`) and compiled (`next build`) in CI, plus the tracked-file
secrets scan — a new critical/high advisory or a web build break fails the pipeline.
## Rule 10 — Bound optional AI proxies

The AG Studio assistant proxy (`web/app/api/ai/responses`, security finding **C-5**
fixed 2026-11-01) may forward to OpenAI with the server key only behind
`web/lib/ai-limits.ts`: **local-only** (Origin AND Host must be localhost/127.0.0.1;
an evil page in the browser carries its own Origin and text/plain POSTs skip the
preflight — that is the credit-burn vector) and **bounded** (streamed read capped at
64 KB with a Content-Length pre-check, `messages` ≤50 entries, model allowlist,
`max_output_tokens` cap). The key is absent from fresh clones, the assistant UI
stays hidden without it, and a non-local Host gets `503` — deploying web/ cannot
silently expose the proxy. Live probes: evil/`null`/foreign Host →503,70 KB →413,
51 messages →400, valid+unconfigured →503, dashboard →200.
*If a rule and a feature conflict, the rule wins. Report the conflict in `DECISIONS.md` as a new ADR.*
