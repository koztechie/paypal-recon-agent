# Evidence — stage 72 (LLM API down -> local rules, no LLM)

Date: 2026-10-28 (plan date 04.11 — early)

## Marker: disabled key -> system works on rules — PASS (5/5)
- LLM_API_KEY simulated invalid ("REPLACE_...") -> chat() fails fast (no HTTP waste)
- Classification WITHOUT LLM: 8/8 correct via rules (PAID/PARTIAL/MISMATCH/FOREIGN
  incl. no-reference unique-amount and ambiguous cases) — all marked "rules fallback"
- Reminder decisions WITHOUT LLM: overdue -> REMIND; 24h-limited -> WAIT (thresholds)
- Audit: 10 fallback rows in agent_actions (action llm_fallback:*,
  llm_decision carries the original error)
- Key restored in-process -> next classification ran LLM-first again (via=llm)

## New module: src/fallback.ts
- classifyPaymentRules(): exact mirror of the stage-62 prompt logic (reference,
  currency, under/overpay, unique-amount match, ambiguity)
- decideReminderRules(): status/24h/lifetime/days thresholds
- explainRules(): deterministic sentence templates (stage-63 fallback hardened)
- withFallback(label, llmFn, rulesFn): single wrapper — try LLM, fall back to
  rules, LOG the failure. Wired into classifyIncomingPayment + decideReminder.

## Design note
- Rules and prompts MUST stay in sync (tested both directions across stages 62/72).
