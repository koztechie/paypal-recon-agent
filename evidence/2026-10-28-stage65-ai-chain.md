# Evidence — stage 65 ★ (AI -> PayPal real chain: LLM decides, tool executes)

Date: 2026-10-28 (plan date 03.11 — early)

## Marker: E2E "LLM sees unpaid invoice -> sends reminder", zero manual steps — PASS (5/5)
Chain (src/agent-actions.ts runReminderAgent):
  list invoices -> priority sort (SENT, newest first) -> compute REAL days overdue
  from payment_term.due_date -> LLM decideReminder (real data) -> hard gate (ledger)
  -> sendInvoiceReminder executed.
Result of final run: invoice #<fresh> due 2026-10-25 -> decision REMIND
("unpaid and overdue by 3 days with no recent reminders") -> exec=true.
Older overdue invoices from previous attempts: WAIT ("reminder already sent in
the last 24 hours") — the 1/24h gate working inside the agent chain.
Protected stage-42 invoices (INV2-ZKMY, INV2-R7BT): untouched. PASS

## Four bugs found & fixed en route (all recorded to avoid re-work)
1. v2 PUT /invoices/{id} is a FULL REPLACE: it wiped primary_recipients AND items
   (=> send 422 "Missing recipient", amount became 0.00). Fix: PUT now resends
   primary_recipients + items + detail; verified status SENT after send.
2. sendInvoice did not recognize toolkit error shape {ok:false,status,code,message}
   (it checked only an "error" key) => silent false-success. Fixed centrally:
   parseToolResult now throws on BOTH shapes; all wrappers use it.
3. LLM invented a grace period ("3 days not yet overdue") => prompt now states:
   ANY days_outstanding > 0 is overdue, zero/negative => WAIT.
4. Harness ledger check matched invoice NUMBER while the ledger keys are invoice IDs.
Also: agent priority sorting (SENT, newest first) so the agent finds live work
among ~25 historical invoices.

## Leftovers (red list: no cancel/delete without a human)
- A few DRAFT test invoices from failed attempts remain in sandbox (harmless).
