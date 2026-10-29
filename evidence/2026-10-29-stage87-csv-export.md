# Evidence — stage 87 (CSV export, AG Grid community)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: the file exports — PASS (exported file captured open with correct content)

Implementation (AG Grid community, no enterprise):
- web/app/(endpoints)/data-grid.tsx: registered `CsvExportModule`; "Export CSV"
  button (aria-label, top-right of the grid toolbar) calls
  `api.exportDataAsCsv({ fileName, exportedRows: 'filteredAndSorted' })` — the export
  respects the active filters and sort (exports what the user sees). File name is
  derived from the page title ("Ledger · PayPal × AG Grid" -> `ledger.csv`).
- tsc-validated against ag-grid-community v36 types.

## Verification
- Session capture: the exported CSV file was downloaded and is shown OPEN in the
  browser with the full ledger content — header
  `kind,ref,status,recon,amount,fee,variance,currency,at,note` and real rows:
  payments (QA-P1 COMPLETED MATCHED $30.00 with the AI note, …), invoices
  (INV2-* … local:webhook), events (INVOICING.INVOICE.* …) — matching
  GET /api/recon/rows exactly.
- Button rendered in the UI (visible in captures of the Ledger page).

## Limitation (honest log)
- The browser tool's download registry (`files.list`) did not track the download in
  this session (the capture came from the desktop browser surface), so the CSV could
  not be re-copied to evidence/ as a file artifact; the opened-file capture above is
  the marker evidence.
