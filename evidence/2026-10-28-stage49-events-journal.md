# Evidence — stage 49 (events journal: raw storage + dedupe)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: 10 events in events table — PASS (23 present)
- webhook_events: 23 rows, ALL with raw payload_json retained (72..2977 bytes):
  INVOICING.INVOICE.CREATED/SENT/PAID/UPDATED + PAYMENT.CAPTURE.COMPLETED
- Dedupe by paypal_event_id UNIQUE verified on a REAL redelivery:
  POST /v1/notifications/webhooks-events/{id}/resend -> HTTP 202 -> event delivered
  again to /webhook (last log line = resent PAYMENT.CAPTURE.COMPLETED WH-1VJ000...),
  row count stayed 23 -> duplicate rejected, append-only journal intact. PASS
- All rows process_status='processed'; invalid-JSON path returns 400 without a row
  (by design: malformed payloads are not persisted, only logged in NDJSON).
- Note: first resend attempt returned 415 (missing Content-Type: application/json);
  second attempt with proper header -> 202.
