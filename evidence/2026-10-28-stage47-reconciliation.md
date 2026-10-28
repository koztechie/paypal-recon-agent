# Evidence — stage 47 ★ (auto-reconciliation 5/5)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: auto-reconciliation 5/5 — PASS
Test invoices (created+sent via Toolkit, reused across runs):
  #9001 $30 USD (INV2-EVJE-R67N-R7Y3-5ADM), #9002 $40 USD (INV2-6YK5-WRAX-BNTB-TCLP),
  #9003 EUR50 (INV2-RA3M-9BPL-QGKR-VQWZ)
Five incoming payments + engine result:
  QA-P1  $30 ref#9001         -> MATCHED    (number_amount, variance 0)
  QA-P2  $35 ref#9002         -> REVIEW     (variance -500: underpayment $5)
  QA-P3  EUR50 no ref         -> MATCHED    (amount_buyer: unique open EUR50)
  QA-P4  USD50 ref#9003 (EUR) -> REVIEW     (currency mismatch)
  QA-P5  $55 no ref           -> UNMATCHED  (nothing matches)
npm run stage47 -> "5/5 reconciliation pairs correct"

## Engine (src/reconcile.ts)
- Policy (stage-19): automatic MATCH only on exact agreement; everything else REVIEW/
  UNMATCHED. Rules: reference invoice_number -> number+amount+currency compare;
  no reference -> unique open (SENT/PARTIALLY_PAID) amount+currency match; ambiguity
  -> UNMATCHED with reason.
- reconciliation_records rows: status, match_method (number_amount|amount_buyer), variance
  in minor units, reason, ai_explanation (rule-based; LLM narrative at stages 59-65),
  decided_by='agent'.
- Upsert: matched PayPal invoice synced into local invoices table (FK integrity).
- reconcilePending(): processes only payments without a reconciliation row (incremental).

## Fixes during the run
- FK constraint caught a real design gap: reconciliation.invoice_id references the LOCAL
  invoices table -> upsertLocalInvoice added (sync-on-match).
- Harness made idempotent (QA-P* cleanup, invoice reuse by number).
