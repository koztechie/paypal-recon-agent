# Evidence — stage 44 (PAYMENT.CAPTURE.COMPLETED -> SQLite payments row)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: row in payments table — PASS
- Event: PAYMENT.CAPTURE.COMPLETED (WH-1VJ0005549394913F-36L72090YR316505E, 08:40:09Z)
- payments row:
  paypal_payment_id=12670908EV615762J, currency=USD, amount_minor=1000 ($10.00),
  fee_minor=84 ($0.84), net_minor=916 ($9.16), status=COMPLETED, source=webhook
- webhook_events table: 2 rows (TEST-DB-1 + capture event), dedupe by paypal_event_id works

## How the trigger was produced (full chain)
1. create_order via Toolkit -> order 5XM16640KE569031A (PAYER_ACTION_REQUIRED)
   - create_order flat schema: currencyCode, items[{name,itemCost,quantity,itemTotal}],
     returnUrl+cancelUrl REQUIRED, discount/shippingCost/shippingAddress optional.
2. Buyer approved via UI (user click; automation blocked by the same CORS risk-telemetry
   issue as stage 43; checkout page stuck at "Loading..." for automation).
3. pay_order (capture) via Toolkit -> order COMPLETED -> webhook fired -> DB row in 15s.

## Infrastructure built (permanent)
- src/db.ts: node:sqlite (built-in, ZERO new deps), data/recon.db (WAL), schema.sql applied
  idempotently; insertWebhookEvent (append-only + dedupe), insertPaymentFromEvent
  (minor units conversion, ON CONFLICT DO NOTHING).
- server.ts: POST /webhook -> NDJSON log + webhook_events + payments for PAYMENT.* events.
- data/ added to .gitignore.

## CI
- Push 1db48b1 -> lint + tsc: success.
