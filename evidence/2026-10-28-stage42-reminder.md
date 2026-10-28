# Evidence — stage 42 (reminders) — PARTIAL: action done, event pending

Date: 2026-10-28 (plan date 31.10 — early)

## Done (under our control)
1. Manual reminder: send_invoice_reminder on INV2-GJEB-FRLW-T2SP-HV3M -> HTTP 204 OK
   at 07:05:41Z. Rate-limit ledger implemented: logs/reminders.json, limits 1/24h, 3/invoice
   (SECURITY.md rule 4), checkReminderAllowed() gate. Script: npm run stage42.
2. EMPIRICAL FACT: manual reminders emit NO webhook event at all (PayPal-side event list
   shows nothing after the reminder call). Only reminder event that exists:
   INVOICING.INVOICE.AUTOMATIC-REMINDER-SENT (from the 205-event catalog).
   -> ADR-012: whitelist += invoices.setupReminders.
3. Auto-reminder path: created due-dated invoice INV2-ZKMY-MVK3-AEMZ-QKP4
   (term_type DUE_ON_DATE_SPECIFIED, due 2026-10-31, $60), SENT; auto reminder configured
   BEFORE_DUE interval=3 days repetition=1 (computed fire day = today 28.10).
4. Side benefit: CREATED + SENT events for INV2-ZKMY received in local log ~1 min
   (tunnel alive; proves full pipeline again after the overnight outage).

## Pending (external dependency)
- AUTOMATIC-REMINDER-SENT has NOT arrived after 30+ min: PayPal sends auto reminders in
  batches (schedule unknown). Background watcher armed: /tmp/stage42-wait.sh polls the
  log every 90s for up to 12h, writes /tmp/stage42-watcher.done when found.
- Stage 42 marker ("подія reminder у лозі") closes when the event lands. Server + ngrok
  must stay up (they are running).

## Schema facts learned
- payment_term.term_type enum: DUE_ON_RECEIPT | DUE_ON_DATE_SPECIFIED (+ NET_* variants
  rejected here); invalid values -> 400 with "Cannot construct instance of TermType".
- setup_invoice_auto_reminders: configurations[] max 2: {type BEFORE_DUE|AFTER_DUE,
  interval {unit DAY, value int}, repetition int (1 for BEFORE_DUE), notification {...}}.
- toolkit execute() returns undefined for HTTP 204 responses -> parseToolResult() added
  (handles null/"" gracefully) in src/invoicing.ts.

## CI
- Push 648192f -> lint + tsc: success.
