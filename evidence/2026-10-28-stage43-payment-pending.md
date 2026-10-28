# Evidence — stage 43 (buyer pays invoice) — IN PROGRESS

Date: 2026-10-28

## Verified so far
- Browser session IS logged into sandbox buyer account (sb-47zej153580381@personal,
  "JD" — standard sandbox name). Session persists from the user's manual login on 27.10.
- Buyer account activity shows both invoices: INV2-GJEB ($75, Unpaid) and INV2-ZKMY
  ($60, Unpaid, due 31.10).
- Pay flow CAN be started: JS-click on the "Pay" button of the INV2-GJEB row opens the
  "Pay with PayPal" checkout popup (sandbox.paypal.com/pay/checkout, signed one-time URL;
  do NOT reload it — reload kills it).

## Blocker (why automation stops here)
- PayPal's risk/telemetry XHR calls to c.paypal.com are CORS-blocked in this environment;
  payment-method widgets ("Pay with:" buttons) do not render on invoice pay pages, so the
  final "Pay Now" cannot be clicked programmatically. Console: CORS preflight failures +
  CSP nonce errors on the pay pages.
- No REST endpoint exists for a buyer to pay an invoice (three-legged OAuth required for
  buyer API actions; invoice pay is a UI-only flow). Balance check via API: blocked for the
  same reason (password grant requires redirect_uri flow).

## Balance BEFORE payment (from buyer Summary page)
- "Money is waiting for you $5,000.00 — Accept the Money" + completed transfer +$5,000 (Oct 26)
- Buyer may need to ACCEPT the pending $5,000 first so it becomes payable balance.

## Next: manual step by the user (instruction provided), then automated verification:
1. Accept the $5,000 (if shown pending).
2. Activity -> INV2-GJEB ($75) row -> Pay -> checkout popup -> PayPal balance -> Pay Now.
3. Report back; verification is automated: invoice status PAID (API), balance changed (UI
   screenshot or API), INVOICING.INVOICE.PAID webhook in logs/webhooks.ndjson.

## RESOLUTION (stage closed 2026-10-28)
- USER paid the $75 invoice manually via the sandbox UI (automation was blocked by
  CORS-blocked PayPal risk telemetry -> payment widgets did not render).
- VERIFIED:
  * Invoice INV2-GJEB-FRLW-T2SP-HV3M: status -> PAID (API get_invoice)
  * Webhook INVOICING.INVOICE.PAID received in local log 08:10:27Z
    (event WH-07908361YV899894G..., paid_amount 75.00 USD, due 0.00,
    SALE transaction 8YP9591221785673D, method PAYPAL)
  * Buyer activity: "Test Store -$75.00 Oct 28 - Invoice paid - Completed"
  * Funding source (user confirmed from transaction details):
    "Paid with CREDIT UNION 1 (x-2214)" — sandbox test BANK, PayPal balance NOT used
    (explains wallet showing $5,000.00 Available unchanged)
  * Buyer-side transaction ID: 18L10856WG118592W (payer: John Doe)
- MARKER NOTE: "balance changed" in the strict sense (PayPal-balance number) did NOT
  occur — funds moved from the linked sandbox bank. The full buyer payment cycle IS
  complete (money moved, invoice PAID, event captured). A balance-funded payment was
  deliberately NOT made on INV2-ZKMY: paying it would cancel the pending
  AUTOMATIC-REMINDER-SENT test (stage 42).
- Merchant reporting API lag: list_transactions showed 0 rows for Oct 27-28 (sandbox
  settlement lag; expected to appear later). Event + activity are authoritative.
