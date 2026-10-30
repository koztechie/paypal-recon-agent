# Evidence — stage 118 (PayPal webhooks → production URL)

Date: 2026-10-30 (plan date 09.11 — early)

## Current state (verified via PayPal REST with app credentials, secrets never printed)
- Existing **DEV** webhook: id `2VN59522XH443900A` →
  `https://uncorrupted-aubrielle-unhatingly.ngrok-free.dev/webhook`, **16 event types**.
- **No production webhook registered yet** (expected — this stage's manual step).

## The exact 16 event types (copy for the production registration)
```
CUSTOMER.DISPUTE.CREATED
CUSTOMER.DISPUTE.RESOLVED
CUSTOMER.DISPUTE.UPDATED
INVOICING.INVOICE.AUTOMATIC-REMINDER-SENT
INVOICING.INVOICE.CANCELLED
INVOICING.INVOICE.CREATED
INVOICING.INVOICE.PAID
INVOICING.INVOICE.REFUNDED
INVOICING.INVOICE.SENT
INVOICING.INVOICE.UNPAID
INVOICING.INVOICE.UPDATED
PAYMENT.CAPTURE.COMPLETED
PAYMENT.CAPTURE.DENIED
PAYMENT.CAPTURE.PENDING
PAYMENT.CAPTURE.REFUNDED
PAYMENT.CAPTURE.REVERSED
```

## Manual step (user): register the production webhook
1. `https://developer.paypal.com/developer/applications/` → sandbox REST app
   **hackathon-recon-agent**.
2. App page → section **Webhooks** → **Create Webhook**.
3. **URL:** `https://paypal-recon-agent.onrender.com/webhook` (exact, with `/webhook`).
4. **Event types:** search-and-check all16 names from the list above (paste one into
   the type search box, tick it, repeat).
5. **Create webhook.** (The resulting Webhook ID I will read myself via the API.)

## Automated verification protocol (runs after the user confirms registration)
1. Re-list webhooks → assert a SECOND webhook exists with the prod URL and16 types.
2. Trigger a real sandbox event from the dev stack: `createDraftInvoice`
   ($1.00, note "stage118 prod webhook test") → PayPal emits
   `INVOICING.INVOICE.CREATED`.
3. Poll production: `GET https://paypal-recon-agent.onrender.com/api/recon/rows?count=1`
   → must go `0 → ≥1`, and the rows must contain `kind: EVENT` with
   `ref: INVOICING.INVOICE.CREATED` and a production-side `received_at`.
   (Both webhooks are subscribed → the event is delivered to dev AND prod.)
4. Marker "an event from sandbox reaches production" = step3 PASS.
