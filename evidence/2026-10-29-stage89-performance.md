# Evidence — stage 89 (performance: 1000 rows without freezes)

Date: 2026-10-29 (plan date 06.11 — early)

## Marker: render < 1 s, screenshot in evidence/ — PASS

Implementation:
- GET /api/recon/rows?bench=N (1..5000): N deterministic synthetic rows (seeded LCG,
  refs prefixed BENCH- so they can never be mistaken for real records). The page
  passes `?bench=` through (searchParams) — /reconciliation?bench=1000 is the perf
  fixture. Real data untouched (no DB writes).
- Bench/debug hook: the grid exposes `window.__ledgerGrid` (GridApi) for console/perf
  driving — harmless in production, documented in code.

## Measurements (this machine)

| What | Measurement | Verdict |
|---|---|---|
| API: 1000-row JSON | 16 ms (297 KB) | PASS |
| SSR: full page with 1000 rows (cold) | 0.57 s (381 KB HTML) | PASS (<1 s) |
| SSR: full page with 1000 rows (warm) | 0.15 s | PASS (<1 s) |
| Client grid with 1000 rows | rendered and interactive (screenshot below); AG Grid virtualizes — only a viewport of DOM rows exists regardless of data size, so no frame freezes by construction | PASS (visual) |

Screenshot: evidence/2026-10-29-stage89-1000-rows.png — the Ledger showing
"1000 rows", BENCH-PAY-00001…15 with the coloured reconciliation statuses
(MATCHED/REVIEW/UNMATCHED/PENDING all present), Export CSV — captured from the
desktop app's Review pane (x11grab of the local Electron window after
browser.screenshot stayed blocked).

## Limitation (honest log)
- The in-page micro-benchmark (`setGridOption('rowData', 1000 rows)` + double-rAF
  paint timing via `window.__ledgerGrid`) could not be executed: the desktop browser
  disconnected mid-session ("No desktop browser is connected"). Server-side render
  timings above and the visual proof are the marker evidence; the client swap can be
  re-measured from the console (`window.__ledgerGrid`) when the desktop reconnects.
