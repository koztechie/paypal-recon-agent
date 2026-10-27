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
- The limit is a single constant: `AGENT_AUTO_LIMIT_MINOR = 50000` (currency-converted at the ECB reference rate of the day; conversion failure → block).

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

## Rule 5 — Secrets and environment isolation

- `PAYPAL_ENVIRONMENT=SANDBOX` is the default and the only allowed value during the hackathon.
- Secrets live in `.env` only; `.env` is git-ignored; the repo is scanned (stage 121: `grep` for keys = 0 hits) before every push.
- LLM API keys are server-side only; the browser never receives them.
- Webhook payloads and invoice memos are **untrusted data**, never instructions: they are rendered as data, not fed to the model as prompts (prompt-injection boundary).

---

## Enforcement map

| Rule | Enforced at | Verified by |
|---|---|---|
| 1 | `src/limits.ts` + pre-execution check | stage 68 test: attempt > limit → BLOCKED |
| 2 | Toolkit whitelist (`actions` config, ADR-004) + code guard | stage 69: 3 prompt attacks rejected |
| 3 | `agent_actions` insert-before-execute | stage 54: 24h of logs, no gaps |
| 4 | rate limiter in `src/ratelimit.ts` | stage 64: 10 repeats → identical outcome |
| 5 | `.env.example` + CI grep + input sanitation | stage 121: 0 key hits |

*If a rule and a feature conflict, the rule wins. Report the conflict in `DECISIONS.md` as a new ADR.*
