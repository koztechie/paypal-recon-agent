# Evidence — stage 68 ★ (guards: amount limit, refund ban, decision log)

Date: 2026-10-28 (plan date 04.11 — early)

## Marker: big action attempt -> refusal + log entry — PASS (10/10)
T1 $900 create  -> BLOCKED: "amount 900.00 exceeds agent auto-limit 500.00 — human approval required (SECURITY rule 1)"
T2 refund $1    -> BLOCKED: "human-only ... on the red list (SECURITY rule 2)" (any amount)
T3 $50          -> PASS, executes
T4 constant     -> AGENT_AUTO_LIMIT_MINOR = 50000 ($500)
T5 REAL wrapper -> createDraftInvoice($999) refuses BEFORE any API call (defense in depth)
T6 logging      -> >=3 new agent_actions rows; BLOCKED rows carry reasons;
                   LLM/system decision text recorded (llm_decision field)

## New module: src/guards.ts
- enforceActionPolicy(action, amountMinor, {llmDecision, targetRef}) -> PASS|BLOCKED + reason
- guardedMoneyAction(): runs fn only when allowed; throws BLOCKED otherwise
- RED_LIST_ACTIONS: create_refund, record_refund_for_invoice, cancel_sent_invoice,
  delete_invoice, accept_dispute_claim, payouts

## Wired into real wrappers (src/invoicing.ts)
- createDraftInvoice: gate BEFORE the log row (single row with real PASS/BLOCKED)
- recordExternalPayment: same pattern
- All decisions logged via logAgentAction (rule 3: row before execution).
