# Evidence — stage 63 (agent action #2: reconcile + LLM explanation)

Date: 2026-10-28 (plan date 03.11 — early)

## Marker: explanation generated for every case — PASS (4/4, all via=llm)
QA-X1 MATCHED   "Payment of $30.00 USD for invoice number 9001 matched your records perfectly. No further action is needed."
QA-X2 REVIEW    "…amount is 5.00 USD less than expected. Please check…"
QA-X3 REVIEW    "…payment currency (EUR) does not match the invoice cu[rrency]…"
QA-X4 UNMATCHED "…could not find an open invoice to match it against. Please check…"
Each: deterministic engine first (stage-47 rules), then LLM narrative REPLACES the
rule-based ai_explanation; fallback keeps the rule text if the LLM fails.

## Mechanism
- src/actions.ts: explainReconciliation(input, fallback) — strict prompt (1-3 sentences,
  exact numbers, no markdown/JSON), temperature 0, sanity checks (length, no braces).
- Harness (scripts/stage63.ts): 4 synthetic payments over real sandbox invoices
  9001/9002/9003 (from stage 47) -> engine -> local invoice upsert (FK) -> LLM -> UPDATE.

## Fix during the run
- CHECK constraint "invoice_id IS NOT NULL OR status='UNMATCHED'": harness INSERT now
  upserts the local invoice row first (same policy as the engine) — the schema guard
  caught the missing FK honestly.
