# Evidence — stage 62 (agent action #1: payment classification 10/10)

Date: 2026-10-28 (plan date 03.11 — early)

## Marker: 10/10 test payments classified correctly — PASS
Classes: PAID | PARTIAL | FOREIGN | MISMATCH (stage-19 wording).
Ground truth cases over 4 open invoices (9001 $30, 9002 $40, 9003 EUR50, 9401 $52.25):
  C1 exact ref+sum+currency        -> PAID
  C2 underpay 35 vs 40             -> PARTIAL
  C3 no ref, unique amount match   -> PAID   (mirrors engine rule amount_buyer)
  C4 currency USD vs EUR           -> MISMATCH
  C5 no ref, no match              -> FOREIGN
  C6 reference 7777 does not exist -> FOREIGN
  C7 overpay 55 vs 52.25           -> MISMATCH
  C8 exact by ref+sum              -> PAID
  C9 half payment                  -> PARTIAL
  C10 GBP, no usable match         -> FOREIGN
All reasons cite exact numbers/currencies (sample outputs in run log).

## Mechanism (src/actions.ts)
- classifyIncomingPayment(payment, openInvoices) via chat() (temperature 0,
  strict JSON {"class", reason}, code-fence tolerant parser, class validation).
- Prompt defines NO-ref unique-amount rule consistent with the deterministic
  reconciliation engine (caught & fixed a prompt/truth mismatch before the run).
