# Evidence — stage 106 (style consistency: colours, spacing, fonts)

Date: 2026-10-30 (plan date 08.11 — early)

## Marker: screenshot without visual disproportions — PASS (6/6 numeric checks)

Machine-verified consistency across all 5 screens (Playwright, 1280x900):

| Check | Value |
|---|---|
| one font stack everywhere | `"PayPal Open", "Helvetica Neue", Helvetica, Arial, sans-serif` (system stack, **no heavy frameworks** — no styled-components/MUI; Tailwind v4 + AG Grid theme are the only styling systems) |
| horizontal padding | `32px` (px-8) on all 5 |
| vertical padding | `24px` (py-6) on all 5 |
| background | `rgb(245, 247, 250)` (pp-canvas) on all 5 |
| TopNav (3 tabs) | present on all 5 |
| page titles | `28px` on /reconciliation, /agent, /settings, /negotiation; homepage hero `40px` — the ONLY deviation, intentional hierarchy, documented |

Screenshots: `2026-10-30-stage106-home.png`, `2026-10-30-stage106-negotiation.png`
(the two screens whose chrome changed in this stage).

## Static audit (before fixes)
- Raw hex colours in tsx: only `dashboard/components/ui/logo.tsx` — brand SVG path
  fills (logo artwork, not styles). All other colours come from the pp-* token set
  in globals.css (single source of truth).
- Every `<main>` carries `font-paypal` + `bg-pp-canvas` + `px-8 py-6` — verified by
  grep before the runtime check.
- h1 sizes: 5× 28px, 1× 40px (hero).

## What changed
- **Gap fixed:** the homepage and /negotiation lacked the TopNav chrome the other
  three screens had — inconsistent navigation was the one real disproportion.
  TopNav added to both (same component, same placement pattern: nav left,
  "← All pages" right where applicable).
- No colour/spacing/font edits were needed — the token system already held; the
  runtime assertions above prove it rather than assume it.
