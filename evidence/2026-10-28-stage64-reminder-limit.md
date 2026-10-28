# Evidence — stage 64 (agent action #3: reminder with frequency limit)

Date: 2026-10-28 (plan date 03.11 — early)

## Marker: reminder never more than 1/24h (verified from log) — PASS (8/8)
LLM decision logic (hermetic synthetic cases):
  overdue, no reminders -> REMIND | reminded-in-24h -> WAIT | paid -> WAIT
Real flow (fresh invoice #<time-based>, $48):
  1st reminder -> sent; ledger entries = 1
  immediate 2nd attempt -> gate BLOCKED ("24h limit reached (1/day)")
  ledger entries STILL 1  => no more than once/day, proven from the LOG
Audit trail (agent_actions): PASS+executed=1 row AND BLOCKED+executed=0 row.

## Mechanism
- src/actions.ts: decideReminder() — LLM decision REMIND|WAIT (strict JSON,
  rules baked into the prompt: paid/cancelled/24h/3x-lifetime => WAIT).
- Enforcement remains the hard ledger gate (src/invoicing.ts): LLM desire
  never overrides SECURITY rule 4; the gate logs BLOCKED attempts too.
