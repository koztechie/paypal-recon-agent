# Evidence — stage 40 (draft invoice via Agent Toolkit)

Date: 2026-10-28 (plan date 31.10 — early)

## Marker: invoice in sandbox with status DRAFT — PASS
- Tool: create_invoice (PayPal Agent Toolkit v1.11.0) via src/invoicing.ts helper
- Result: invoice id INV2-GJEB-FRLW-T2SP-HV3M, invoice_number 0006, status DRAFT
- Verified by get_invoice immediately after creation (npm run stage40)
- Sandbox buyer as recipient (SANDBOX_BUYER_EMAIL)

## Files added
- src/invoicing.ts: createDraftInvoice(tools, input) — reusable for stages 40-45
- scripts/stage40.ts (npm run stage40): asserts status === DRAFT

## Toolkit findings (recorded to avoid re-work)
1. Tool execute() returns a JSON STRING (runner JSON.stringify) — parse before use.
2. QUIRK v1.11.0: create_invoice returns ONLY the self link {rel, href, method},
   NOT the invoice body (direct REST returns the full body). Workaround implemented:
   extract id from href -> call get_invoice for the full record incl. status.
3. create_invoice params are FLAT (simplified) except primary_recipients[] (billing_info/
   shipping_info) and items[] (unit_amount {currency_code,value} etc.) — zod schemas
   inspected from the installed package.

## Cleanup note
- Debug probes created draft invoices INV2-NPBU-C9FB-FPMT-EKXC, INV2-LA2W-W5EB-NR8J-NLVL,
  INV2-... (Raw probe) in sandbox — harmless drafts; delete allowed only by a human
  (SECURITY.md red list), so they stay.

## CI
- Push 1c4137e -> lint + tsc: success.
