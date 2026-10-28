# Evidence — stage 45 (recordPayment; refund stays blocked)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: test recording passed — PASS
- Flow (npm run stage45):
  draft INV2-YEBP-YAPB-WENV-D7VP ($25) -> sent -> record_payment_for_invoice
  (payment_date 2026-10-28, method CASH, note) -> external payment id EXTR-64090191KC650952F
  -> invoice status = MARKED_AS_PAID  PASS
- Semantic fact: PayPal distinguishes PAID (payment processed through PayPal) from
  MARKED_AS_PAID (external/offline payment recorded manually). Both = nothing due.
  (schema.sql already knew MARKED_AS_PAID from stage 17.)

## Guardrail negative test (SECURITY red list)
- getTools() exposes 18 tools; refund/cancel/delete/accept-dispute: ABSENT.
  Attempt to expose record_refund_for_invoice/create_refund => blocked by whitelist
  (config-level, ADR-004/006). Script asserts absence before running the flow.

## Notes
- INV2-ZKMY ($60) deliberately untouched: it is the stage-42 auto-reminder test subject.
- CI: push -> lint + tsc success.
