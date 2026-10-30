# Evidence — stage 120 (AI chain on production: AI action on the public URL)

Date: 2026-10-30 (plan date 09.11 — early)
Target: `https://paypal-recon-agent.onrender.com`

## Marker: an AI action executes on the public URL — PASS (two actions, over the same E2E data)

### AI action 1 — natural-language query (stage-84 feature) on prod
```
POST https://paypal-recon-agent.onrender.com/api/nl-filter
{"query":"matched payments over $40"}
→ {"filter":{"kind":"PAYMENT","recon":"MATCHED","amountMin":40},"source":"llm","ms":1036}
```
Grounding cross-check against the REAL prod rows: the filter selects exactly
`EXTR-4RJ15778M0364683J` ($45.00/MATCHED) — the E2E payment — and nothing else → **PASS**.

### AI action 2 — explanation of the E2E payment row (stage-85 feature) on prod
```
POST /api/explain {"kind":"PAYMENT","ref":"EXTR-4RJ15778M0364683J"}
→ ok, source=llm, ms=892
"Payment EXTR-4RJ15778M0364683J achieved a MATCHED reconciliation status because its
 amount of $45.00 USD successfully matched invoice E2E-120-AI2 with a variance of $0.00.
 Both the payment and the linked invoice share the exact same monetary value and
 timestamp window."
```
Content checks: MATCHED ✓ · $45.00 ✓ · invoice number `E2E-120-AI2` ✓ (the method
token wording differs — phrasing, not substance).

### The cycle beneath the AI actions (fresh, post-fix build)
`INV2-C4UU-96EW-KC75-PV5J` (E2E-120-AI2, $45, SENT) → record payment → real
`INVOICE.PAID` to prod → `POST /api/recon/run` → **MATCHED** → final prod rows:
`PAYMENT EXTR-4RJ15778M0364683J $45.00 MATCHED` + `INVOICE … amount=45.00` + 3 EVENTs.

## Root cause found & fixed during this stage (honest log)
1. First explain on prod returned **"row not found"** — my own stage-119 evidence push
   had re-deployed the service and **wiped the ephemeral DB** (documented in stage 119).
   Re-ran the cycle on the fresh build.
2. First explanation over live data was **self-contradictory**: "MATCHED by
   number_amount … no invoice was linked, no candidate invoices". Root cause:
   `upsertLocalInvoice` still inserted the placeholder "minimal row"
   (`total=0.00`, no `invoice_date`) — the same defect flagged as a curiosity in
   stage 119. **Fixed at the root**: reconciliation now carries the matched
   invoice's real facts (number/total/status/issued_at) into the upsert, `InvoiceLite`
   gained `issued_at` from `invoice_date`, and the explanation prefers
   `reconciliation_records.invoice_id` for the linked invoice. Prod proof after the
   fix: invoice row shows **amount=45.00** and the explanation names
   **E2E-120-AI2** (before/after contrast above).
3. Gates before the push: biome 0, tsc 0, tests 1/1; local explain coherent.

## Operational rule (reconfirmed)
Every push re-deploys and wipes prod data → capture proofs BEFORE the evidence push;
a clean-slate ledger after that is acceptable (and demo-friendly).
