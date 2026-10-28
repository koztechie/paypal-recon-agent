# Evidence — stage 79 ★ (AG Studio + boilerplate)

Date: 2026-10-28 (plan date 06.11 — early)

## Marker: grid renders with data; theming configured — PASS
- Boilerplate paypaldev/hackathon-paypal-ag-grid-boilerplate integrated as web/
  (Next.js 20.9+, ag-grid-community/react 36.2.0, ag-studio(-react) 3.0.0 — public npm).
- web/package.json: dev/start pinned to -p 3001 (root backend uses 3000).
- web/.env.local: PayPal creds copied from root (git-ignored), AG_STUDIO empty
  (45-day trial key optional — README: dashboard runs without it; AI assistant disabled).
- LIVE render proof: http://localhost:3001/invoices HTTP 200 and its SSR HTML
  contains **40 unique real INV2-* sandbox invoice ids** (grid renders actual data).
- /dashboard HTTP 200 with AG Studio markers.
- Theming: app/dashboard/studio/theme.ts ("AG Studio theme ... design tokens") +
  initial-report.ts theme blocks (legend/positions) — configured in code.
- Screenshot: evidence/2026-10-28-stage79-ag-studio.png (1920x1200 full-screen frame).

## Notes / follow-ups
- AG_STUDIO licence key: OPTIONAL for running; if the trial key is claimed later
  (ag-grid.com form — manual user step) drop it into web/.env.local.
- Root .gitignore extended with .next/ ; web/node_modules + web/.env.local ignored.
- AI assistant (OpenAI) intentionally left disabled — our assistant is Gemini-based.
