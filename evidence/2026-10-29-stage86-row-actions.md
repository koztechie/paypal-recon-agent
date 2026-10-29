# Evidence — stage 86 (row actions: send reminder / mark matched -> PayPal call)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: button performs the action, status updates — PASS

Implementation (no privileged UI path — the same guarded code the agent uses):
- src/row-actions.ts (new):
  - sendRowReminder(ref): local invoice lookup -> refuses protected invoices
    (stage-42 subjects) and non-SENT statuses -> checkReminderAllowed pre-check ->
    sendInvoiceReminder() through the PayPal Agent Toolkit (REAL sandbox call;
    <=1/24h, <=3 lifetime, audit-logged).
  - markRowMatched(ref): only REVIEW records (DB CHECK forbids MATCHED without an
    invoice link — UNMATCHED answers with an honest refusal) ->
    resolveReconciliation() (decided_by='human', match_method='manual') + audit log.
- src/server.ts: POST /api/action { action: send_reminder|mark_matched, kind, ref }
  -> { ok, action, message } (guardrail refusals = ok:false with the reason).
- web/app/api/action/route.ts (new proxy). DataGrid detail panel: "Send reminder"
  (INVOICE + SENT) and "Mark matched" (PAYMENT + REVIEW) buttons with busy state,
  result line (green/red, aria-live), then router.refresh() so the server-rendered
  grid shows the new status; the open panel re-syncs to the refreshed row.

## Functional verification

| Step | Result | Verdict |
|---|---|---|
| API: mark_matched QA-P2 (REVIEW) | ok:true; /api/recon/rows shows recon=MATCHED for QA-P2 | PASS |
| API: send_reminder INV2-EVJE-R67N-R7Y3-5ADM (SENT) | ok:true — "PayPal accepted; rate limits and audit trail applied" (real sandbox transmission) | PASS |
| API: immediate second send_reminder (same invoice) | ok:false — "BLOCKED: 24h limit reached (1/day)" | PASS |
| agent_actions audit trail | mark_matched PASS/executed; send_invoice_reminder PASS/executed + the BLOCKED attempt logged | PASS |
| UI: click REVIEW row QA-P4 -> "Mark matched" | note "Marked MATCHED — decided_by=human…"; after refresh the QA-P4 cell shows MATCHED with the green pp-st-matched class | PASS |
| UI: click SENT invoice INV2-EVJE… -> "Send reminder" | panel shows "BLOCKED: 24h limit reached (1/day)" (guardrail visible in the UI, no new side effect) | PASS |

- Screenshot artifact again blocked ("needs a visible tab"); session captures show the
  panels with the buttons; DOM assertions above are the machine-checkable evidence.
