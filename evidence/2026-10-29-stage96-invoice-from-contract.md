# Evidence — stage 96 ★ (agreement -> invoices.create through the core shell)

Date: 2026-10-29 (plan date 07.11 — early)

## Marker: invoice created with the agreement's terms — PASS (8/8 checks)

Full pipeline in one run (`npm run stage96`):
```
agreement: SETTLED at 450.00 in 3 rounds
contract:  CNT-20261029-896a85 — total 450.00 USD, net_days 7d
invoice:   INV2-CJ6Z-DRBH-UDMA-N3LM (CNT-20261029-896a85) amount=450.00 USD
           to sb-47zej153580381@personal.example.com
audit:     PASS / executed=1
```

| Check (against PayPal's own get_invoice) | Result |
|---|---|
| invoice exists on PayPal | OK |
| amount == contract total | OK |
| currency matches | OK |
| invoice_number == contract id | OK |
| buyer email present in invoice | OK |
| note carries contract terms | OK |
| total matches the agreed price | OK |
| audit-logged with limit_check PASS | OK |
| **MARKER_INVOICE_FROM_CONTRACT** | **PASS** |

## Implementation
- src/contract.ts: `createInvoiceFromContract(tools, contract)` — first re-validates
  the contract (invalid or buyer_email-less contracts are refused — stage-98 rule),
  then calls **`createDraftInvoice()` — the same guarded core shell the agent uses**
  (audit `agent_actions`, enforceActionPolicy $500 auto-limit inside; $450 passes).
  The agreement's terms land on the invoice: total/currency (price), subject
  (`10 × cross-border reconciliation report (contract CNT-…)`), contract id as
  `invoice_number`, net-7 terms in the note together with the LLM summary.
- Contract gained `parties.buyer_email` (optional in the validator, required by the
  invoice link — SANDBOX_BUYER_EMAIL, the stage-40 convention).
- scripts/stage96-invoice.ts (`npm run stage96`): negotiate -> contract -> invoice ->
  verify against PayPal + audit trail; exit code = marker.

## Defect found & fixed (honest log)
- First run: 7/8 — `invoice_number == contract id` FAIL. The invoice on PayPal was
  CORRECT; my check read `full.invoice_number`, but the Toolkit's get_invoice nests
  it under `full.detail.invoice_number`. Fixed the CHECK (not the data) and reran:
  8/8. Debug output proved `detail: {"invoice_number":"CNT-20261029-525438", …}`
  for the first run's invoice too.
- Two sandbox invoices exist from this stage (first run + verification rerun):
  INV2-BMR5-H7W3-6ZJF-BCLT, INV2-CJ6Z-DRBH-UDMA-N3LM — both $450, both linked to
  their contract ids; sandbox only, harmless.
