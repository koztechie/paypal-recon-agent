# Evidence — stage 80 (grid data from OUR DB via REST)

Date: 2026-10-28 (plan date 06.11 — early)

## Marker: 50+ rows of live data in the grid — PASS (139)
- Backend: GET /api/recon/rows in src/server.ts (SQLite via getDb, CORS enabled):
  PAYMENT rows (payments LEFT JOIN reconciliation incl. ai_explanation + variance),
  INVOICE rows (locally synced), EVENT rows (raw webhook journal).
- API returns 139 rows: PAYMENT=25, INVOICE=16, EVENT=98.
- Frontend: web/app/(endpoints)/reconciliation/page.tsx (server component, cache:no-store)
  -> EndpointPage + shared DataGrid; page title "Ledger"; shows "139 rows".
- HTTP 200; SSR HTML contains 139 row markers (PAYMENT-/INVOICE-/EVENT-),
  131 unique refs (INV2-*, QA-*, INVOICING.* event types, WH-*).
- Screenshot: evidence/2026-10-28-stage80-ledger-grid.png (browser tab "Ledger · PayPal × AG Grid").

## Incident: /tmp wiped + infrastructure dead
- The harness /tmp cleanup killed dev.log; the dev server process was gone (HTTP 000).
- Restored: npm run dev + ngrok (SAME stable URL -> webhook registration still valid),
  BASE_URL re-verified/updated, /health 200 both locally and through the tunnel.
- Lesson: infra must be re-verified at session start (added to daily ritual).

## Update (2026-10-28, stage 81): PNG replaced
- The original PNG was captured with ffmpeg x11grab on the LOCAL display, which does
  not show the (remote) browser window — it contained an unrelated window and was
  invalid evidence. Replaced with a real browser screenshot of the Ledger grid.
