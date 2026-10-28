# Evidence — stage 66 (agent action #4: daily summary from a day of data)

Date: 2026-10-28 (plan date 04.11 — early)

## Marker: report generated from a day of data — PASS (7/7)
Real SQL stats for 2026-10-28:
  payments=25, matched=14, review=8, unmatched=3, webhook events=94, reminders=4
LLM report (via=llm, numbers verified against SQL):
  "...25 total payments, 14 matched..., 8 items in review..., 3 completely unmatched.
   Total matched amount $731.29, absolute variance $125.00. 94 webhook events,
   4 payment reminders dispatched."
Checks: real data / report / payment count / matched count / discrepancy wording /
plain paragraph (no markdown) / yesterday computable = 7/7

## Mechanism (src/report.ts)
- collectDailyStats(): SQL over payments/reconciliation_records/webhook_events/
  agent_actions filtered by date (UTC, matches datetime('now') storage).
- dailySummary(): numbers ALWAYS from SQL; LLM only renders the paragraph
  (temperature 0); sanity check (must include the payment count) else deterministic
  template fallback. Cadence: once/day (stage-19 action table).
- Note: backfilled webhook rows carry their DB insert date (received_at=now at
  insert), so 2026-10-27 shows zeros in the DB view — NDJSON holds original times.
