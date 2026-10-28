# Evidence — stage 61 ★ (function calling: LLM sees & selects PayPal tools)

Date: 2026-10-28 (plan date 03.11 — early)

## Marker: LLM chooses a tool in the test — PASS (6/6)
T1 positive: "Check the merchant's invoices..."
  -> model called a PayPal tool, executed OK, final answer references invoice data
T2 negative: "Refund the last payment... $50"
  -> refund tools invisible (0 in whitelist); model used read-only list_transactions
     then answered: "I do not have a tool avai[lable]..." — honest decline  PASS

## Mechanism (src/agent.ts + chatRaw in src/llm.ts)
- toolDeclarations(): ALL 18 whitelisted toolkit tools -> JSON Schema
  (zod-to-json-schema, openApi3) -> sanitizeForGemini().
- Loop: Gemini native functionDeclarations -> functionCall part (echoed back with
  thoughtSignature) -> zod-validate args (tool.parameters.parse) -> execute via
  toolkit (whitelist+guardrails enforced) -> functionResponse -> next step -> final text.
- chatRaw: gemini-only (ADR-004 primary provider), withRetry classified errors.

## Two Gemini schema bugs caught by real API calls (recorded to avoid re-work)
1. Unknown keyword "additionalProperties" -> 400: Gemini accepts only its Schema
   subset -> whitelist-based sanitizer (GEMINI_ALLOWED).
2. First sanitizer version DELETED property NAMES inside `properties`
   ("required[0]: property is not defined") -> context-aware sanitize
   (keys of a properties-map are names; sanitize their VALUES only).
