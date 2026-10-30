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

## VERIFIED (2026-10-30): marker PASS — sandbox event reached production

### Registration (user, PayPal dashboard)
| Webhook | ID | Events |
|---|---|---|
| `https://paypal-recon-agent.onrender.com/webhook` | **83733119MV984010C** | **16** (3 dispute + 8 invoicing + 5 capture) |
| dev ngrok (unchanged) | 2VN59522XH443900A | 16 |

Independent confirmation via PayPal REST: prod webhook exists with the exact URL
and 16 event types.

### End-to-end trigger (automated)
1. `createDraftInvoice` via the core shell → invoice `INV2-CMQN-S95T-9RQJ-JAJB`
   ($1.00, note "stage118 test…") → PayPal emits `INVOICING.INVOICE.CREATED`.
2. Poll `GET https://paypal-recon-agent.onrender.com/api/recon/rows?count=1`:
   - first attempt returned EMPTY — the **free instance had spun down**
     (Render warning: cold start up to ~50 s); lesson: poll with a ≥75 s timeout
     (and warm the instance before demos).
   - `poll 1 (retry): count=1`
3. Final read of the prod ledger:
   ```
   EVENT | INVOICING.INVOICE.CREATED | 2026-10-30 16:14:10
   ```

**Marker «Подія з sandbox досягає продакшну» → PASS.**
