# Evidence — stage 91 ★ (phase criterion: the grid is a working seller's tool)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: scenario "open -> filter -> action -> status" passes — PASS (2 independent runs)

Driven by a real browser (Playwright + its own Chromium build — the system Chrome is
unusable on this machine), viewport 1280x900 (the judge's minimum, stage 90).
Full JSON log: evidence/2026-10-29-stage91-scenario.json (run 2; run 1 identical,
acted on QA-E1a instead of QA-E1b — repeatability).

| Step | What happened | Result |
|---|---|---|
| 1 open | /reconciliation loads: title "Reconciliation ledger", 139-rows label, grid painted | ok · 1.4–3.2 s |
| 2 filter | NL box "review payments" -> status line "kind=PAYMENT, recon=REVIEW — via fallback · 14.0s"; only PAYMENT/REVIEW rows remain (5–6 DOM rows) | ok |
| 3 action | click row -> detail panel -> "Mark matched" -> "Marked MATCHED — decided_by=human, match_method=manual, audit trail updated." | ok · 0.4 s |
| 4 status | Clear -> the acted row's Reconciliation cell reads MATCHED with the green `pp-st-matched` class (panel also shows recon: MATCHED) | ok · 1.8 s |

Screenshots (evidence/): `2026-10-29-stage91-1-open.png`, `-2-filter.png`,
`-3-panel.png`, `-4-status.png`.

## Honest notes
- The LLM missed its 14 s deadline at the filter step and the deterministic fallback
  produced the filter — the anti-fragile design the plan requires, observed live
  (the note shows "via fallback"; earlier runs showed "via llm").
- Side effect: the two runs genuinely resolved QA-E1a and QA-E1b (REVIEW -> MATCHED,
  human) — real data changes in the sandbox ledger, not test doubles; REVIEW rows
  E2a/E2b/X2/X3 remain for demos.
- Local Chromium hydrated the page in 1.4–3.2 s; the multi-minute hydration seen in
  the managed browser session was that environment's quirk, not the app's.
