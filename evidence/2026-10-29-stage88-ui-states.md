# Evidence — stage 88 (3 UI states: empty, loading, API error)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: all 3 states verified — PASS

Implementation:
- Loading: app/(endpoints)/loading.tsx streaming fallback ("Loading PayPal data…")
  — already present; verified during every navigation (captured on screen).
- Empty: web DataGrid early-return card "No rows yet" (friendly explanation, no grid)
  when the API returns zero rows; plus AG Grid's `overlayNoRowsTemplate` for the
  filtered-to-nothing case ("No rows match the current filters…").
- Error: new app/(endpoints)/error.tsx boundary (mirrors the dashboard card, no
  cross-group dependency): title + explanation + the actual error message + digest +
  "Try again" (reset). reconciliation/page.tsx now checks `res.ok` and throws
  `GET /api/recon/rows failed: HTTP <code>` instead of crashing on bad JSON.

## Verification (each state forced for real, not mocked away)
| State | How it was forced | Evidence | Verdict |
|---|---|---|---|
| Loading | fresh navigation to /reconciliation | session capture showing the header + "Loading PayPal data…" grid area | PASS |
| Empty | web/ restarted with INTERNAL_API_URL -> mock API returning {rows:[]} | capture of the "No rows yet" card + "0 rows" header; DOM eval on the surface | PASS |
| Error | mock switched to HTTP 500 | capture of "We couldn't load this page" + "GET /api/recon/rows failed: HTTP 500" + "Try again"; DOM eval: errorCard + retry button present | PASS |
| Recovery | mock removed, web restarted against the real agent API | SSR HTML contains "Reconciliation ledger" + QA-P1 again | PASS |

- Known environment quirk: the managed browser's evaluate context often lags the
  rendered surface by minutes (loading shell visible to evaluate while the surface
  already shows the page); verifications above combine surface captures with DOM
  evaluations taken once the contexts converged.
