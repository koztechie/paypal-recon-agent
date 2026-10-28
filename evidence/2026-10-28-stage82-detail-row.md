# Evidence — stage 82 (detail row: click → invoice/payment details)

Date: 2026-10-28 (plan date 06.11 — early)

## Marker: details open — PASS (functional DOM verification, 3 scenarios)

Implementation (Community-compatible; AG Grid v36 has no free Master Detail):
- web/app/(endpoints)/data-grid.tsx: clicking a row opens a detail panel below the
  grid — title (`KIND · ref`), every field of the row as label/value pairs, and a
  pretty-printed `Raw webhook payload` block when the row carries one.
  Close: `×` button, clicking the same row again (toggle), Escape key.
  Selected row is highlighted (`row-detail-selected` via `getRowClass` + redraw).
- AG Grid v36 modular grid: added `RowApiModule` (api.redrawRows) and
  `RowStyleModule` (getRowClass) to the registered modules — v36 throws error #200
  without them (found via console + rebuilt).
- src/server.ts: /api/recon/rows enriched — payments now include `net`,
  events include full `payload` (webhook_events.payload_json).
- web/app/globals.css: `.ag-row { cursor: pointer }` + selected-row highlight.

Functional test (prod build `next build` + `next start`, DOM assertions):

| Scenario | Result | Verdict |
|---|---|---|
| Click first PAYMENT row | Panel `PAYMENT · QA-P1`, fields: kind, ref, status, recon, amount, fee, net, variance, currency, at, note (11) | PASS |
| Row highlight | `.ag-row.row-detail-selected` on the clicked row (count 1) | PASS |
| Click same row again | Panel closes, highlight removed (count 0) | PASS |
| Filter kind=EVENT → click EVENT row | Panel `EVENT · INVOICING.INVOICE.UPDATED` + `pre` with pretty JSON payload | PASS |
| Close button `×` | Panel closes | PASS |

## Incidents (honest log)
1. Next DEV-mode hydration became unreliable post-restart: streamed content stayed
   hidden (`Loading PayPal data…`) on most fresh tabs although the document contained
   all data and CPU was idle. Switched web/ to a PROD build (`next build` +
   `next start`, :3001) — also validates the exact bundle judges will run.
2. Browser infra: hydration on the managed browser surface takes ~75 s when the tab
   is focused; `browser.screenshot` fails with "needs a visible tab" whenever the
   Review-pane desktop window is hidden — screenshot artifact blocked this run;
   DOM assertions above are the marker evidence. (Earlier session captures of the
   rendered panel were seen in the review pane.)
3. Browser tab model: all browser tools act on ONE shared visible surface;
   tabs.open(focus) navigates it. Always verify `location.href` via evaluate before
   interpreting DOM results.
