# Evidence — stage 83 (reconciliation status column: MATCHED / UNMATCHED / REVIEW, coloured)

Date: 2026-10-28 (plan date 06.11 — early)

## Marker: statuses visible, coloured — PASS (computed-style verification)

Implementation:
- web/app/(endpoints)/data-grid.tsx: new column type `reconStatus` (client-side
  `cellClass` mapping value -> class) + registered `CellStyleModule`
  (AG Grid v36 modular grid; without it cell classes are ignored with error #200).
- web/app/(endpoints)/reconciliation/page.tsx: `recon` column now `type: 'reconStatus'`
  (plain data — page stays a server component).
- web/app/globals.css: status colours from the shared PayPal palette:
  MATCHED -> var(--pp-success) #00875a, REVIEW -> var(--pp-warning) #b45309,
  UNMATCHED -> var(--pp-danger) #c4122f, PENDING -> var(--pp-muted); all weight 600.

Functional test (prod build, /reconciliation, DOM + getComputedStyle):

| Status | Cell class | Computed color | Expected | Verdict |
|---|---|---|---|---|
| MATCHED | pp-st-matched | rgb(0, 135, 90) | #00875a | PASS |
| REVIEW | pp-st-review | rgb(180, 83, 9) | #b45309 | PASS |
| UNMATCHED | pp-st-unmatched | rgb(196, 18, 47) | #c4122f | PASS |

- All 27 rendered recon cells carry a status class; font-weight 600 (bold).
- Console clean (no AG Grid module errors).
- Screenshot artifact again blocked by the harness ("needs a visible tab" while the
  Review-pane window is hidden); computed styles above are the marker evidence.
