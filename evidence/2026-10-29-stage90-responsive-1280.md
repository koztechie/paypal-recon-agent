# Evidence — stage 90 (judge-screen responsiveness: 1280px, no horizontal scroll)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: screenshot at 1280px without cut-off — PASS

Screenshot: evidence/2026-10-29-stage90-1280px.png — exactly 1280x900, rendered by
a real browser (Firefox headless, separate profile) of the live production build:

- Header, description, search toolbar, "Ask the ledger" box and Export CSV all inside
  the viewport; the grid shows ALL NINE columns (Type, Reference, Status,
  Reconciliation, Amount, Variance, Currency, Date, Details) in 1216px of content
  width (page px-8 padding).
- No horizontal scrollbar: the bottom and right edges of the capture are uniform
  page background (checked programmatically: 1 distinct colour in both strips).
- Coloured statuses, currency formatting and row data render correctly at 1280px.

## What changed
- DataGrid: new `autoFit` prop (default true = previous fit-to-content behaviour for
  the other endpoint pages).
- reconciliation/page.tsx: `autoFit={false}` + explicit column widths summing to the
  1216px content box (Details takes the remainder via flex, minWidth 140):
  Type 105, Reference 205, Status 120, Reconciliation 150, Amount 105,
  Variance 105, Currency 95, Date 168, Details flex.
  Auto-fit to content pushed Date/Details past the viewport (internal grid scroll);
  fixed widths keep every column visible at the 1280px judge minimum.
- CSS audit: no page-level overflow sources (flex-wrap toolbars, max-w-4xl note,
  break-words in the detail panel, overflow-auto payload block, width-bounded grid
  box — the grid can only scroll internally, never the page).

## Method notes (honest log)
- `browser.screenshot` stayed blocked (Review-pane visibility) and the desktop
  browser session was disconnected, so the capture was produced with
  `firefox --headless --screenshot` on a dedicated profile.
- Firefox screenshots land before AG Grid paints its rows (deterministic timing):
  solved with a wrapper page whose load event is delayed by a local slow resource
  (/tmp/delay-server.py, 7 s) — the iframe with the app then has paint time.
- Chrome headless is unusable on this machine (packaging bug:
  "chrome_crashpad_handler: --database is required", no screenshot written).
- Known cosmetic limit: the Variance/Currency HEADERS show an ellipsis at 1280px
  (filter+sort icons take ~48px per column); their data cells fit fully.
