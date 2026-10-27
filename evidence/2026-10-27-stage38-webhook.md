# Evidence — stage 38 ★ (first webhook received locally)

Date: 2026-10-27 (UTC+3, ~21:50)

## Marker: event JSON in log + screenshot — PASS
- Trigger: created real invoice INV2-HMRF-4JVX-WRNZ-287Y via POST /v2/invoicing/invoices
- Event: INVOICING.INVOICE.CREATED
- PayPal event id: WH-7NS99596R97742140-11154362XK984303U
- Delivery: 25 s after invoice creation
- Route: PayPal sandbox -> ngrok tunnel -> POST /webhook (local :3000) -> logs/webhooks.ndjson
- Log line: 2580 bytes, full resource payload (invoice, items, amount breakdown, links)
- Screenshot: evidence/2026-10-27-stage38-webhook.png (1150x2636 PNG, rendered from the log)
- Prior local TEST-EVT-1 line archived out of the log before triggering (honest marker)

## Invoice API schema learnings (for stage 41)
- Item field is `unit_amount` (NOT `unit_price`).
- `detail` object is required and needs `currency_code`.
- CREATE -> 201 OK with: recipient + items + detail.
- SEND -> 422 MISSING_RECIPIENT_EMAIL: although recipient.email was sent in create,
  the created resource shows no recipient -> investigate field placement / re-send body
  at stage 41 (send body may need `recipient_email` or invoice must be re-PUT with recipient).

## Screenshot tooling note
- browser.screenshot requires a visible desktop tab (not available in this session);
  headless chrome/firefox both crashed in this environment.
- Working method: PIL (DejaVuSansMono) render of the pretty-printed log -> PNG.

## Cleanup
- Temporary python http.server:8123 stopped.
- ngrok tunnel + dev server left RUNNING (needed for stages 39+).
