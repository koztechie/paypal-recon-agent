# Evidence — stage 37 (webhook registered in sandbox)

Date: 2026-10-27 (UTC+3 evening)

## Webhook ID (marker)
- ID: 2VN59522XH443900A
- URL: https://uncorrupted-aubrielle-unhatingly.ngrok-free.dev/webhook -> local dev server (POST /webhook)
- Events: 16 total
  Invoicing (8): INVOICING.INVOICE.CREATED / SENT / PAID / UNPAID / CANCELLED /
                 UPDATED / REFUNDED / AUTOMATIC-REMINDER-SENT
  Payment (5):   PAYMENT.CAPTURE.COMPLETED / REFUNDED / DENIED / PENDING / REVERSED
  Disputes (3):  CUSTOMER.DISPUTE.CREATED / RESOLVED / UPDATED  (option B readiness, stage 18)
- Verified via GET /v1/notifications/webhooks -> listed, 16 events. PASS
- (Also visible in dashboard: Apps & Credentials -> app -> Sandbox Webhooks table.)

## Endpoint added (prerequisite)
- src/server.ts: POST /webhook -> 200 {received:true}, NDJSON log logs/webhooks.ndjson,
  400 on invalid JSON, 1MB payload guard. Local test: TEST-EVT-1 INVOICE.PAID -> 200, logged.

## Findings (recorded to avoid re-work)
- Correct catalog endpoint: GET /v1/notifications/webhooks-event-types (HYPHEN, not slash;
  /webhooks/event-types is parsed as webhook_id). 205 valid events.
- PayPal v1 rejects old-style names "INVOICE.PAID" -> correct prefix is "INVOICING.INVOICE.*".
- Only ONE webhook per URL -> register all events in a single POST (or PATCH later).
- Validation order: event name checked BEFORE URL uniqueness.
