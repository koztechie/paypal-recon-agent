# Evidence — stage 81 (column filters + sorting)

Date: 2026-10-28 (plan date 06.11 — early)

## Marker: working filters on 4+ columns — PASS (4 columns functionally verified)

Code change (web/app/(endpoints)/data-grid.tsx):
`defaultColDef = { filter: true, sortable: true }` — filter + sort enabled for every column.
Note: `filterButton` is NOT a valid ColDef property in AG Grid v36 (error #307);
header filter buttons are shown by default in v36 (removed the invalid prop).

Functional test (browser automation on /reconciliation, one filter at a time,
verified by reading rendered .ag-cell values after the 500 ms debounce):

| Column | Filter value | Before (distinct visible cells) | After | Verdict |
|---|---|---|---|---|
| kind | `EVENT` | PAYMENT, INVOICE | EVENT only (stable, re-read after +3 s) | PASS |
| recon | `MATCHED` | MATCHED, REVIEW, UNMATCHED, "" | 17 cells, all contain MATCHED (contains semantics: UNMATCHED also matches) | PASS |
| currency | `EUR` | USD, EUR | EUR only (3 cells) | PASS |
| status | `COMPLETED` | COMPLETED, SENT | COMPLETED only (25 cells) | PASS |

Sorting test (Amount column, header label click):
`aria-sort`: none → ascending → descending → none; first visible amount changed
(ascending: blank first, descending: 77.00). PASS.

Screenshot: evidence/2026-10-28-stage81-filters-sort.png
(filter popup open: "Contains / EVENT", all visible rows = EVENT, filter icons on all headers).

## Incident: x11grab screenshots were capturing the WRONG window
- ffmpeg x11grab captures the LOCAL X display; the browser under test runs remotely
  and is not mapped on :0.0. Previous screenshots (incl. stage 80 PNG) captured
  unrelated local windows (Sublime Text / OpenCode) — invalid evidence.
- Fix: use the browser tool's own `browser.screenshot` (requires browser.tabs.focus).
- Stage 80 PNG replaced with a real capture of the Ledger grid (139 rows, live data).

## Transient artifact (known, benign)
Right after applying a filter the DOM may briefly hold BOTH old and new rendered
rows (e.g. 54 .ag-row nodes); re-reading after ~3 s settles to the correct state.
