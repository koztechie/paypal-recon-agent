# Evidence — stage 85 (AI explanation of the selected row: why UNMATCHED)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: explanation appears in the panel — PASS

Implementation (anti-fragile: LLM over DB facts + deterministic fallback):
- src/explain.ts (new): explainLedgerRow(kind, ref). Builds an auditable fact sheet
  from SQLite — for PAYMENT: the payment, its reconciliation record (status,
  match_method, variance, reason), the linked invoice and up to 3 candidate invoices
  in the engine's +/-3-day window (with deltas); for INVOICE: the invoice + linked
  payments. The LLM (chat(), temperature 0.2) may only use these facts; the
  deterministic template built from the SAME facts covers timeout/error.
- src/server.ts: POST /api/explain { kind(PAYMENT|INVOICE), ref } ->
  { ok, explanation, source, ms } (CORS *; 400/404 on bad input / unknown row).
- web/app/api/explain/route.ts (new): Next proxy (one origin).
- web DataGrid detail panel: new "AI" block — auto-loads the explanation when a
  PAYMENT or INVOICE row is selected; shows "Explaining…", the text, a caption
  `YYYY-MM-DD HH:mm · via llm|fallback · N.Ns`, and a ↻ regenerate button; error
  state offers a retry. A stale-response guard prevents a late answer landing on a
  row the user has already left.

## Functional verification

| Case | Path | Result | Verdict |
|---|---|---|---|
| QA-P5 (UNMATCHED) via API | llm · 9.1s | "…no matching invoice was found… checked candidate invoices within a 3-day window and found none…" | PASS |
| EXTR-3BE85445H9887442N (MATCHED) via API | llm · 8.8s | "…matched by number and amount for $75.00 USD, variance $0.00…" | PASS |
| INV2-2345 (PAID invoice) in the panel | llm · 6.8s | Invoice status + linked payment explained; AI block rendered in the detail panel (captured in session screenshots) | PASS |
| QA-P5 forced timeout (deadline 1 ms) | fallback · 95ms | "UNMATCHED: payment QA-P5 ($55.00) was checked against 0 candidate invoice(s) in USD within +/-3 days…" | PASS |
| 12670908EV615762J under real LLM congestion | fallback after 14s deadline | Correct deterministic explanation — the fallback engages exactly when the queue is slow | PASS |

- Screenshots (session captures): detail panel for QA-P5 with the AI block showing
  the UNMATCHED explanation + "2026-10-29 00:11 · via llm · 8.4s"; invoice panel
  with its explanation. `browser.screenshot` stays blocked while the Review-pane
  window is hidden; DOM assertions and API responses above are the machine-checkable
  evidence.
