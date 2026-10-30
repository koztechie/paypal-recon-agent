# Evidence — stage 113 ★ (phase criterion: a cohesive product, not a PoC)

Date: 2026-10-30 (plan date 08.11 — early)

## Marker: three screen screenshots in `evidence/screenshots/` — PASS

| File | Screen & state | What it proves about cohesion |
|---|---|---|
| `01-home.png` | Landing: hero + primary CTA + proof chips (live `144 live rows`) + API surface | one entry story, project identity (title/brand), live-fact chips |
| `02-ledger-ai-detail.png` | Ledger: 144-row grid, coloured statuses, open row panel with all fields + **AI insight** (`via llm · 1.1s`) | the core tool: data → detail → AI explanation in one surface |
| `03-negotiation-settled.png` | Negotiation window: settled `$450`, two agent columns, locked contract card | a second complete workflow sharing the same chrome/palette |

All three share the TopNav, the pp-palette, `px-8/py-6` rhythm and the font stack —
numerically asserted in stage 106 (6/6).

## Cohesion defect found WHILE reviewing these screenshots (fixed)
- The home proof chip said **“139 live rows” (hardcoded)** while the Ledger already
  showed **144** — a drift a side-by-side review would catch.
- Fix: `GET /api/rows-count` (cheap count endpoint) + client `LiveRowCount` chip
  that upgrades from “Live sandbox data” → “144 live rows” after hydration, so the
  landing stays STATIC (Lighthouse stage-109 criterion) while the number can never
  drift. Verified: SSR placeholder present, client shows `144 live rows`.

## Lighthouse re-check after the chip (control experiment, honest log)
- First attempt made the landing dynamic (server fetch at request time): mobile
  score86 →73, TBT up — REVERTED that design.
- Static landing + client chip measured73–76 mobile under the CURRENT machine load
  (load avg ~3, two Firefox instances + OpenCode active).
- **Control run with the chip removed entirely (stage-109 page shape):75** — the chip
  is NOT the cause (73 ≈75; JS payload vs stage-109:11 scripts, +178 B total,
  same file sizes). Desktop:100 (stage109) →97 now.
- Conclusion: the stage-109 criterion run (86 @07:33, quiet machine) remains the
  valid measurement; today’s delta is the lab amplifying machine load (×4 CPU sim),
  not a code regression. Addendum appended to the stage-109 evidence.
