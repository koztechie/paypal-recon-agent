# Finding H-1 — agent loop enforced through the same guardrails (and a caught regression)

Date: 2026-11-01 · Finding: `runAgentTurn` executed whitelisted tools **raw**
(no `enforceActionPolicy` / `checkReminderAllowed`); callers were the stage 61/69/73
scripts, but README claims the chain `tool call → guardrail → PayPal → audit` — a
latent $500/reminder bypass waiting for product wiring.

## Fix (choke point — the loop now IS the claim)
- `guardAgentTool()` runs **before every execution**, in order:
  1. `send_invoice_reminder` → `checkReminderAllowed` (24h/lifetime ledger; denial
     audited `BLOCKED` and returned to the model);
  2. money amount extraction (`record_payment_for_invoice.amount`,
     `create_invoice.items[]×qty` → minor units) — **NaN → fail-closed BLOCK**;
  3. `enforceActionPolicy` (auto-limit $500 + red list; every decision audited);
- on success → `markAgentActionExecuted` (audit flips `executed=1`, same as the
  product wrappers); refusals are fed back to the model as `functionResponse`
  so it adapts (the zero-touch flow keeps working).
- `opts.chat` injection added — the loop is now testable without the network.

## TDD
Red first: the missing `chat` option failed `tsc` (`TS2353`) with the guards
unproven; green after wiring: **5 new tests** (>$500 blocked + model told;
≤$500 executes; unparseable amount fail-closed; rate-limited reminder blocked;
reads pass untouched) → suite **40/40**. Lesson: mocks needed a REAL zod schema —
`toolDeclarations()` prints JSON schemas from `_def`.

## The regression this work caught (honest log)
Re-running the REAL callers after the change surfaced a **C-4 regression**:
the `zod → 4.6.6` override silently broke `zod-to-json-schema@3.25` — every function
declaration reached Gemini with **NO properties** → the model sent `{}` args →
stage73 went **3/5** (`invoice_id: expected string, received undefined` × every step).
Diagnosed with a spy-`chat` replay showing the actual `functionResponse` errors.
Fixed:
- `zod-to-json-schema` dropped (no zod4-capable release exists) → **native zod4
  `toJSONSchema`** (declarations verified live:18 tools, `properties/invoice_id` present);
- zod4's `type:["string","null"]` normalized to `type + nullable:true` (Gemini's proto
  rejects repeated `type`) — confirmed with a live `PROBE-OK` against the API.
`npm audit` stays **0 vulnerabilities** (root).

## Final verification (all with unpiped exit codes)
| Gate | Result |
|---|---|
| lint / build / test | **0 / 0 / rc0 — 40/40** |
| stage61 (function calling) | **6/6** |
| stage69 (prompt attacks) | **6/6** — no forbidden tool, no fake success claims |
| stage73 (REAL zero-touch money) | **5/5 — DRAFT → SENT** through the guards |

**H-1 status: FIXED + VERIFIED (README claim now literally true).**
