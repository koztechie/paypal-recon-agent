# Evidence — stage 55 (API errors: retries, clear messages, no state loss)

Date: 2026-10-28 (plan date 02.11 — early)

## Marker: network-off test — recovery without manual intervention — PASS (9/9)
T1 outage->recovery: 2 simulated "fetch failed" then success -> 3rd attempt OK, no manual step
T2 persistent outage: ECONNREFUSED -> ApiError(kind=transient, attempts=3, bounded), message clear (<300 chars, no stack)
T3 validation (400/VALIDATION_ERROR): EXACTLY 1 attempt (never retried), field details preserved (term_type)
T4 auth (401): 1 attempt, kind=auth
T5 no state loss: failed attempts remain executed=0 in agent_actions (log-before-execute invariant)
T6 success passthrough unaffected
T7 classifier: 429->transient, 400->validation, ENOTFOUND->transient

## New code
- src/retry.ts: classifyError (order: transient -> auth -> validation -> unknown;
  PORT NUMBERS like :443 must not match 4xx — caught during test design),
  withRetry (exponential backoff 400ms*2^n, retry ONLY transient, bounded attempts,
  agent_actions BLOCKED row on terminal failure), ApiError with kind+attempts.

## Note
- Deterministic simulation instead of real network manipulation (no touching
  the live tunnel/server; the real outage of 27.10 already proved end-to-end
  behavior — and stage54's audit backfilled its log gaps).
