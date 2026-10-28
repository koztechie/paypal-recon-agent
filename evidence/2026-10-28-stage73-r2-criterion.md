# Evidence — stage 73 ★ (phase criterion R2: AI substantively in the loop)

Date: 2026-10-28 (plan date 05.11 — early)

## Marker: video proof — LLM decision -> action -> status changed — PASS (5/5)
Video: evidence/2026-10-28-stage73-ai-loop.mp4 (h264, 1516x776, 59.9s <=60, ~334 KB)
Terminal-recorded, zero manual steps after start:

  STEP 1  create invoice #<fresh>        -> status BEFORE: DRAFT
  STEP 2  agent (LLM function-calling)   -> decision: tool call [send_invoice ok=true]
          LLM final: "Invoice #NNN ... was successfully sent to the buyer."
  STEP 3  verify in PayPal               -> status AFTER: SENT

Checks 5/5: started DRAFT / LLM chose send_invoice / executed OK /
status CHANGED DRAFT->SENT / LLM confirmation line present.

## Why this satisfies R2 (Rules: "meaningfully incorporate AI")
- The DECISION (which tool, with which args, right now) is the model's;
- PayPal state changes only BECAUSE of that decision;
- guardrails remain external (whitelist + guards), the model cannot bypass them.
