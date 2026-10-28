# Evidence — stage 48 (discrepancy edge cases: 8/8)

Date: 2026-10-28 (plan date 01.11 — early)

## Marker: 3 edge-case categories, statuses correct — PASS (8/8 checks)
E1 PARTIAL PAYMENT
  Invoice #9101 $80 (INV2-CYVS-SLEU-65Y3-VVSA); external CASH payment $30 recorded
  via record_payment_for_invoice (amount parameter) -> invoice status = PARTIALLY_PAID
  recon: QA-E1a $30 -> REVIEW variance -5000; QA-E1b $50 -> REVIEW variance -3000
  (documented per-payment engine behavior: both legs flagged for human resolution;
   sum-based clearing is a stage-49+ enhancement)
E2 MULTI-CURRENCY, BOTH DIRECTIONS
  #9102 $60 USD vs EUR payment -> REVIEW "currency mismatch: payment EUR vs invoice USD"
  #9103 EUR40 vs USD payment -> REVIEW "currency mismatch: payment USD vs invoice EUR"
  (no FX guessing: variance kept 0, human decides — SECURITY-consistent)
E3 COMMISSION/FEE
  #9104 $20 with fee $0.88 (gross 2000, net 1912) -> MATCHED variance 0
  (matching uses GROSS; fee preserved in payments row; net invariant amount=fee+net holds)

## Invoices used
9101 INV2-CYVS-SLEU-65Y3-VVSA | 9102 INV2-Z9FP-CVM5-PGY3-PRU2 |
9103 INV2-5Q47-Y5MD-C3FW-V3V5 | 9104 INV2-2WM8-K4FW-3NZY-2XTS

## Harness
- scripts/stage48.ts idempotent (QA-E* cleanup + invoice reuse by number).
